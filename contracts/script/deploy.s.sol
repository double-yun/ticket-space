// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/Ticket.sol";

contract Deploy is Script {
    function run() external {
        vm.startBroadcast();
        TicketSBT ticket = new TicketSBT("EventTicket", "TKT", "https://api.example.com/metadata/");
        console2.log("TicketSBT contract deployed at:", address(ticket));
        vm.stopBroadcast();
    }
}