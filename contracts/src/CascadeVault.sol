// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {AccountDates} from "./libraries/AccountDates.sol";

/// @notice USDC-backed dated dollars. See DECISIONS.md for the funded demo index and time convention.
contract CascadeVault is ERC1155, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using AccountDates for AccountDates.Heap;

    uint256 public constant SCALE = 1e18;
    uint256 public constant MAX_BUCKETS = 32;
    IERC20 public immutable usdc;
    address public immutable owner;
    uint256 public immutable deploymentDay;

    struct Invoice {
        address creditor;
        address debtor;
        uint256 amount;
        uint256 outstanding;
        uint32 dueDate;
        uint32 acceptedMaturity;
    }

    struct Entitlement {
        address account;
        uint256 amount;
        uint32 start;
        uint32 end;
        bool claimed;
    }

    mapping(bytes32 => Invoice) public invoices;
    mapping(address => uint256) public invoiceNonces;
    mapping(uint256 => Entitlement) public entitlements;
    uint256 public entitlementCount;
    uint256 public totalSupply; // All dated units AND interpreted spot, counted exactly once.
    mapping(uint256 => uint256) public supplyByDate;
    mapping(address => AccountDates.Heap) private accountDates;

    uint256 public lastCheckpoint;
    mapping(uint256 => uint256) private dailyIndex;
    mapping(uint256 => uint256) public starts;
    mapping(uint256 => uint256) public stops; // Stops on E + 1, after the inclusive earning interval.
    uint256 public activeNotional;
    uint256 public accruedScaled; // Exact scaled sum, including fractional USDC dust.

    error InvalidTerms();
    error Unauthorized();
    error InvalidAmount();
    error StaleCheckpoint();
    error UnpublishedIndex();
    error InvalidDate();
    error InvalidDates();
    error TooManyBuckets();
    error InsufficientSpot();
    error InsufficientPayment();
    error InvoiceBalanceChanged();
    error NotClaimable();
    error Underbacked();
    error UnexpectedTokenAmount();

    event InvoiceRegistered(
        bytes32 indexed invoiceId,
        address indexed creditor,
        address indexed debtor,
        uint256 amount,
        uint32 dueDate,
        uint32 acceptedMaturity,
        uint256 day
    );
    event Issued(bytes32 indexed invoiceId, uint256 amount, uint256 indexed entitlementId, uint256 day);
    event Paid(bytes32 indexed invoiceId, uint256 amount, uint256 outstanding, uint256 day);
    event EntitlementCreated(
        uint256 indexed id, address indexed account, uint256 amount, uint32 start, uint32 end, uint256 day
    );
    event Extended(
        address indexed account,
        uint256 amount,
        uint32 fromDate,
        uint32 toDate,
        uint256 indexed entitlementId,
        uint256 day
    );
    event Claimed(uint256 indexed entitlementId, address indexed account, uint256 amount, uint256 day);
    event Withdrawn(address indexed account, uint256 amount, uint256 day);
    event Checkpoint(
        uint256 indexed day,
        uint256 index,
        uint256 funded,
        uint256 backing,
        uint256 principal,
        uint256 accrued,
        uint256 reserve
    );

    constructor(address token, address checkpointOwner) ERC1155("") {
        if (token.code.length == 0 || checkpointOwner == address(0)) {
            revert InvalidTerms();
        }
        usdc = IERC20(token);
        owner = checkpointOwner;
        deploymentDay = today();
        lastCheckpoint = deploymentDay;
        dailyIndex[deploymentDay] = SCALE;
    }

    function today() public view returns (uint256) {
        return block.timestamp / 1 days;
    }

    function indexAt(uint256 day) public view returns (uint256) {
        if (day > lastCheckpoint) {
            revert UnpublishedIndex();
        }
        return day <= deploymentDay ? SCALE : dailyIndex[day];
    }

    function registerInvoice(address debtor, uint256 amount, uint32 dueDate)
        external
        nonReentrant
        returns (bytes32)
    {
        return _register(debtor, amount, dueDate, dueDate);
    }

    function registerInvoice(address debtor, uint256 amount, uint32 dueDate, uint32 maturity)
        external
        nonReentrant
        returns (bytes32)
    {
        return _register(debtor, amount, dueDate, maturity);
    }

    function _register(address debtor, uint256 amount, uint32 dueDate, uint32 maturity)
        private
        returns (bytes32 id)
    {
        if (debtor == address(0) || amount == 0 || maturity > dueDate) {
            revert InvalidTerms();
        }
        id = keccak256(abi.encode(block.chainid, address(this), msg.sender, invoiceNonces[msg.sender]++));
        invoices[id] = Invoice(msg.sender, debtor, amount, amount, dueDate, maturity);
        emit InvoiceRegistered(id, msg.sender, debtor, amount, dueDate, maturity, today());
        _assertBacked();
    }

    function issue(bytes32 invoiceId, uint256 amount) external nonReentrant returns (uint256 id) {
        _requireCurrent();
        Invoice storage invoice = _debitInvoice(invoiceId, amount);
        _pull(msg.sender, amount);
        id = _entitle(msg.sender, amount, today() + 1, invoice.acceptedMaturity);
        _mint(invoice.creditor, invoice.acceptedMaturity, amount, "");
        emit Issued(invoiceId, amount, id, today());
        _assertBacked();
    }

    function pay(bytes32 invoiceId, uint256 amount, uint256[] calldata dates) external nonReentrant {
        _pay(invoiceId, amount, dates);
    }

    /// @notice Optimistic concurrency guard: a retry cannot settle the same partial payment twice.
    function pay(bytes32 invoiceId, uint256 amount, uint256[] calldata dates, uint256 expectedOutstanding)
        external
        nonReentrant
    {
        if (invoices[invoiceId].outstanding != expectedOutstanding) {
            revert InvoiceBalanceChanged();
        }
        _pay(invoiceId, amount, dates);
    }

    function _pay(bytes32 invoiceId, uint256 amount, uint256[] calldata dates) private {
        if (dates.length == 0) {
            revert InvalidDates();
        }
        if (dates.length > MAX_BUCKETS) {
            revert TooManyBuckets();
        }
        Invoice storage invoice = _debitInvoice(invoiceId, amount);
        uint256 day = today();
        // Validate every ID, including unused trailing buckets; consume in caller order.
        for (uint256 i; i < dates.length; ++i) {
            uint256 date = dates[i];
            if (date > type(uint32).max) {
                revert InvalidDate();
            }
            bool spot = date <= day;
            if (!spot && date > invoice.acceptedMaturity) {
                revert InvalidDate();
            }
            _checkDuplicate(dates, i);
        }
        uint256 remaining = amount;
        uint256[] memory amounts = new uint256[](dates.length);
        for (uint256 i; i < dates.length; ++i) {
            uint256 available = balanceOf(msg.sender, dates[i]);
            uint256 take = available < remaining ? available : remaining;
            amounts[i] = take;
            remaining -= take;
        }
        if (remaining != 0) {
            revert InsufficientPayment();
        }
        _safeBatchTransferFrom(msg.sender, invoice.creditor, dates, amounts, "");
        emit Paid(invoiceId, amount, invoice.outstanding, day);
        _assertBacked();
    }

    /// @notice fromDate == today consumes aggregate spot; every other fromDate selects that exact ID.
    function extend(uint256 amount, uint32 fromDate, uint32 toDate)
        external
        nonReentrant
        returns (uint256 id)
    {
        _requireCurrent();
        if (amount == 0) {
            revert InvalidAmount();
        }
        uint256 day = today();
        if (toDate <= fromDate || toDate <= day) {
            revert InvalidDate();
        }
        if (fromDate == day) {
            _burnSpot(msg.sender, amount);
        } else {
            _burn(msg.sender, fromDate, amount);
        }
        uint256 start = uint256(fromDate) + 1;
        if (start <= day) {
            start = day + 1;
        }
        id = _entitle(msg.sender, amount, start, toDate);
        _mint(msg.sender, toDate, amount, "");
        emit Extended(msg.sender, amount, fromDate, toDate, id, day);
        _assertBacked();
    }

    function extendSpot(uint256 amount, uint32 toDate) external nonReentrant returns (uint256) {
        _checkSpotExtension(amount, toDate);
        _burnSpot(msg.sender, amount);
        return _mintSpotExtension(amount, toDate);
    }

    function extendSpot(uint256 amount, uint32 toDate, uint256[] calldata dates)
        external
        nonReentrant
        returns (uint256)
    {
        _checkSpotExtension(amount, toDate);
        _burnSelectedSpot(msg.sender, amount, dates);
        return _mintSpotExtension(amount, toDate);
    }

    function _checkSpotExtension(uint256 amount, uint32 toDate) private view {
        _requireCurrent();
        if (amount == 0) {
            revert InvalidAmount();
        }
        if (toDate <= today()) {
            revert InvalidDate();
        }
    }

    function _mintSpotExtension(uint256 amount, uint32 toDate) private returns (uint256 id) {
        uint256 day = today();
        id = _entitle(msg.sender, amount, day + 1, toDate);
        _mint(msg.sender, toDate, amount, "");
        emit Extended(msg.sender, amount, uint32(day), toDate, id, day);
        _assertBacked();
    }

    function withdraw(uint256 amount, uint256[] calldata dates) external nonReentrant {
        if (amount == 0) {
            revert InvalidAmount();
        }
        _assertBacked();
        _burnSelectedSpot(msg.sender, amount, dates);
        usdc.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount, today());
        _assertBacked();
    }

    function withdraw(uint256 amount) external nonReentrant {
        if (amount == 0) {
            revert InvalidAmount();
        }
        _assertBacked();
        _burnSpot(msg.sender, amount);
        usdc.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount, today());
        _assertBacked();
    }

    function claim(uint256 id) external nonReentrant returns (uint256 amount) {
        Entitlement storage entitlement = entitlements[id];
        if (entitlement.account != msg.sender) {
            revert Unauthorized();
        }
        if (entitlement.claimed || entitlement.end > lastCheckpoint) {
            revert NotClaimable();
        }
        _assertBacked();
        uint256 scaled = entitlement.amount * (indexAt(entitlement.end) - indexAt(entitlement.start - 1));
        amount = scaled / SCALE;
        entitlement.claimed = true;
        accruedScaled -= scaled;
        if (amount != 0) {
            _mint(msg.sender, today(), amount, "");
        }
        emit Claimed(id, msg.sender, amount, today());
        _assertBacked();
    }

    /// @notice Fund and publish the next elapsed UTC day. No oracle, future time, or promised yield.
    function checkpoint(uint256 indexDelta) external nonReentrant {
        if (msg.sender != owner) {
            revert Unauthorized();
        }
        uint256 day = lastCheckpoint + 1;
        if (day > today()) {
            revert InvalidDate();
        }
        activeNotional = activeNotional + starts[day] - stops[day];
        uint256 increment = activeNotional * indexDelta;
        uint256 funded = _ceil(increment);
        if (funded != 0) {
            _pull(owner, funded);
        }
        accruedScaled += increment;
        dailyIndex[day] = indexAt(lastCheckpoint) + indexDelta;
        lastCheckpoint = day;
        _assertBacked();
        (uint256 backing, uint256 principal, uint256 accrued, uint256 reserve,) = balanceSheet();
        emit Checkpoint(day, dailyIndex[day], funded, backing, principal, accrued, reserve);
    }

    function accruedValue(uint256 id) external view returns (uint256 amount, bool claimable) {
        Entitlement storage e = entitlements[id];
        if (e.account == address(0) || e.claimed || lastCheckpoint < e.start) {
            return (0, false);
        }
        uint256 end = e.end < lastCheckpoint ? e.end : lastCheckpoint;
        amount = e.amount * (indexAt(end) - indexAt(e.start - 1)) / SCALE;
        claimable = lastCheckpoint >= e.end;
    }

    function balanceSheet()
        public
        view
        returns (uint256 backing, uint256 principal, uint256 accrued, uint256 reserve, uint256 deficit)
    {
        backing = usdc.balanceOf(address(this));
        principal = totalSupply;
        accrued = _ceil(accruedScaled);
        uint256 liability = principal + accrued;
        if (backing >= liability) {
            reserve = backing - liability;
        } else {
            deficit = liability - backing;
        }
    }

    /// @notice Heap-order pagination for wallets. Classify each returned date against today().
    function datesOf(address account, uint256 offset, uint256 limit)
        external
        view
        returns (uint256[] memory result)
    {
        if (limit > MAX_BUCKETS) {
            revert TooManyBuckets();
        }
        uint256 length = accountDates[account].dates.length;
        uint256 count = offset < length ? length - offset : 0;
        if (count > limit) {
            count = limit;
        }
        result = new uint256[](count);
        for (uint256 i; i < count; ++i) {
            result[i] = accountDates[account].dates[offset + i];
        }
    }

    function earliestDate(address account) external view returns (uint256) {
        return accountDates[account].first();
    }

    function safeTransferFrom(address from, address to, uint256 id, uint256 value, bytes memory data)
        public
        override
        nonReentrant
    {
        super.safeTransferFrom(from, to, id, value, data);
        _assertBacked();
    }

    function safeBatchTransferFrom(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values,
        bytes memory data
    ) public override nonReentrant {
        super.safeBatchTransferFrom(from, to, ids, values, data);
        _assertBacked();
    }

    function _update(address from, address to, uint256[] memory ids, uint256[] memory values)
        internal
        override
    {
        super._update(from, to, ids, values);
        for (uint256 i; i < ids.length; ++i) {
            if (from == address(0)) {
                totalSupply += values[i];
                supplyByDate[ids[i]] += values[i];
            }
            if (to == address(0)) {
                totalSupply -= values[i];
                supplyByDate[ids[i]] -= values[i];
            }
            if (from == to) {
                continue;
            }
            if (from != address(0) && balanceOf(from, ids[i]) == 0) {
                accountDates[from].remove(ids[i]);
            }
            if (to != address(0) && balanceOf(to, ids[i]) != 0) {
                accountDates[to].add(ids[i]);
            }
        }
    }

    function _burnSpot(address account, uint256 amount) private {
        for (uint256 i; amount != 0 && i < MAX_BUCKETS; ++i) {
            uint256 date = accountDates[account].first();
            if (date > today()) {
                revert InsufficientSpot();
            }
            uint256 available = balanceOf(account, date);
            uint256 take = available < amount ? available : amount;
            _burn(account, date, take);
            amount -= take;
        }
        if (amount != 0) {
            revert TooManyBuckets();
        }
    }

    function _checkDuplicate(uint256[] calldata dates, uint256 i) private pure {
        for (uint256 j; j < i; ++j) {
            if (dates[j] == dates[i]) {
                revert InvalidDates();
            }
        }
    }

    function _burnSelectedSpot(address account, uint256 amount, uint256[] calldata dates) private {
        if (dates.length == 0) {
            revert InvalidDates();
        }
        if (dates.length > MAX_BUCKETS) {
            revert TooManyBuckets();
        }
        for (uint256 i; i < dates.length; ++i) {
            if (dates[i] > today()) {
                revert InvalidDate();
            }
            _checkDuplicate(dates, i);
        }
        for (uint256 i; i < dates.length && amount != 0; ++i) {
            uint256 available = balanceOf(account, dates[i]);
            uint256 take = available < amount ? available : amount;
            if (take != 0) {
                _burn(account, dates[i], take);
            }
            amount -= take;
        }
        if (amount != 0) {
            revert InsufficientSpot();
        }
    }

    function _debitInvoice(bytes32 invoiceId, uint256 amount) private returns (Invoice storage invoice) {
        invoice = invoices[invoiceId];
        if (invoice.debtor != msg.sender) {
            revert Unauthorized();
        }
        if (amount == 0 || amount > invoice.outstanding) {
            revert InvalidAmount();
        }
        invoice.outstanding -= amount;
    }

    function _entitle(address account, uint256 amount, uint256 start, uint256 end)
        private
        returns (uint256 id)
    {
        if (start > type(uint32).max) {
            revert InvalidDate();
        }
        id = ++entitlementCount;
        bool empty = start > end;
        entitlements[id] = Entitlement(account, amount, uint32(start), uint32(end), empty);
        if (!empty) {
            starts[start] += amount;
            stops[end + 1] += amount;
        }
        emit EntitlementCreated(id, account, amount, uint32(start), uint32(end), today());
    }

    function _requireCurrent() private view {
        if (lastCheckpoint != today()) {
            revert StaleCheckpoint();
        }
    }

    function _ceil(uint256 scaled) private pure returns (uint256) {
        return scaled / SCALE + (scaled % SCALE == 0 ? 0 : 1);
    }

    function _assertBacked() private view {
        if (usdc.balanceOf(address(this)) < totalSupply + _ceil(accruedScaled)) {
            revert Underbacked();
        }
    }

    function _pull(address from, uint256 amount) private {
        uint256 beforeBalance = usdc.balanceOf(address(this));
        usdc.safeTransferFrom(from, address(this), amount);
        if (usdc.balanceOf(address(this)) != beforeBalance + amount) {
            revert UnexpectedTokenAmount();
        }
    }
}
