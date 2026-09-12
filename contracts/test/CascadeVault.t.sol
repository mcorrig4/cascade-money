// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {Test} from "forge-std/Test.sol";
import {CascadeVault} from "../src/CascadeVault.sol";
import {TestUSDC as MockUSDC} from "./MockUSDC.sol";
import {IERC1155Receiver} from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";

contract Receiver is IERC1155Receiver {
    CascadeVault public vault;
    bool public reject;
    bool public attempted;
    bool public reentered;
    bytes public attack;
    bool public wrongSelector;

    function configure(bytes calldata data, bool wrong) external {
        attack = data;
        wrongSelector = wrong;
    }

    constructor(CascadeVault v) {
        vault = v;
    }

    function setReject(bool value) external {
        reject = value;
    }

    function register(address debtor, uint256 amount, uint32 date) external returns (bytes32) {
        return vault.registerInvoice(debtor, amount, date);
    }

    function _receive() private {
        require(!reject, "reject");
        attempted = true;
        (reentered,) = address(vault)
            .call(attack.length == 0 ? abi.encodeWithSignature("withdraw(uint256)", 1) : attack);
    }

    function onERC1155Received(address, address, uint256, uint256, bytes calldata) external returns (bytes4) {
        _receive();
        return wrongSelector ? bytes4(0) : this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(address, address, uint256[] calldata, uint256[] calldata, bytes calldata)
        external
        returns (bytes4)
    {
        _receive();
        return wrongSelector ? bytes4(0) : this.onERC1155BatchReceived.selector;
    }

    function supportsInterface(bytes4 id) external pure returns (bool) {
        return id == type(IERC1155Receiver).interfaceId || id == 0x01ffc9a7;
    }

    function execute(address target, bytes calldata data) external returns (bytes memory result) {
        bool ok;
        (ok, result) = target.call(data);
        require(ok, "execute failed");
    }
}

contract CascadeVaultTest is Test {
    CascadeVault internal vault;
    MockUSDC internal token;
    address internal alice = address(0xa11ce);
    address internal bob = address(0xb0b);
    address internal carol = address(0xca401);
    address internal dave = address(0xda7e);
    uint32 internal constant DAY = 20_000;
    uint256 internal constant U = 1e6;

    function setUp() public {
        vm.warp(uint256(DAY) * 1 days);
        token = new MockUSDC();
        vault = new CascadeVault(address(token), address(this));
        token.mint(address(this), 1_000_000 * U);
        token.approve(address(vault), type(uint256).max);
        token.mint(alice, 1_000_000 * U);
        vm.prank(alice);
        token.approve(address(vault), type(uint256).max);
    }

    function invoice(address creditor, address debtor, uint256 amount, uint32 maturity)
        internal
        returns (bytes32 id)
    {
        vm.prank(creditor);
        id = vault.registerInvoice(debtor, amount, maturity, maturity);
    }

    function issueTo(address creditor, uint256 amount, uint32 maturity) internal returns (uint256 eid) {
        bytes32 id = invoice(creditor, alice, amount, maturity);
        vm.prank(alice);
        eid = vault.issue(id, amount);
    }

    function dates(uint256 date) internal pure returns (uint256[] memory result) {
        result = new uint256[](1);
        result[0] = date;
    }

    function advance(uint256 count, uint256 delta) internal {
        for (uint256 i; i < count; ++i) {
            vm.warp(block.timestamp + 1 days);
            vault.checkpoint(delta);
        }
    }

    function outstanding(bytes32 id) internal view returns (uint256 remaining) {
        (,,, remaining,,) = vault.invoices(id);
    }

    function testRegisterDefaultMAndUniqueIds() public {
        vm.startPrank(bob);
        bytes32 one = vault.registerInvoice(alice, 10 * U, DAY + 90);
        bytes32 two = vault.registerInvoice(alice, 10 * U, DAY + 90);
        vm.stopPrank();
        assertNotEq(one, two);
        (address creditor, address debtor, uint256 amount, uint256 remaining, uint32 due, uint32 maturity) =
            vault.invoices(one);
        assertEq(creditor, bob);
        assertEq(debtor, alice);
        assertEq(amount, remaining);
        assertEq(due, maturity);
        assertEq(vault.invoiceNonces(bob), 2);
    }

    function testRegisterInvalidTerms() public {
        vm.expectRevert(CascadeVault.InvalidTerms.selector);
        vault.registerInvoice(address(0), U, DAY);
        vm.expectRevert(CascadeVault.InvalidTerms.selector);
        vault.registerInvoice(alice, 0, DAY);
        vm.expectRevert(CascadeVault.InvalidTerms.selector);
        vault.registerInvoice(alice, U, DAY, DAY + 1);
    }

    function testIssuePartialAndEntitlement() public {
        bytes32 id = invoice(bob, alice, 10 * U, DAY + 90);
        vm.prank(alice);
        uint256 eid = vault.issue(id, 4 * U);
        assertEq(outstanding(id), 6 * U);
        assertEq(vault.balanceOf(bob, DAY + 90), 4 * U);
        (address account, uint256 amount, uint32 start, uint32 end, bool claimed) = vault.entitlements(eid);
        assertEq(account, alice);
        assertEq(amount, 4 * U);
        assertEq(start, DAY + 1);
        assertEq(end, DAY + 90);
        assertFalse(claimed);
        assertEq(token.balanceOf(address(vault)), vault.totalSupply());
    }

    function testIssueUnauthorizedZeroOverpaymentAndClosed() public {
        bytes32 id = invoice(bob, alice, U, DAY + 1);
        vm.expectRevert(CascadeVault.Unauthorized.selector);
        vault.issue(id, U);
        vm.startPrank(alice);
        vm.expectRevert(CascadeVault.InvalidAmount.selector);
        vault.issue(id, 0);
        vm.expectRevert(CascadeVault.InvalidAmount.selector);
        vault.issue(id, U + 1);
        vault.issue(id, U);
        vm.expectRevert(CascadeVault.InvalidAmount.selector);
        vault.issue(id, 1);
        vm.stopPrank();
    }

    function testIssueSpotHasClosedEmptyEntitlement() public {
        uint256 eid = issueTo(bob, U, DAY - 1);
        (,,,, bool claimed) = vault.entitlements(eid);
        assertTrue(claimed);
        assertEq(vault.starts(DAY + 1), 0);
        vm.prank(bob);
        vault.withdraw(U);
        assertEq(token.balanceOf(bob), U);
    }

    function testPayPartialExpectedOutstandingAndInvoiceConservation() public {
        issueTo(bob, 10 * U, DAY + 30);
        bytes32 id = invoice(carol, bob, 10 * U, DAY + 90);
        vm.startPrank(bob);
        vault.pay(id, 4 * U, dates(DAY + 30), 10 * U);
        vm.expectRevert(CascadeVault.InvoiceBalanceChanged.selector);
        vault.pay(id, 4 * U, dates(DAY + 30), 10 * U);
        vault.pay(id, 6 * U, dates(DAY + 30));
        vm.expectRevert(CascadeVault.InvalidAmount.selector);
        vault.pay(id, 1, dates(DAY + 30));
        vm.stopPrank();
        assertEq(outstanding(id), 0);
        assertEq(vault.balanceOf(carol, DAY + 30), 10 * U);
        assertEq(vault.entitlementCount(), 1);
    }

    function testIssueAndPayShareOutstanding() public {
        issueTo(alice, 4 * U, DAY + 1);
        bytes32 id = invoice(bob, alice, 10 * U, DAY + 2);
        vm.startPrank(alice);
        vault.issue(id, 6 * U);
        vault.pay(id, 4 * U, dates(DAY + 1));
        vm.expectRevert(CascadeVault.InvalidAmount.selector);
        vault.issue(id, 1);
        vm.stopPrank();
        assertEq(outstanding(id), 0);
    }

    function testPayValidatesTrailingDateAndAtomicRollback() public {
        issueTo(bob, U, DAY + 1);
        bytes32 id = invoice(carol, bob, U, DAY + 2);
        uint256[] memory ds = new uint256[](2);
        ds[0] = DAY + 1;
        ds[1] = DAY + 3;
        vm.prank(bob);
        vm.expectRevert(CascadeVault.InvalidDate.selector);
        vault.pay(id, U, ds);
        assertEq(outstanding(id), U);
        assertEq(vault.balanceOf(bob, DAY + 1), U);
    }

    function testPayRejectsBadArraysAndInsufficientBalance() public {
        bytes32 id = invoice(carol, bob, U, DAY + 90);
        vm.startPrank(bob);
        vm.expectRevert(CascadeVault.InvalidDates.selector);
        vault.pay(id, U, new uint256[](0));
        vm.expectRevert(CascadeVault.TooManyBuckets.selector);
        vault.pay(id, U, new uint256[](33));
        uint256[] memory ds = new uint256[](2);
        ds[0] = DAY + 1;
        ds[1] = DAY + 1;
        vm.expectRevert(CascadeVault.InvalidDates.selector);
        vault.pay(id, U, ds);
        ds[0] = DAY + 2;
        vm.expectRevert(CascadeVault.InsufficientPayment.selector);
        vault.pay(id, U, ds);
        vm.expectRevert(CascadeVault.InsufficientPayment.selector);
        vault.pay(id, U, dates(DAY + 1));
        vm.stopPrank();
        assertEq(outstanding(id), U);
    }

    function testPayMixedFutureAndSpot() public {
        issueTo(bob, 2 * U, DAY);
        issueTo(bob, 3 * U, DAY + 10);
        bytes32 id = invoice(carol, bob, 4 * U, DAY + 30);
        uint256[] memory ds = new uint256[](2);
        ds[0] = DAY + 10;
        ds[1] = DAY;
        vm.prank(bob);
        vault.pay(id, 4 * U, ds);
        assertEq(vault.balanceOf(carol, DAY + 10), 3 * U);
        assertEq(vault.balanceOf(carol, DAY), U);
    }

    function testExtendTransferPayBypassReverts() public {
        issueTo(bob, 10 * U, DAY + 30);
        bytes32 id = invoice(dave, carol, 10 * U, DAY + 30);
        vm.startPrank(bob);
        vault.extend(10 * U, DAY + 30, DAY + 90);
        vault.safeTransferFrom(bob, carol, DAY + 90, 10 * U, "");
        vm.stopPrank();
        vm.prank(carol);
        vm.expectRevert(CascadeVault.InvalidDate.selector);
        vault.pay(id, 10 * U, dates(DAY + 90));
        assertEq(outstanding(id), 10 * U);
        assertEq(vault.balanceOf(dave, DAY + 90), 0);
    }

    function testMaturedUnitsPayHistoricalBoundAsSpot() public {
        issueTo(bob, U, DAY + 2);
        bytes32 id = invoice(carol, bob, U, DAY);
        vm.warp(uint256(DAY + 2) * 1 days); // No checkpoint or maintenance needed for maturity.
        vm.prank(bob);
        vault.pay(id, U, dates(DAY + 2));
        assertEq(outstanding(id), 0);
    }

    function testTransferSplitMergeAndOperatorDoesNotMoveYield() public {
        uint256 eid = issueTo(bob, 10 * U, DAY + 3);
        vm.prank(bob);
        vault.setApprovalForAll(carol, true);
        vm.prank(carol);
        vault.safeTransferFrom(bob, dave, DAY + 3, 4 * U, "");
        vm.prank(dave);
        vault.safeTransferFrom(dave, bob, DAY + 3, 4 * U, "");
        assertEq(vault.balanceOf(bob, DAY + 3), 10 * U);
        assertEq(vault.earliestDate(dave), type(uint256).max);
        (address account,,,,) = vault.entitlements(eid);
        assertEq(account, alice);
        bytes32 id = invoice(dave, bob, U, DAY + 3);
        vm.prank(carol);
        vm.expectRevert(CascadeVault.Unauthorized.selector);
        vault.pay(id, U, dates(DAY + 3));
    }

    function testBatchTransferDuplicateIdsZeroAndSelfTransferHeap() public {
        issueTo(bob, 5 * U, DAY + 1);
        uint256[] memory ds = new uint256[](3);
        ds[0] = DAY + 1;
        ds[1] = DAY + 1;
        ds[2] = DAY + 2;
        uint256[] memory amounts = new uint256[](3);
        amounts[0] = U;
        amounts[1] = U;
        vm.startPrank(bob);
        vault.safeBatchTransferFrom(bob, carol, ds, amounts, "");
        vault.safeTransferFrom(bob, bob, DAY + 1, U, "");
        vm.stopPrank();
        assertEq(vault.datesOf(carol, 0, 32).length, 1);
        assertEq(vault.datesOf(bob, 0, 32).length, 1);
        assertEq(vault.totalSupply(), 5 * U);
    }

    function testExtendIntervalIsInclusiveAndForwardOnly() public {
        issueTo(bob, 10 * U, DAY + 30);
        vm.startPrank(bob);
        vm.expectRevert(CascadeVault.InvalidDate.selector);
        vault.extend(U, DAY + 30, DAY + 30);
        vm.expectRevert(CascadeVault.InvalidDate.selector);
        vault.extend(U, DAY + 30, DAY + 29);
        uint256 eid = vault.extend(4 * U, DAY + 30, DAY + 90);
        vm.stopPrank();
        (address account, uint256 amount, uint32 start, uint32 end,) = vault.entitlements(eid);
        assertEq(account, bob);
        assertEq(amount, 4 * U);
        assertEq(start, DAY + 31);
        assertEq(end, DAY + 90);
        assertEq(vault.totalSupply(), 10 * U);
        assertEq(vault.balanceOf(bob, DAY + 30), 6 * U);
    }

    function testRecommitSpotConsumesMaturedBuckets() public {
        issueTo(bob, 2 * U, DAY - 2);
        issueTo(bob, 3 * U, DAY);
        vm.prank(bob);
        uint256 eid = vault.extend(4 * U, DAY, DAY + 20);
        (,, uint32 start, uint32 end,) = vault.entitlements(eid);
        assertEq(start, DAY + 1);
        assertEq(end, DAY + 20);
        assertEq(vault.balanceOf(bob, DAY - 2), 0);
        assertEq(vault.balanceOf(bob, DAY), U);
    }

    function testWithdrawMaturityBoundaryAndNoDoubleCounting() public {
        issueTo(bob, 10 * U, DAY + 1);
        vm.warp(uint256(DAY + 1) * 1 days - 1);
        vm.prank(bob);
        vm.expectRevert(CascadeVault.InsufficientSpot.selector);
        vault.withdraw(U);
        vm.warp(uint256(DAY + 1) * 1 days);
        vm.prank(bob);
        vault.withdraw(10 * U);
        assertEq(vault.totalSupply(), 0);
        assertEq(vault.supplyByDate(DAY + 1), 0);
        assertEq(token.balanceOf(bob), 10 * U);
        vm.prank(bob);
        vm.expectRevert(CascadeVault.InsufficientSpot.selector);
        vault.withdraw(1);
    }

    function testWithdraw32BucketsAnd33AtomicFailure() public {
        for (uint32 i; i < 33; ++i) {
            issueTo(bob, U, DAY - i);
        }
        vm.prank(bob);
        vm.expectRevert(CascadeVault.TooManyBuckets.selector);
        vault.withdraw(33 * U);
        assertEq(vault.totalSupply(), 33 * U);
        vm.prank(bob);
        vault.withdraw(32 * U);
        vm.prank(bob);
        vault.withdraw(U);
        assertEq(vault.totalSupply(), 0);
        assertEq(vault.earliestDate(bob), type(uint256).max);
    }

    function testClaimFundedAccrualAndSpotWithdrawal() public {
        uint256 eid = issueTo(bob, 10 * U, DAY + 2);
        vm.prank(alice);
        vm.expectRevert(CascadeVault.NotClaimable.selector);
        vault.claim(eid);
        advance(1, 1e16);
        (uint256 value, bool ready) = vault.accruedValue(eid);
        assertEq(value, U / 10);
        assertFalse(ready);
        advance(1, 1e16);
        vm.prank(bob);
        vm.expectRevert(CascadeVault.Unauthorized.selector);
        vault.claim(eid);
        vm.prank(alice);
        uint256 claimed = vault.claim(eid);
        assertEq(claimed, U / 5);
        assertEq(vault.balanceOf(alice, DAY + 2), U / 5);
        assertEq(vault.accruedScaled(), 0);
        vm.prank(alice);
        vm.expectRevert(CascadeVault.NotClaimable.selector);
        vault.claim(eid);
        vm.prank(alice);
        vault.withdraw(U / 5);
        assertEq(token.balanceOf(address(vault)), 10 * U);
    }

    function testZeroYieldClaimClosesWithoutMint() public {
        uint256 eid = issueTo(bob, U, DAY + 1);
        advance(1, 0);
        vm.prank(alice);
        assertEq(vault.claim(eid), 0);
        assertEq(vault.totalSupply(), U);
    }

    function testCheckpointSchedulesNonOverlappingExtension() public {
        issueTo(bob, 10 * U, DAY + 2);
        vm.prank(bob);
        vault.extend(4 * U, DAY + 2, DAY + 4);
        advance(2, 1e16);
        assertEq(vault.activeNotional(), 10 * U);
        advance(1, 1e16);
        assertEq(vault.activeNotional(), 4 * U);
        advance(1, 1e16);
        advance(1, 1e16);
        assertEq(vault.activeNotional(), 0);
        assertEq(vault.accruedScaled(), (28 * U) * 1e16);
    }

    function testRoundingReserveAndAggregateBacking() public {
        issueTo(bob, 1, DAY + 1);
        issueTo(carol, 1, DAY + 1);
        advance(1, 6e17);
        (uint256 backing,, uint256 accrued, uint256 reserve,) = vault.balanceSheet();
        assertEq(backing, 4);
        assertEq(accrued, 2);
        assertEq(reserve, 0);
        vm.prank(alice);
        vault.claim(1);
        vm.prank(alice);
        vault.claim(2);
        (,,, reserve,) = vault.balanceSheet();
        assertEq(reserve, 2);
        assertEq(vault.accruedScaled(), 0);
    }

    function testCheckpointOwnerFundingAndDuplicateProtection() public {
        issueTo(bob, U, DAY + 1);
        vm.expectRevert(CascadeVault.InvalidDate.selector);
        vault.checkpoint(1e18);
        vm.warp(block.timestamp + 1 days);
        vm.prank(alice);
        vm.expectRevert(CascadeVault.Unauthorized.selector);
        vault.checkpoint(1e18);
        token.approve(address(vault), 0);
        vm.expectRevert();
        vault.checkpoint(1e18);
        assertEq(vault.lastCheckpoint(), DAY);
        assertEq(vault.accruedScaled(), 0);
        token.approve(address(vault), U);
        vault.checkpoint(1e18);
        assertEq(vault.indexAt(DAY + 1), 2e18);
        vm.expectRevert(CascadeVault.InvalidDate.selector);
        vault.checkpoint(0);
    }

    function testMissingCheckpointsBlockOnlyNewIntervals() public {
        issueTo(bob, U, DAY + 3);
        bytes32 id = invoice(carol, alice, U, DAY + 3);
        vm.warp(block.timestamp + 2 days);
        vm.prank(alice);
        vm.expectRevert(CascadeVault.StaleCheckpoint.selector);
        vault.issue(id, U);
        vm.prank(bob);
        vm.expectRevert(CascadeVault.StaleCheckpoint.selector);
        vault.extend(U, DAY + 3, DAY + 4);
        vault.checkpoint(0);
        vault.checkpoint(0);
        vm.prank(alice);
        vault.issue(id, U);
        assertEq(vault.indexAt(0), 1e18);
        vm.expectRevert(CascadeVault.UnpublishedIndex.selector);
        vault.indexAt(DAY + 3);
    }

    function testTransferFailureRestoresInvoiceAndPrincipal() public {
        bytes32 id = invoice(bob, alice, U, DAY);
        token.setFee(1);
        vm.prank(alice);
        vm.expectRevert(CascadeVault.UnexpectedTokenAmount.selector);
        vault.issue(id, U);
        assertEq(outstanding(id), U);
        assertEq(vault.totalSupply(), 0);
        assertEq(token.balanceOf(address(vault)), 0);
        token.setFee(0);
        vm.prank(alice);
        vault.issue(id, U);
        token.setReject(true);
        vm.prank(bob);
        vm.expectRevert();
        vault.withdraw(U);
        assertEq(vault.balanceOf(bob, DAY), U);
        assertEq(vault.totalSupply(), U);
    }

    function testReceiverCannotReenterAndRejectionRollsBack() public {
        Receiver receiver = new Receiver(vault);
        bytes32 id = receiver.register(alice, U, DAY);
        vm.prank(alice);
        vault.issue(id, U);
        assertTrue(receiver.attempted());
        assertFalse(receiver.reentered());
        receiver.setReject(true);
        bytes32 second = receiver.register(alice, U, DAY);
        vm.prank(alice);
        vm.expectRevert();
        vault.issue(second, U);
        assertEq(outstanding(second), U);
        assertEq(vault.totalSupply(), U);
    }

    function testUnderbackingStopsClaimAndWithdrawUntilDonationRepairs() public {
        uint256 eid = issueTo(bob, U, DAY + 1);
        advance(1, 1e16);
        token.burn(address(vault), 1);
        (,,,, uint256 deficit) = vault.balanceSheet();
        assertEq(deficit, 1);
        vm.prank(alice);
        vm.expectRevert(CascadeVault.Underbacked.selector);
        vault.claim(eid);
        vm.prank(bob);
        vm.expectRevert(CascadeVault.Underbacked.selector);
        vault.withdraw(1);
        assertTrue(token.transfer(address(vault), 1));
        vm.prank(alice);
        vault.claim(eid);
    }

    function testFuzzIssueExtendClaim(uint96 rawAmount, uint8 extraDays) public {
        uint256 amount = bound(uint256(rawAmount), 1, 100 * U);
        uint32 extra = uint32(bound(uint256(extraDays), 1, 10));
        uint256 first = issueTo(bob, amount, DAY + 1);
        vm.prank(bob);
        uint256 second = vault.extend(amount, DAY + 1, DAY + 1 + extra);
        advance(1 + extra, 1e15);
        vm.prank(alice);
        assertEq(vault.claim(first), amount * 1e15 / 1e18);
        vm.prank(bob);
        assertEq(vault.claim(second), amount * extra * 1e15 / 1e18);
        assertEq(vault.accruedScaled(), 0);
        (uint256 b, uint256 p,,,) = vault.balanceSheet();
        assertGe(b, p);
    }

    function testAppleStoryTenUSDCSettlesForty() public {
        address glass = address(0x61a55);
        bytes32 first = invoice(bob, alice, 10 * U, DAY + 90);
        bytes32 second = invoice(carol, bob, 10 * U, DAY + 90);
        bytes32 third = invoice(dave, carol, 10 * U, DAY + 90);
        bytes32 fourth = invoice(glass, dave, 10 * U, DAY + 120);
        vm.prank(alice);
        vault.issue(first, 10 * U);
        vm.prank(bob);
        vault.pay(second, 10 * U, dates(DAY + 90), 10 * U);
        vm.prank(carol);
        vault.pay(third, 10 * U, dates(DAY + 90), 10 * U);
        vm.prank(dave);
        uint256 eid = vault.extend(10 * U, DAY + 90, DAY + 120);
        vm.prank(dave);
        vault.pay(fourth, 10 * U, dates(DAY + 120), 10 * U);
        assertEq(outstanding(first) + outstanding(second) + outstanding(third) + outstanding(fourth), 0);
        assertEq(token.balanceOf(address(vault)), 10 * U);
        assertEq(vault.balanceOf(glass, DAY + 120), 10 * U);
        (address owner,, uint32 start, uint32 end,) = vault.entitlements(eid);
        assertEq(owner, dave);
        assertEq(start, DAY + 91);
        assertEq(end, DAY + 120);
    }

    function testPayThirtyTwoBucketsSucceeds() public {
        uint256[] memory ds = new uint256[](32);
        for (uint32 i; i < 32; ++i) {
            ds[i] = DAY + 1 + i;
            issueTo(bob, U, uint32(ds[i]));
        }
        bytes32 id = invoice(carol, bob, 32 * U, DAY + 32);
        vm.prank(bob);
        vault.pay(id, 32 * U, ds);
        assertEq(outstanding(id), 0);
        assertEq(vault.datesOf(bob, 0, 32).length, 0);
    }

    function testSpotExtendThirtyThreeBucketsRollsBack() public {
        for (uint32 i; i < 33; ++i) {
            issueTo(bob, U, DAY - i);
        }
        vm.prank(bob);
        vm.expectRevert(CascadeVault.TooManyBuckets.selector);
        vault.extend(33 * U, DAY, DAY + 90);
        assertEq(vault.balanceOf(bob, DAY + 90), 0);
        assertEq(vault.entitlementCount(), 33);
    }

    function testPayAndTransferReceiverCannotReenter() public {
        Receiver receiver = new Receiver(vault);
        issueTo(bob, 3 * U, DAY);
        bytes32 id = receiver.register(bob, U, DAY);
        vm.prank(bob);
        vault.pay(id, U, dates(DAY));
        assertFalse(receiver.reentered());
        vm.prank(bob);
        vault.safeTransferFrom(bob, address(receiver), DAY, U, "");
        assertFalse(receiver.reentered());
        receiver.setReject(true);
        bytes32 rejected = receiver.register(bob, U, DAY);
        vm.prank(bob);
        vm.expectRevert();
        vault.pay(rejected, U, dates(DAY));
        assertEq(outstanding(rejected), U);
        assertEq(vault.balanceOf(bob, DAY), U);
    }

    function testClaimAndExtendReceiverCannotReenter() public {
        Receiver receiver = new Receiver(vault);
        token.mint(address(receiver), U);
        receiver.execute(
            address(token), abi.encodeWithSignature("approve(address,uint256)", address(vault), U)
        );
        bytes32 id = invoice(bob, address(receiver), U, DAY + 1);
        receiver.execute(address(vault), abi.encodeCall(vault.issue, (id, U)));
        advance(1, 1e16);
        receiver.execute(address(vault), abi.encodeCall(vault.claim, (1)));
        assertTrue(receiver.attempted());
        assertFalse(receiver.reentered());
        // Keep some spot during the extension callback so an unguarded withdrawal could succeed.
        receiver.execute(address(vault), abi.encodeCall(vault.extend, (U / 200, DAY + 1, DAY + 2)));
        assertFalse(receiver.reentered());
        assertEq(vault.balanceOf(address(receiver), DAY + 1), U / 200);
    }

    function testPayCallerOrderSurvivesMidnight() public {
        issueTo(bob, 2 * U, DAY);
        issueTo(bob, 2 * U, DAY + 1);
        bytes32 id = invoice(carol, bob, 4 * U, DAY + 1);
        uint256[] memory ds = new uint256[](2);
        ds[0] = DAY + 1;
        ds[1] = DAY;
        vm.prank(bob);
        vault.pay(id, U, ds, 4 * U);
        vm.warp(uint256(DAY + 1) * 1 days);
        vm.prank(bob);
        vault.pay(id, 3 * U, ds, 3 * U);
        assertEq(outstanding(id), 0);
        assertEq(vault.balanceOf(carol, DAY), 2 * U);
    }

    function testSelectedSpotSkipsDustAndExtends() public {
        for (uint32 i = 1; i <= 40; ++i) {
            issueTo(bob, 1, DAY - i);
        }
        issueTo(bob, 10 * U, DAY);
        vm.startPrank(bob);
        vm.expectRevert(CascadeVault.TooManyBuckets.selector);
        vault.withdraw(U);
        vault.withdraw(2 * U, dates(DAY));
        uint256 eid = vault.extendSpot(3 * U, DAY + 10, dates(DAY));
        vm.stopPrank();
        (address account, uint256 amount, uint32 start, uint32 end,) = vault.entitlements(eid);
        assertEq(account, bob);
        assertEq(amount, 3 * U);
        assertEq(start, DAY + 1);
        assertEq(end, DAY + 10);
        assertEq(vault.balanceOf(bob, DAY), 5 * U);
        assertEq(vault.earliestDate(bob), DAY - 40);
        assertEq(token.balanceOf(bob), 2 * U);
    }

    function testSelectedSpotValidationAndAtomicity() public {
        issueTo(bob, 3 * U, DAY);
        uint256[] memory ds = new uint256[](2);
        ds[0] = DAY;
        ds[1] = DAY;
        vm.startPrank(bob);
        vm.expectRevert(CascadeVault.InvalidDates.selector);
        vault.withdraw(U, ds);
        vm.expectRevert(CascadeVault.InvalidDates.selector);
        vault.extendSpot(U, DAY + 1, ds);
        ds[1] = DAY + 1;
        vm.expectRevert(CascadeVault.InvalidDate.selector);
        vault.withdraw(U, ds); // Unused trailing future ID must still fail.
        vm.expectRevert(CascadeVault.InvalidDate.selector);
        vault.extendSpot(U, DAY + 2, ds);
        vm.expectRevert(CascadeVault.InvalidDates.selector);
        vault.withdraw(U, new uint256[](0));
        vm.expectRevert(CascadeVault.TooManyBuckets.selector);
        vault.extendSpot(U, DAY + 1, new uint256[](33));
        vm.expectRevert(CascadeVault.InsufficientSpot.selector);
        vault.withdraw(4 * U, dates(DAY));
        vm.expectRevert(CascadeVault.InvalidAmount.selector);
        vault.withdraw(0, dates(DAY));
        vm.expectRevert(CascadeVault.InvalidDate.selector);
        vault.extendSpot(U, DAY, dates(DAY));
        vm.stopPrank();
        assertEq(vault.balanceOf(bob, DAY), 3 * U);
        assertEq(vault.totalSupply(), 3 * U);
    }

    function testExplicitSpotExtensionAcrossMidnight() public {
        issueTo(bob, 3 * U, DAY);
        advance(1, 0);
        vm.prank(bob);
        vault.extendSpot(U, DAY + 10);
        vm.prank(bob);
        vault.extendSpot(U, DAY + 10, dates(DAY));
        assertEq(vault.balanceOf(bob, DAY + 10), 2 * U);
    }

    function testSelectedThirtyTwoBucketsAndThirtyThreeRejected() public {
        uint256[] memory ds = new uint256[](32);
        for (uint32 i; i < 32; ++i) {
            issueTo(bob, 2 * U, DAY - i);
            ds[i] = DAY - i;
        }
        vm.startPrank(bob);
        vm.expectRevert(CascadeVault.TooManyBuckets.selector);
        vault.withdraw(U, new uint256[](33));
        vault.withdraw(32 * U, ds);
        vault.extendSpot(32 * U, DAY + 1, ds);
        vm.stopPrank();
        assertEq(token.balanceOf(bob), 32 * U);
        assertEq(vault.balanceOf(bob, DAY + 1), 32 * U);
    }

    function testFuzzPersistentInvoiceMixedSettlement(uint96 seed) public {
        issueTo(bob, 30 * U, DAY);
        token.mint(bob, 30 * U);
        vm.prank(bob);
        token.approve(address(vault), type(uint256).max);
        bytes32 id = invoice(carol, bob, 30 * U, DAY + 5);
        uint256 left = 30 * U;
        for (uint256 i; i < 12 && left != 0; ++i) {
            uint256 amount = 1 + uint256(keccak256(abi.encode(seed, i))) % left;
            vm.startPrank(bob);
            if (i % 2 == 0) {
                vault.issue(id, amount);
            } else {
                vault.pay(id, amount, dates(DAY), left);
                vm.expectRevert(CascadeVault.InvoiceBalanceChanged.selector);
                vault.pay(id, amount, dates(DAY), left);
            }
            vm.stopPrank();
            left -= amount;
            assertEq(outstanding(id), left);
        }
        if (left != 0) {
            vm.prank(bob);
            vault.pay(id, left, dates(DAY), left);
        }
        assertEq(outstanding(id), 0);
        assertEq(vault.balanceOf(carol, DAY) + vault.balanceOf(carol, DAY + 5), 30 * U);
    }

    function testHostileBatchReceiverRollsBackInvoiceAndHeaps() public {
        Receiver receiver = new Receiver(vault);
        issueTo(bob, U, DAY);
        issueTo(bob, U, DAY - 1);
        bytes32 id = receiver.register(bob, 2 * U, DAY);
        receiver.configure("", true);
        uint256[] memory ds = new uint256[](2);
        ds[0] = DAY;
        ds[1] = DAY - 1;
        vm.prank(bob);
        vm.expectRevert();
        vault.pay(id, 2 * U, ds, 2 * U);
        assertEq(outstanding(id), 2 * U);
        assertEq(vault.balanceOf(bob, DAY), U);
        assertEq(vault.datesOf(address(receiver), 0, 32).length, 0);
        assertEq(vault.earliestDate(bob), DAY - 1);
    }

    function testHostileSpotExtensionReceiverRejectsAndCannotReenterSelectedWithdrawal() public {
        Receiver receiver = new Receiver(vault);
        issueTo(address(receiver), 2 * U, DAY);
        uint256 count = vault.entitlementCount();
        bytes memory extension =
            abi.encodeWithSignature("extendSpot(uint256,uint32,uint256[])", U, DAY + 1, dates(DAY));
        receiver.configure("", true);
        vm.expectRevert();
        receiver.execute(address(vault), extension);
        assertEq(vault.entitlementCount(), count);
        assertEq(vault.balanceOf(address(receiver), DAY), 2 * U);
        receiver.configure(abi.encodeWithSignature("withdraw(uint256,uint256[])", U, dates(DAY)), false);
        receiver.execute(address(vault), extension);
        assertTrue(receiver.attempted());
        assertFalse(receiver.reentered());
        assertEq(vault.balanceOf(address(receiver), DAY), U);
        assertEq(token.balanceOf(address(receiver)), 0);
    }
}
