// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import {Test, console} from "forge-std/Test.sol";
import {LotteryApplication} from "../src/LotteryApplication.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract LotteryApplicationTest is Test {
    LotteryApplication public lotteryApp;
    uint256 public eventId = 1;
    uint256 public deadline;

    address public owner;
    address public user1 = address(0x1);
    address public user2 = address(0x2);

    function setUp() public {
        owner = vm.addr(100);
        vm.startPrank(owner);
        lotteryApp = new LotteryApplication();
        vm.stopPrank();

        deadline = block.timestamp + 1 days;
    }

    function test_CreateLottery() public {
        vm.startPrank(owner);
        lotteryApp.createLottery(eventId, deadline);
        vm.stopPrank();

        (uint256 _eventId, uint256 _deadline, ) = lotteryApp.getLottery(eventId);
        assertEq(_eventId, eventId);
        assertEq(_deadline, deadline);
    }

    function test_Fail_CreateLottery_NotOwner() public {
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, user1));
        lotteryApp.createLottery(eventId, deadline);
    }

    function test_SubmitApplication() public {
        // Setup: create a lottery
        vm.startPrank(owner);
        lotteryApp.createLottery(eventId, deadline);
        vm.stopPrank();

        // Test: user1 applies
        vm.prank(user1);
        lotteryApp.submitApplication(eventId);

        address[] memory applicants = lotteryApp.getApplicants(eventId);
        assertEq(applicants.length, 1);
        assertEq(applicants[0], user1);
    }

    function test_Fail_SubmitApplication_Twice() public {
        // Setup: create a lottery and user1 applies
        vm.startPrank(owner);
        lotteryApp.createLottery(eventId, deadline);
        vm.stopPrank();
        vm.prank(user1);
        lotteryApp.submitApplication(eventId);

        // Test: user1 tries to apply again
        vm.prank(user1);
        vm.expectRevert(LotteryApplication.AlreadySubmitted.selector);
        lotteryApp.submitApplication(eventId);
    }

    function test_Fail_SubmitApplication_AfterDeadline() public {
        uint256 specificEventId = 99;
        uint256 futureDeadline = block.timestamp + 100;

        // Setup: create a lottery with a future deadline
        vm.startPrank(owner);
        lotteryApp.createLottery(specificEventId, futureDeadline);
        vm.stopPrank();

        // Move time to after the deadline
        vm.warp(futureDeadline + 1);

        // Test: user1 tries to apply
        vm.prank(user1);
        vm.expectRevert(LotteryApplication.ApplicationPeriodClosed.selector);
        lotteryApp.submitApplication(specificEventId);
    }

    function test_SetDrawResult() public {
        // Setup: create a lottery
        vm.startPrank(owner);
        lotteryApp.createLottery(eventId, deadline);
        vm.stopPrank();

        // Test: owner sets the result hash
        bytes32 resultHash = keccak256(abi.encodePacked("result"));
        vm.startPrank(owner);
        lotteryApp.setDrawResult(eventId, resultHash);
        vm.stopPrank();

        (,, bytes32 _resultHash) = lotteryApp.getLottery(eventId);
        assertEq(_resultHash, resultHash);
    }

    function test_Fail_SetDrawResult_NotOwner() public {
        // Setup: create a lottery
        vm.startPrank(owner);
        lotteryApp.createLottery(eventId, deadline);
        vm.stopPrank();

        // Test: user1 tries to set the result hash
        bytes32 resultHash = keccak256(abi.encodePacked("result"));
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, user1));
        lotteryApp.setDrawResult(eventId, resultHash);
    }

    function test_GetApplicants() public {
        // Setup: create a lottery and have user1 and user2 apply
        vm.startPrank(owner);
        lotteryApp.createLottery(eventId, deadline);
        vm.stopPrank();

        vm.prank(user1);
        lotteryApp.submitApplication(eventId);

        vm.prank(user2);
        lotteryApp.submitApplication(eventId);

        // Test: get applicants
        address[] memory applicants = lotteryApp.getApplicants(eventId);
        assertEq(applicants.length, 2);
        assertEq(applicants[0], user1);
        assertEq(applicants[1], user2);
        
        uint256 count = lotteryApp.getApplicantsCount(eventId);
        assertEq(count, 2);
    }
}
