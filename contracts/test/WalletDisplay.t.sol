// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {Test} from "forge-std/Test.sol";
import {CascadeVault} from "../src/CascadeVault.sol";
import {DateMetadata} from "../src/DateMetadata.sol";
import {DatedDollarERC20} from "../src/DatedDollarERC20.sol";
import {TestUSDC as MockUSDC} from "./MockUSDC.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";

contract WalletDisplayTest is Test {
    CascadeVault vault;
    address alice = address(0xa);
    address bob = address(0xb);
    uint32 constant DATE = 20_795; // 2026-12-08

    function setUp() public {
        vm.warp(uint256(DATE - 90) * 1 days);
        MockUSDC token = new MockUSDC();
        vault = new CascadeVault(address(token), address(this));
        token.mint(address(this), 100e6);
        token.approve(address(vault), type(uint256).max);
    }

    function issue(uint32 date, uint256 amount) private {
        vm.prank(alice);
        bytes32 id = vault.registerInvoice(address(this), amount, date);
        vault.issue(id, amount);
    }

    function decode(string memory input, uint256 skip) private pure returns (string memory) {
        bytes memory data = bytes(input);
        bytes memory alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        bytes memory output = new bytes((data.length - skip) * 3 / 4);
        uint256 acc;
        uint256 bits;
        uint256 n;
        for (uint256 i = skip; i < data.length && data[i] != "="; ++i) {
            uint256 value;
            while (alphabet[value] != data[i]) {
                ++value;
            }
            acc = (acc << 6) | value;
            bits += 6;
            if (bits >= 8) {
                bits -= 8;
                output[n++] = bytes1(uint8(acc >> bits));
            }
        }
        assembly ("memory-safe") { mstore(output, n) }
        return string(output);
    }

    function testMetadataDateAndDynamicMaturity() public {
        DateMetadata renderer = vault.metadata();
        assertEq(renderer.isoDate(0), "1970-01-01");
        assertEq(renderer.isoDate(DATE), "2026-12-08");
        assertEq(renderer.isoDate(19_782), "2024-02-29");
        string memory json = decode(vault.uri(DATE), 29);
        assertEq(vm.parseJsonString(json, ".name"), "USD+90");
        assertEq(
            vm.parseJsonString(json, ".description"), "Cascade dated dollar. Maturity: 2026-12-08 (UTC)."
        );
        string memory svg = decode(vm.parseJsonString(json, ".image"), 26);
        assertTrue(bytes(svg).length > 400);
        assertTrue(contains(svg, "2026-12-08"));
        vm.warp(uint256(DATE) * 1 days);
        assertEq(vm.parseJsonString(decode(vault.uri(DATE), 29), ".name"), "USD spot");
    }

    function contains(string memory haystack, string memory needle) private pure returns (bool) {
        bytes memory h = bytes(haystack);
        bytes memory n = bytes(needle);
        for (uint256 i; i + n.length <= h.length; ++i) {
            bool match_ = true;
            for (uint256 j; j < n.length; ++j) {
                if (h[i + j] != n[j]) {
                    match_ = false;
                }
            }
            if (match_) {
                return true;
            }
        }
        return false;
    }

    function testCreate2ViewTracksBothLedgersAndFixedSymbol() public {
        assertEq(vault.viewFor(DATE), address(0));
        issue(DATE, 10e6);
        address predicted = Clones.predictDeterministicAddress(
            vault.viewImplementation(), bytes32(uint256(DATE)), address(vault)
        );
        assertEq(vault.viewFor(DATE), predicted);
        DatedDollarERC20 viewToken = DatedDollarERC20(predicted);
        assertEq(viewToken.name(), "Cascade USD 2026-12-08");
        assertEq(viewToken.symbol(), "USD+90");
        assertEq(viewToken.decimals(), 6);
        assertEq(viewToken.balanceOf(alice), 10e6);
        vm.prank(alice);
        assertTrue(viewToken.transfer(bob, 2e6));
        assertEq(vault.balanceOf(bob, DATE), 2e6);
        vm.prank(alice);
        vault.safeTransferFrom(alice, bob, DATE, 1e6, "");
        assertEq(viewToken.balanceOf(bob), 3e6);
        issue(DATE, 1e6);
        assertEq(vault.viewFor(DATE), predicted);
        assertEq(viewToken.totalSupply(), 11e6);
        vm.warp(uint256(DATE) * 1 days);
        assertEq(viewToken.symbol(), "USD+90");
        vm.prank(bob);
        vault.withdraw(3e6);
        assertEq(viewToken.totalSupply(), 8e6);
    }

    function testViewAllowanceCannotAuthorizeOtherDatesOrBypassLedger() public {
        issue(DATE, 10e6);
        issue(DATE + 1, 10e6);
        DatedDollarERC20 viewToken = DatedDollarERC20(vault.viewFor(DATE));
        vm.prank(alice);
        assertTrue(viewToken.approve(bob, 3e6));
        vm.prank(bob);
        assertTrue(viewToken.transferFrom(alice, bob, 2e6));
        assertEq(viewToken.allowance(alice, bob), 1e6);
        address otherDate = vault.viewFor(DATE + 1);
        vm.prank(bob);
        (bool ok,) = address(viewToken).call(abi.encodeCall(viewToken.transferFrom, (alice, bob, 2e6)));
        assertFalse(ok);
        vm.prank(bob);
        (ok,) = otherDate.call(abi.encodeCall(viewToken.transferFrom, (alice, bob, 1e6)));
        assertFalse(ok);
        vm.expectRevert(CascadeVault.Unauthorized.selector);
        vault.transferDate(DATE, alice, bob, 1e6);
        vm.expectRevert();
        viewToken.initialize(DATE, "bad", "bad");
        vm.prank(alice);
        (ok,) = address(viewToken).call(abi.encodeCall(viewToken.transfer, (address(0), 1)));
        assertFalse(ok);
        assertEq(viewToken.balanceOf(alice), 8e6);
    }

    function testViewTransferPreservesEntitlementAndEarlyMReverts() public {
        issue(DATE, 10e6);
        vm.prank(alice);
        uint256 entitlement = vault.extend(10e6, DATE, DATE + 10);
        DatedDollarERC20 later = DatedDollarERC20(vault.viewFor(DATE + 10));
        vm.prank(alice);
        assertTrue(later.transfer(bob, 10e6));
        (address account,,,,) = vault.entitlements(entitlement);
        assertEq(account, alice);
        vm.prank(address(0xc));
        bytes32 id = vault.registerInvoice(bob, 10e6, DATE);
        uint256[] memory dates = new uint256[](1);
        dates[0] = DATE + 10;
        vm.prank(bob);
        vm.expectRevert(CascadeVault.InvalidDate.selector);
        vault.pay(id, 10e6, dates);
    }

    function testSpotViewStartsWithFixedUSDPlusZeroSymbol() public {
        issue(DATE - 90, 1e6);
        DatedDollarERC20 viewToken = DatedDollarERC20(vault.viewFor(DATE - 90));
        assertEq(viewToken.symbol(), "USD+0");
        vm.warp(block.timestamp + 1 days);
        assertEq(viewToken.symbol(), "USD+0");
    }
}
