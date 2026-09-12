// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {Test} from "forge-std/Test.sol";
import {CascadeVault} from "../src/CascadeVault.sol";
import {TestUSDC as MockUSDC} from "./MockUSDC.sol";

contract FragmentedGasTest is Test {
    CascadeVault vault;
    address holder = address(0xb);
    address creditor = address(0xc);
    bytes32 invoice;

    function setUp() public {
        vm.warp(20_000 days);
        MockUSDC token = new MockUSDC();
        vault = new CascadeVault(address(token), address(this));
        token.mint(address(this), 1e12);
        token.approve(address(vault), type(uint256).max);
        for (uint32 i; i < 1024; ++i) {
            vm.prank(holder);
            bytes32 id = vault.registerInvoice(address(this), 1e6, 18_976 + i);
            vault.issue(id, 1e6);
        }
        vm.prank(creditor);
        invoice = vault.registerInvoice(holder, 32e6, 20_000);
    }

    function selected() private pure returns (uint256[] memory ds) {
        ds = new uint256[](32);
        for (uint256 i; i < 32; ++i) {
            ds[i] = 19_999 - i;
        }
    }

    function testGasFragmentedSelectedWithdraw32() public {
        vm.prank(holder);
        vault.withdraw(32e6, selected());
        assertEq(vault.earliestDate(holder), 18_976);
    }

    function testGasFragmentedConvenienceWithdraw32() public {
        vm.prank(holder);
        vault.withdraw(32e6);
        assertEq(vault.earliestDate(holder), 19_008);
    }

    function testGasFragmentedSelectedExtend32() public {
        vm.prank(holder);
        vault.extendSpot(32e6, 20_090, selected());
        assertEq(vault.balanceOf(holder, 20_090), 32e6);
    }

    function testGasFragmentedPay32() public {
        vm.prank(holder);
        vault.pay(invoice, 32e6, selected(), 32e6);
        assertEq(vault.balanceOf(creditor, 19_999), 1e6);
    }
}
