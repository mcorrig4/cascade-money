// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {Test} from "forge-std/Test.sol";
import {CascadeVault} from "../src/CascadeVault.sol";
import {CascadeVaultUSYC} from "../src/CascadeVaultUSYC.sol";
import {MockUSYC} from "../src/mocks/MockUSYC.sol";
import {TestUSDC as MockUSDC} from "./MockUSDC.sol";

contract USYCTest is Test {
    MockUSDC usdc;
    MockUSYC asset;
    CascadeVaultUSYC vault;
    address alice = address(0xa);
    address bob = address(0xb);
    uint32 constant DAY = 20_000;

    function setUp() public {
        vm.warp(uint256(DAY) * 1 days);
        usdc = new MockUSDC();
        asset = new MockUSYC(address(usdc), address(this));
        vault = new CascadeVaultUSYC(asset, address(this), 0);
        usdc.mint(address(asset), 1_000e6);
        asset.mint(alice, 100e6);
        vm.prank(alice);
        asset.approve(address(vault), type(uint256).max);
    }

    function issue(uint256 amount, uint32 maturity) private returns (uint256 eid) {
        vm.prank(bob);
        bytes32 id = vault.registerInvoice(alice, amount, maturity);
        vm.prank(alice);
        eid = vault.issue(id, amount);
    }

    function advance(uint256 price) private {
        vm.warp(block.timestamp + 1 days);
        asset.setPrice(price);
        vault.checkpoint();
    }

    function testPriceIncreaseDerivesIndexAndCapitalFlowsAreNotYield() public {
        issue(10e6, DAY + 3);
        advance(1e18);
        assertEq(vault.indexAt(DAY + 1), 1e18);
        issue(10e6, DAY + 3);
        advance(11e17);
        assertEq(vault.indexAt(DAY + 2), 11e17);
        assertEq(vault.accruedScaled(), 2e6 * 1e18);
        (uint256 b, uint256 p, uint256 y,, uint256 deficit) = vault.balanceSheet();
        assertEq(b, 22e6);
        assertEq(p, 20e6);
        assertEq(y, 2e6);
        assertEq(deficit, 0);
        vm.expectRevert(CascadeVault.InvalidTerms.selector);
        vault.checkpoint(1e18);
    }

    function testExtendClaimPaysOnlyAddedIntervalAndWithdrawsShares() public {
        uint256 original = issue(10e6, DAY + 2);
        advance(11e17);
        vm.prank(bob);
        uint256 added = vault.extend(10e6, DAY + 2, DAY + 4);
        advance(12e17);
        vm.prank(alice);
        assertEq(vault.claim(original), 2e6);
        advance(13e17);
        advance(14e17);
        // The claim creates idle spot, so added-interval yield shares the 12-USDC denominator.
        vm.prank(bob);
        uint256 claimed = vault.claim(added);
        assertEq(claimed, 1_666_666);
        vm.prank(bob);
        vault.withdraw(10e6);
        assertEq(asset.balanceOf(bob), 7_142_857);
        assertEq(vault.totalSupply(), 3_666_666);
    }

    function testLossFreezesIndexAndPaymentsContinueUntilRecovery() public {
        uint256 eid = issue(10e6, DAY + 1);
        advance(11e17);
        advance(9e17);
        assertEq(vault.indexAt(DAY + 2), 11e17);
        (,,,, uint256 deficit) = vault.balanceSheet();
        assertEq(deficit, 2e6);
        vm.prank(alice);
        vm.expectRevert(CascadeVault.Underbacked.selector);
        vault.claim(eid);
        vm.prank(bob);
        vm.expectRevert(CascadeVault.Underbacked.selector);
        vault.withdraw(1e6);
        vm.prank(address(0xc));
        bytes32 id = vault.registerInvoice(bob, 1e6, DAY + 1);
        uint256[] memory ds = new uint256[](1);
        ds[0] = DAY + 1;
        vm.prank(bob);
        vault.pay(id, 1e6, ds);
        vm.prank(bob);
        vault.extendSpot(1e6, DAY + 5, ds);
        issue(1e6, DAY + 5);
        advance(1e18);
        assertEq(vault.indexAt(DAY + 3), 11e17);
        advance(11e17);
        (,,,, deficit) = vault.balanceSheet();
        assertEq(deficit, 0);
        vm.prank(alice);
        assertEq(vault.claim(eid), 1e6);
    }

    function testReserveAbsorbsLossAndFloorRepairsBeforeIndex() public {
        vault = new CascadeVaultUSYC(asset, address(this), 1e6);
        vm.prank(alice);
        asset.approve(address(vault), type(uint256).max);
        issue(10e6, DAY + 6);
        advance(11e17);
        assertEq(vault.indexAt(DAY + 1), 1e18);
        advance(105e16);
        (,,, uint256 reserve, uint256 deficit) = vault.balanceSheet();
        assertEq(reserve, 500_000);
        assertEq(deficit, 0);
        advance(11e17);
        assertEq(vault.indexAt(DAY + 3), 1e18);
        advance(12e17);
        assertEq(vault.indexAt(DAY + 4), 11e17);
    }

    function testTellerBuySellOwnerAndInsufficientLiquidityAtomicity() public {
        usdc.mint(alice, 10e6);
        vm.startPrank(alice);
        usdc.approve(address(asset), 10e6);
        assertEq(asset.buy(10e6), 10e6);
        assertEq(asset.sell(10e6), 10e6);
        vm.expectRevert();
        asset.setPrice(2e18);
        vm.expectRevert();
        asset.mint(alice, 1);
        vm.stopPrank();
        vm.expectRevert();
        asset.setPrice(0);
        usdc.burn(address(asset), usdc.balanceOf(address(asset)));
        vm.prank(alice);
        vm.expectRevert();
        asset.sell(1e6);
        assertEq(asset.balanceOf(alice), 100e6);
    }

    function testLiquidityShortfallBlocksClaimsEvenWithSolventPrice() public {
        uint256 id = issue(10e6, DAY + 1);
        advance(11e17);
        usdc.burn(address(asset), usdc.balanceOf(address(asset)));
        vm.prank(alice);
        vm.expectRevert(CascadeVault.Underbacked.selector);
        vault.claim(id);
        vm.prank(bob);
        vm.expectRevert(CascadeVault.Underbacked.selector);
        vault.withdraw(1e6);
    }

    function testClaimedYieldSurvivesLossAndFlatPriceWithdrawalIsNotIncome() public {
        uint256 id = issue(10e6, DAY + 1);
        advance(11e17);
        vm.prank(alice);
        vault.claim(id);
        assertEq(vault.balanceOf(alice, DAY + 1), 1e6);
        vm.prank(bob);
        vault.withdraw(1e6);
        advance(11e17);
        assertEq(vault.indexAt(DAY + 2), 11e17);
        advance(9e17);
        assertEq(vault.balanceOf(alice, DAY + 1), 1e6);
        assertEq(vault.totalSupply(), 10e6);
        vm.prank(address(0xd));
        vm.expectRevert(CascadeVault.Unauthorized.selector);
        vault.checkpoint();
    }
}
