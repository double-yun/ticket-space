// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import {Test, console} from "forge-std/Test.sol";
import {TicketSBT} from "../src/Ticket.sol";

contract TicketTest is Test {
    TicketSBT public ticketSBT;

    address public owner;
    address public user1 = address(0x1);
    uint256 public eventId = 100;
    bytes public encryptedKey = hex"1234567890abcdef";

    function setUp() public {
        owner = vm.addr(100);
        vm.startPrank(owner);
        ticketSBT = new TicketSBT("Test Ticket", "TTKT", "");
        vm.stopPrank();
    }

    function test_MintWithEventId() public {
        vm.startPrank(owner);
        uint256 tokenId = ticketSBT.mint(user1, eventId, encryptedKey);
        vm.stopPrank();

        assertEq(ticketSBT.ownerOf(tokenId), user1, "Owner should be user1");
        assertEq(ticketSBT.tokenIdToEventId(tokenId), eventId, "Event ID should be stored correctly");
        assertEq(ticketSBT.getEncryptedPublicKey(tokenId), encryptedKey, "Encrypted key should be stored");
        assertTrue(ticketSBT.locked(tokenId), "Token should be locked");
    }

    function test_Fail_Mint_NotOwner() public {
        vm.prank(user1);
        vm.expectRevert(); // Expect any revert
        ticketSBT.mint(user1, eventId, encryptedKey);
    }

    function test_Transfer_ShouldFail() public {
        vm.startPrank(owner);
        uint256 tokenId = ticketSBT.mint(user1, eventId, encryptedKey);
        vm.stopPrank();

        vm.prank(user1);
        vm.expectRevert(TicketSBT.SoulBoundTokenTransferBlocked.selector);
        ticketSBT.transferFrom(user1, address(0x2), tokenId);
    }

    function test_BurnDeletesData() public {
        vm.startPrank(owner);
        uint256 tokenId = ticketSBT.mint(user1, eventId, encryptedKey);
        ticketSBT.burn(tokenId);
        vm.stopPrank();

        vm.expectRevert(); // token no longer exists
        ticketSBT.ownerOf(tokenId);
        vm.expectRevert(); // locked should revert when token missing
        ticketSBT.locked(tokenId);
        vm.expectRevert();
        ticketSBT.getEncryptedPublicKey(tokenId);
    }

    function test_TotalSupplyIncrements() public {
        vm.startPrank(owner);
        ticketSBT.mint(user1, eventId, encryptedKey);
        ticketSBT.mint(user1, eventId + 1, encryptedKey);
        vm.stopPrank();

        assertEq(ticketSBT.totalSupply(), 2, "Total supply should track minted tokens");
    }
}
