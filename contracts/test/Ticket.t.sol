// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import {Test, console} from "forge-std/Test.sol";
import {TicketSBT} from "../src/Ticket.sol";

contract TicketTest is Test {
    TicketSBT public ticketSBT;

    address public owner;
    address public user1 = address(0x1);
    uint256 public eventId = 100;

    function setUp() public {
        owner = vm.addr(100);
        vm.startPrank(owner);
        ticketSBT = new TicketSBT("Test Ticket", "TTKT", "");
        vm.stopPrank();
    }

    function test_MintWithEventId() public {
        vm.startPrank(owner);
        uint256 tokenId = ticketSBT.mint(user1, eventId);
        vm.stopPrank();

        assertEq(ticketSBT.ownerOf(tokenId), user1, "Owner should be user1");
        assertEq(ticketSBT.tokenIdToEventId(tokenId), eventId, "Event ID should be stored correctly");
    }

    function test_Fail_Mint_NotOwner() public {
        vm.prank(user1);
        vm.expectRevert(); // Expect any revert
        ticketSBT.mint(user1, eventId);
    }

    function test_Transfer_ShouldFail() public {
        vm.startPrank(owner);
        uint256 tokenId = ticketSBT.mint(user1, eventId);
        vm.stopPrank();

        vm.prank(user1);
        vm.expectRevert(TicketSBT.SoulBoundTokenTransferBlocked.selector);
        ticketSBT.transferFrom(user1, address(0x2), tokenId);
    }
}
