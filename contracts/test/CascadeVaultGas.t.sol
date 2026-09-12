// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {Test} from "forge-std/Test.sol";
import {CascadeVault} from "../src/CascadeVault.sol";
import {MockUSDC} from "./MockUSDC.sol";

/// @notice Fixed 10-USDC, single-bucket, EOA benchmarks. Run with --gas-report --isolate.
contract CascadeVaultGasTest is Test {
    CascadeVault vault;
    MockUSDC token;
    address alice = address(0xa11ce);
    address bob = address(0xb0b);
    address carol = address(0xca401);
    bytes32 issueInvoice;
    bytes32 payInvoice;
    uint32 constant DAY = 20_000;
    uint256 constant AMOUNT = 10e6;

    function setUp() public {
        vm.warp(uint256(DAY) * 1 days);
        token = new MockUSDC();
        vault = new CascadeVault(address(token), address(this));
        token.mint(alice, 100e6);
        vm.prank(alice);
        token.approve(address(vault), type(uint256).max);
        token.mint(address(this), 100e6);
        token.approve(address(vault), type(uint256).max);
        vm.prank(bob);
        bytes32 first = vault.registerInvoice(alice, AMOUNT, DAY + 90);
        vm.prank(alice);
        vault.issue(first, AMOUNT);
        vm.prank(bob);
        bytes32 second = vault.registerInvoice(alice, AMOUNT, DAY + 1);
        vm.prank(alice);
        vault.issue(second, AMOUNT);
        vm.warp(block.timestamp + 1 days);
        vault.checkpoint(1e16);
        vm.prank(carol);
        issueInvoice = vault.registerInvoice(alice, AMOUNT, DAY + 90);
        vm.prank(carol);
        payInvoice = vault.registerInvoice(bob, AMOUNT, DAY + 90);
    }

    function testGasIssue() public {
        vm.prank(alice);
        vault.issue(issueInvoice, AMOUNT);
    }

    function testGasPay() public {
        uint256[] memory ds = new uint256[](1);
        ds[0] = DAY + 90;
        vm.prank(bob);
        vault.pay(payInvoice, AMOUNT, ds, AMOUNT);
    }

    function testGasExtend() public {
        vm.prank(bob);
        vault.extend(AMOUNT, DAY + 90, DAY + 120);
    }

    function testGasClaim() public {
        vm.prank(alice);
        vault.claim(2);
    }
}
