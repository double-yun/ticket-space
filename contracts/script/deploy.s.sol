// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/Tix.sol";

contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address signer = vm.envAddress("SIGNER_ADDR");
        address fee = vm.envAddress("FEE_ADDR");

        vm.startBroadcast(pk);
        Tix t = new Tix(signer, fee);
        console2.log("Tix:", address(t));
        vm.stopBroadcast();
    }
}
