// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/LotteryApplication.sol";

contract DeployLottery is Script {
    function run() external returns (address) {
        vm.startBroadcast();
        LotteryApplication lottery = new LotteryApplication();
        console2.log("LotteryApplication contract deployed at:", address(lottery));
        vm.stopBroadcast();
        return address(lottery);
    }
}
