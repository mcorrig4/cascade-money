// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {CascadeVault} from "../src/CascadeVault.sol";

contract Deploy is Script {
    function preflight(uint256 expectedChain, address token) public view {
        require(expectedChain != 0 && block.chainid == expectedChain, "chain mismatch");
        require(token.code.length > 0, "USDC code missing");
        (bool ok, bytes memory result) = token.staticcall(abi.encodeWithSignature("decimals()"));
        require(ok && result.length == 32 && abi.decode(result, (uint256)) == 6, "USDC must use 6 decimals");
    }

    function run() external returns (CascadeVault vault) {
        string memory config = vm.readFile(vm.envString("ARC_CHAIN_CONFIG"));
        uint256 chainId = vm.parseJsonUint(config, ".chainId");
        address token = vm.parseJsonAddress(config, ".usdc");
        preflight(chainId, token); // Executed at deployment time, never during build.
        uint256 key = vm.envUint("ARC_DEPLOYER_KEY");
        address checkpointOwner = vm.addr(key);
        vm.startBroadcast(key);
        vault = new CascadeVault(token, checkpointOwner);
        vm.stopBroadcast();
        console2.log("CascadeVault", address(vault));
        console2.log("Checkpoint owner", checkpointOwner);
        console2.log("Chain", chainId);
    }
}
