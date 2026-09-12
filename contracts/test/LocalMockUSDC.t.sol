// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {Test} from "forge-std/Test.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {CascadeVault} from "../src/CascadeVault.sol";

contract LocalMockUSDCTest is Test {
    function testLocalMockIssueMatureWithdraw() public {
        MockUSDC token = new MockUSDC();
        assertEq(token.decimals(), 6);
        assertEq(token.name(), "Mock USDC");
        address apple = address(0xa);
        address samsung = address(0xb);
        vm.prank(address(0xc));
        token.mint(apple, 10e6);
        CascadeVault vault = new CascadeVault(address(token), apple);
        uint32 maturity = uint32(vault.today() + 1);
        vm.prank(samsung);
        bytes32 id = vault.registerInvoice(apple, 10e6, maturity);
        vm.startPrank(apple);
        assertTrue(token.approve(address(vault), 10e6));
        vault.issue(id, 10e6);
        vm.stopPrank();
        vm.warp(uint256(maturity) * 1 days);
        vm.prank(samsung);
        vault.withdraw(10e6);
        assertEq(token.balanceOf(samsung), 10e6);
        assertEq(token.totalSupply(), 10e6);
        assertEq(vault.totalSupply(), 0);
    }
}
