//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;
pragma abicoder v1;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract TreasuryVester {
    using SafeERC20 for IERC20;

    address public unionToken;
    address public recipient;
    uint256 public vestingAmount;
    uint256 public vestingBegin;
    uint256 public vestingCliff;
    uint256 public vestingEnd;
    uint256 public lastUpdate;

    constructor(
        address unionToken_,
        address recipient_,
        uint256 vestingAmount_,
        uint256 vestingBegin_,
        uint256 vestingCliff_,
        uint256 vestingEnd_
    ) {
        require(vestingBegin_ >= block.timestamp, "vesting begin too early");
        require(vestingCliff_ >= vestingBegin_, "cliff is too early");
        require(vestingEnd_ > vestingCliff_, "end is too early");

        unionToken = unionToken_;
        recipient = recipient_;
        vestingAmount = vestingAmount_;
        vestingBegin = vestingBegin_;
        vestingCliff = vestingCliff_;
        vestingEnd = vestingEnd_;
        lastUpdate = vestingBegin;
    }

    function claim() public {
        require(block.timestamp >= vestingCliff, "not time yet");
        uint256 amount;
        if (block.timestamp >= vestingEnd) {
            amount = IERC20(unionToken).balanceOf(address(this));
        } else {
            amount = (vestingAmount * (block.timestamp - lastUpdate)) / (vestingEnd - vestingBegin);
            lastUpdate = block.timestamp;
        }
        IERC20(unionToken).safeTransfer(recipient, amount);
    }
}
