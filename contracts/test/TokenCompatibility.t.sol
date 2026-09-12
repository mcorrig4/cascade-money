// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {Test} from "forge-std/Test.sol";
import {CascadeVault} from "../src/CascadeVault.sol";
import {MockUSDC} from "./MockUSDC.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract FalseReturnUSDC is MockUSDC {
    bool public fail;

    function setFail(bool value) external {
        fail = value;
    }

    function transfer(address to, uint256 amount) public override returns (bool) {
        super.transfer(to, amount);
        return !fail;
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        super.transferFrom(from, to, amount);
        return !fail;
    }
}

contract NoReturnUSDC is MockUSDC {
    function transfer(address to, uint256 amount) public override returns (bool) {
        super.transfer(to, amount);
        assembly ("memory-safe") { return(0, 0) }
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        super.transferFrom(from, to, amount);
        assembly ("memory-safe") { return(0, 0) }
    }
}

contract TokenCompatibilityTest is Test {
    address alice = address(0xa);
    address bob = address(0xb);

    function prepare(MockUSDC token) private returns (CascadeVault vault, bytes32 id) {
        vm.warp(20_000 days);
        vault = new CascadeVault(address(token), address(this));
        token.mint(alice, 100e6);
        token.mint(address(this), 100e6);
        assertTrue(token.approve(address(vault), type(uint256).max));
        vm.prank(alice);
        assertTrue(token.approve(address(vault), type(uint256).max));
        vm.prank(bob);
        id = vault.registerInvoice(alice, 10e6, 20_001);
    }

    function testFalseReturnRevertsEveryUSDCMovementAtomically() public {
        FalseReturnUSDC token = new FalseReturnUSDC();
        (CascadeVault vault, bytes32 id) = prepare(token);
        token.setFail(true);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(SafeERC20.SafeERC20FailedOperation.selector, address(token)));
        vault.issue(id, 10e6);
        assertEq(token.balanceOf(alice), 100e6);
        assertEq(vault.totalSupply(), 0);
        (,,, uint256 outstanding,,) = vault.invoices(id);
        assertEq(outstanding, 10e6);
        token.setFail(false);
        vm.prank(alice);
        vault.issue(id, 10e6);
        vm.warp(20_001 days);
        token.setFail(true);
        vm.expectRevert(abi.encodeWithSelector(SafeERC20.SafeERC20FailedOperation.selector, address(token)));
        vault.checkpoint(1e16);
        assertEq(vault.lastCheckpoint(), 20_000);
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(SafeERC20.SafeERC20FailedOperation.selector, address(token)));
        vault.withdraw(10e6);
        assertEq(vault.balanceOf(bob, 20_001), 10e6);
        uint256[] memory ds = new uint256[](1);
        ds[0] = 20_001;
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(SafeERC20.SafeERC20FailedOperation.selector, address(token)));
        vault.withdraw(10e6, ds);
        assertEq(token.balanceOf(address(vault)), 10e6);
    }

    function testNoReturnSupportsIssueCheckpointAndBothWithdrawals() public {
        NoReturnUSDC token = new NoReturnUSDC();
        (CascadeVault vault, bytes32 id) = prepare(token);
        vm.prank(alice);
        vault.issue(id, 10e6);
        vm.warp(20_001 days);
        vault.checkpoint(1e16);
        vm.prank(alice);
        assertEq(vault.claim(1), 100_000);
        vm.prank(bob);
        vault.withdraw(5e6);
        uint256[] memory ds = new uint256[](1);
        ds[0] = 20_001;
        vm.prank(bob);
        vault.withdraw(5e6, ds);
        assertEq(token.balanceOf(bob), 10e6);
        assertEq(vault.totalSupply(), 100_000);
    }
}
