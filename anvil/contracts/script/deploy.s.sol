// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/Ticket.sol";

contract Deploy is Script {
    function run() external {
        vm.startBroadcast();
        Ticket ticket = new Ticket();
        console2.log("Ticket contract deployed at:", address(ticket));
        vm.stopBroadcast();
    }
}
