// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {Test} from "forge-std/Test.sol";
import {CascadeVault} from "../src/CascadeVault.sol";
import {MockUSDC} from "./MockUSDC.sol";

/// @dev Independent ledger: accrues each record each day, never using the vault's aggregate or index formula.
contract VaultHandler is Test {
    CascadeVault public vault;
    MockUSDC public token;
    address[4] public actors = [address(0xa), address(0xb), address(0xc), address(0xd)];

    struct YieldRecord {
        uint256 amount;
        uint256 start;
        uint256 end;
        uint256 accrued;
        bool claimed;
        address account;
    }
    mapping(uint256 => YieldRecord) public records;
    uint256 public recordCount;
    bytes32[] public invoiceIds;
    mapping(bytes32 => uint256) public remaining;
    uint256 public principal;
    uint256 public accrued;
    uint256 public index = 1e18;

    constructor(CascadeVault v, MockUSDC t) {
        vault = v;
        token = t;
        token.mint(address(this), 1e24);
        token.approve(address(vault), type(uint256).max);
        for (uint256 i; i < actors.length; ++i) {
            token.mint(actors[i], 1e24);
            vm.prank(actors[i]);
            token.approve(address(vault), type(uint256).max);
        }
    }

    function issue(uint256 actorSeed, uint256 amountSeed, uint256 dateSeed) external {
        address debtor = actors[actorSeed % 4];
        address creditor = actors[(actorSeed % 4 + 1) % 4];
        uint256 amount = bound(amountSeed, 1, 10e6);
        uint32 maturity = uint32(vault.today() + dateSeed % 8);
        vm.prank(creditor);
        bytes32 id = vault.registerInvoice(debtor, 2 * amount, maturity);
        invoiceIds.push(id);
        remaining[id] = amount;
        vm.prank(debtor);
        uint256 eid = vault.issue(id, amount);
        principal += amount;
        _record(eid, debtor, amount, vault.today() + 1, maturity);
    }

    function transfer(uint256 actorSeed, uint256 dateSeed, uint256 amountSeed) external {
        address from = actors[actorSeed % 4];
        address to = actors[(actorSeed % 4 + 1) % 4];
        uint256[] memory ds = vault.datesOf(from, 0, 32);
        if (ds.length == 0) {
            return;
        }
        uint256 date = ds[dateSeed % ds.length];
        uint256 amount = bound(amountSeed, 1, vault.balanceOf(from, date));
        vm.prank(from);
        vault.safeTransferFrom(from, to, date, amount, "");
    }

    function pay(uint256 actorSeed, uint256 dateSeed, uint256 amountSeed) external {
        address debtor = actors[actorSeed % 4];
        address creditor = actors[(actorSeed % 4 + 2) % 4];
        uint256[] memory ds = vault.datesOf(debtor, 0, 32);
        if (ds.length == 0) {
            return;
        }
        uint256 date = ds[dateSeed % ds.length];
        uint256 amount = bound(amountSeed, 1, vault.balanceOf(debtor, date));
        uint32 maturity = uint32(date <= vault.today() ? 1 : date);
        vm.prank(creditor);
        bytes32 id = vault.registerInvoice(debtor, 2 * amount, maturity);
        invoiceIds.push(id);
        remaining[id] = amount;
        uint256[] memory selected = new uint256[](1);
        selected[0] = date;
        vm.prank(debtor);
        vault.pay(id, amount, selected, 2 * amount);
    }

    function extend(uint256 actorSeed, uint256 dateSeed, uint256 amountSeed, uint256 daysSeed) external {
        address actor = actors[actorSeed % 4];
        uint256[] memory ds = vault.datesOf(actor, 0, 32);
        if (ds.length == 0) {
            return;
        }
        uint256 date = ds[dateSeed % ds.length];
        uint256 amount = bound(amountSeed, 1, vault.balanceOf(actor, date));
        uint256 start = date < vault.today() ? vault.today() + 1 : date + 1;
        uint256 end = start + daysSeed % 8;
        vm.prank(actor);
        uint256 eid = vault.extend(amount, uint32(date), uint32(end));
        _record(eid, actor, amount, start, end);
    }

    function checkpoint(uint256 deltaSeed) external {
        uint256 delta = bound(deltaSeed, 0, 1e16);
        vm.warp(block.timestamp + 1 days);
        uint256 day = vault.today();
        for (uint256 i = 1; i <= recordCount; ++i) {
            YieldRecord storage e = records[i];
            if (!e.claimed && e.start <= day && day <= e.end) {
                uint256 income = e.amount * delta;
                e.accrued += income;
                accrued += income;
            }
        }
        index += delta;
        vault.checkpoint(delta);
    }

    function claim(uint256 seed) external {
        if (recordCount == 0) {
            return;
        }
        uint256 id = seed % recordCount + 1;
        YieldRecord storage e = records[id];
        if (e.claimed || e.end > vault.today()) {
            return;
        }
        vm.prank(e.account);
        uint256 paid = vault.claim(id);
        assertEq(paid, e.accrued / 1e18);
        principal += paid;
        accrued -= e.accrued;
        e.claimed = true;
    }

    function withdraw(uint256 actorSeed, uint256 amountSeed) external {
        address actor = actors[actorSeed % 4];
        uint256 date = vault.earliestDate(actor);
        if (date > vault.today()) {
            return;
        }
        uint256 amount = bound(amountSeed, 1, vault.balanceOf(actor, date));
        uint256 beforeBalance = token.balanceOf(actor);
        vm.prank(actor);
        vault.withdraw(amount);
        principal -= amount;
        assertEq(token.balanceOf(actor) - beforeBalance, amount);
    }

    function _record(uint256 id, address account, uint256 amount, uint256 start, uint256 end) private {
        assertEq(id, ++recordCount);
        records[id] = YieldRecord(amount, start, end, 0, start > end, account);
    }

    function invoiceCount() external view returns (uint256) {
        return invoiceIds.length;
    }
}

contract CascadeVaultInvariantTest is Test {
    CascadeVault vault;
    MockUSDC token;
    VaultHandler handler;

    function setUp() public {
        vm.warp(20_000 days);
        token = new MockUSDC();
        // Predict handler address so only it can fund daily checkpoints; no ownership mutation in vault.
        address nextHandler = vm.computeCreateAddress(address(this), vm.getNonce(address(this)) + 1);
        vault = new CascadeVault(address(token), nextHandler);
        handler = new VaultHandler(vault, token);
        assertEq(address(handler), vault.owner());
        handler.issue(0, 10e6, 3);
        bytes4[] memory selectors = new bytes4[](7);
        selectors[0] = handler.issue.selector;
        selectors[1] = handler.transfer.selector;
        selectors[2] = handler.pay.selector;
        selectors[3] = handler.extend.selector;
        selectors[4] = handler.checkpoint.selector;
        selectors[5] = handler.claim.selector;
        selectors[6] = handler.withdraw.selector;
        targetContract(address(handler));
        targetSelector(FuzzSelector(address(handler), selectors));
    }

    function invariantBackingAndIndependentAccrual() public view {
        assertEq(vault.totalSupply(), handler.principal());
        assertEq(vault.accruedScaled(), handler.accrued());
        assertEq(vault.indexAt(vault.lastCheckpoint()), handler.index());
        (uint256 b, uint256 p, uint256 y,, uint256 deficit) = vault.balanceSheet();
        assertGe(b, p + y);
        assertEq(deficit, 0);
    }

    function invariantInvoicesNeverOverpaid() public view {
        for (uint256 i; i < handler.invoiceCount(); ++i) {
            bytes32 id = handler.invoiceIds(i);
            (,, uint256 original, uint256 outstanding,,) = vault.invoices(id);
            assertLe(outstanding, original);
            assertEq(outstanding, handler.remaining(id));
        }
    }

    function invariantHeapBalancesAndMaturityCountedOnce() public view {
        uint256 sum;
        for (uint256 a; a < 4; ++a) {
            address actor = handler.actors(a);
            uint256 offset;
            uint256 minimum = type(uint256).max;
            uint256[] memory seen = new uint256[](256);
            uint256 seenCount;
            while (true) {
                uint256[] memory ds = vault.datesOf(actor, offset, 32);
                if (ds.length == 0) {
                    break;
                }
                for (uint256 i; i < ds.length; ++i) {
                    uint256 balance = vault.balanceOf(actor, ds[i]);
                    assertGt(balance, 0);
                    for (uint256 j; j < seenCount; ++j) {
                        assertNotEq(seen[j], ds[i]);
                    }
                    seen[seenCount++] = ds[i];
                    sum += balance;
                    if (ds[i] < minimum) {
                        minimum = ds[i];
                    }
                }
                offset += ds.length;
            }
            assertEq(vault.earliestDate(actor), minimum);
        }
        assertEq(sum, vault.totalSupply());
    }

    function invariantEntitlementOwnershipAndIntervals() public view {
        for (uint256 i = 1; i <= handler.recordCount(); ++i) {
            (uint256 amount, uint256 start, uint256 end,, bool claimed, address account) = handler.records(i);
            (
                address actualAccount,
                uint256 actualAmount,
                uint32 actualStart,
                uint32 actualEnd,
                bool actualClaimed
            ) = vault.entitlements(i);
            assertEq(actualAccount, account);
            assertEq(actualAmount, amount);
            assertEq(actualStart, start);
            assertEq(actualEnd, end);
            assertEq(actualClaimed, claimed);
        }
    }
}
