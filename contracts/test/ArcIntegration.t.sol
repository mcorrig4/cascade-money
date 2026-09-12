// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {Test} from "forge-std/Test.sol";
import {Deploy} from "../script/Deploy.s.sol";
import {TestUSDC as MockUSDC} from "./MockUSDC.sol";

/// @notice Offline deployment guard tests. These never connect to the Arc RPC or sign transactions.
contract ArcIntegrationTest is Test {
    Deploy deployment;
    MockUSDC token;

    function setUp() public {
        deployment = new Deploy();
        token = new MockUSDC();
        vm.chainId(5042002);
    }

    function testDeploymentPreflightAcceptsExpectedChainAndSixDecimals() public view {
        deployment.preflight(5042002, address(token));
    }

    function testDeploymentPreflightRejectsWrongChain() public {
        vm.expectRevert("chain mismatch");
        deployment.preflight(1, address(token));
    }

    function testDeploymentPreflightRejectsMissingToken() public {
        vm.expectRevert("USDC code missing");
        deployment.preflight(5042002, address(0x1234));
    }

    function testDeploymentPreflightRejectsWrongDecimals() public {
        vm.mockCall(address(token), abi.encodeWithSignature("decimals()"), abi.encode(uint256(18)));
        vm.expectRevert("USDC must use 6 decimals");
        deployment.preflight(5042002, address(token));
    }
}
