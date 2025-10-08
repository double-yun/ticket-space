// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

contract LotteryApplication is Ownable {
    using EnumerableSet for EnumerableSet.AddressSet;

    struct Lottery {
        uint256 eventId;
        uint256 deadline;
        bytes32 resultHash;
    }

    mapping(uint256 => Lottery) internal lotteries;
    mapping(uint256 => EnumerableSet.AddressSet) private applicantsByEvent;

    event ApplicationSubmitted(uint256 indexed eventId, address indexed applicant);
    event DrawResultUpdated(uint256 indexed eventId, bytes32 resultHash);

    error InvalidEventId();
    error ApplicationPeriodClosed();
    error AlreadySubmitted();
    error ResultAlreadySet();

    constructor() Ownable(msg.sender) {}

    function createLottery(uint256 eventId, uint256 deadline) external onlyOwner {
        if (lotteries[eventId].deadline != 0) revert InvalidEventId();
        lotteries[eventId].eventId = eventId;
        lotteries[eventId].deadline = deadline;
    }

    function submitApplication(uint256 eventId) external {
        Lottery storage lottery = lotteries[eventId];
        if (lottery.deadline == 0) revert InvalidEventId();
        if (block.timestamp > lottery.deadline) revert ApplicationPeriodClosed();
        
        bool added = applicantsByEvent[eventId].add(msg.sender);
        if (!added) revert AlreadySubmitted();

        emit ApplicationSubmitted(eventId, msg.sender);
    }

    function hasApplied(uint256 eventId, address applicant) external view returns (bool) {
        if (lotteries[eventId].deadline == 0) revert InvalidEventId();
        return applicantsByEvent[eventId].contains(applicant);
    }

    function getLottery(uint256 eventId) external view returns (uint256, uint256, bytes32) {
        Lottery storage lottery = lotteries[eventId];
        return (lottery.eventId, lottery.deadline, lottery.resultHash);
    }

    function getApplicants(uint256 eventId) external view returns (address[] memory) {
        if (lotteries[eventId].deadline == 0) revert InvalidEventId();
        return applicantsByEvent[eventId].values();
    }

    function getApplicantsCount(uint256 eventId) external view returns (uint256) {
        if (lotteries[eventId].deadline == 0) revert InvalidEventId();
        return applicantsByEvent[eventId].length();
    }

    function setDrawResult(uint256 eventId, bytes32 resultHash) external onlyOwner {
        if (lotteries[eventId].deadline == 0) revert InvalidEventId();
        if (lotteries[eventId].resultHash != bytes32(0)) revert ResultAlreadySet();
        lotteries[eventId].resultHash = resultHash;
        emit DrawResultUpdated(eventId, resultHash);
    }
}