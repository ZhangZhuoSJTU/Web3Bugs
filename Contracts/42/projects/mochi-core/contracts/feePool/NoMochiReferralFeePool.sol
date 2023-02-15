// SPDX-License-Identifier: AGPL-3.0

pragma solidity ^0.8.0;

import "../interfaces/IMochiEngine.sol";
import "../interfaces/IReferralFeePool.sol";

contract NoMochiReferralFeePool is IReferralFeePool {
    IMochiEngine public immutable engine;

    uint256 public rewards;

    mapping(address => uint256) public reward;

    constructor(address _engine) {
        engine = IMochiEngine(_engine);
    }

    function addReward(address _recipient) external override {
        uint256 newReward = engine.usdm().balanceOf(address(this)) - rewards;
        reward[_recipient] += newReward;
        rewards += newReward;
    }

    function claimReward() external {
        engine.usdm().transfer(msg.sender, reward[msg.sender]);
        rewards -= reward[msg.sender];
        reward[msg.sender] = 0;
    }
}
