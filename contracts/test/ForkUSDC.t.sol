// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {Test} from "forge-std/Test.sol";
import {CascadeVault} from "../src/CascadeVault.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract ForkUSDCIntegrationTest is Test {
    function testForkProxyIssueMatureWithdraw() public {
        // The standard runner requires fork.sh's verified local balance deal.
        vm.activeFork();
        assertEq(block.chainid, 5042002);
        address debtor = vm.parseJsonAddress(vm.readFile(".local/fork.json"), ".accounts[0]");
        IERC20 token = IERC20(0x3600000000000000000000000000000000000000);
        CascadeVault vault = new CascadeVault(address(token), debtor);
        address creditor = address(0xca5cade);
        uint256 beforeBalance = token.balanceOf(creditor);
        uint32 date = uint32(vault.today() + 1);
        vm.prank(creditor);
        bytes32 id = vault.registerInvoice(debtor, 10e6, date);
        vm.startPrank(debtor);
        assertTrue(token.approve(address(vault), 10e6));
        vault.issue(id, 10e6);
        vm.stopPrank();
        vm.warp(uint256(date) * 1 days);
        vm.prank(creditor);
        vault.withdraw(10e6);
        assertEq(token.balanceOf(creditor), beforeBalance + 10e6);
        assertEq(vault.totalSupply(), 0);
    }
}
