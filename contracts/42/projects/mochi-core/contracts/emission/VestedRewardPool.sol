// SPDX-License-Identifier: AGPL-3.0

pragma solidity ^0.8.0;

import "../interfaces/IMochi.sol";
import "@mochifi/vmochi/contracts/interfaces/IVMochi.sol";

contract VestedRewardPool {
    IMochi public immutable mochi;
    IVMochi public immutable vMochi;

    uint256 public mochiUnderManagement;

    mapping(address => Vesting) public vesting;

    struct Vesting {
        uint256 vested;
        uint256 ends;
        uint256 claimable;
    }

    modifier checkClaimable(address recipient) {
        if (vesting[recipient].ends < block.timestamp) {
            vesting[recipient].claimable += vesting[recipient].vested;
            vesting[recipient].vested = 0;
            vesting[recipient].ends = 0;
        }
        _;
    }

    constructor(address _mochi, address _vmochi) {
        mochi = IMochi(_mochi);
        vMochi = IVMochi(_vmochi);
    }

    function vest(address _recipient) external checkClaimable(_recipient) {
        uint256 amount = mochi.balanceOf(address(this)) - mochiUnderManagement;
        uint256 weightedEnd = (vesting[_recipient].vested *
            vesting[_recipient].ends +
            amount *
            (block.timestamp + 90 days)) /
            (vesting[_recipient].vested + amount);
        vesting[_recipient].vested += amount;
        vesting[_recipient].ends = weightedEnd;
        mochiUnderManagement += amount;
    }

    function claim() external checkClaimable(msg.sender) {
        mochi.transfer(msg.sender, vesting[msg.sender].claimable);
        mochiUnderManagement -= vesting[msg.sender].claimable;
        vesting[msg.sender].claimable = 0;
    }

    function lock(uint256 _amount) external checkClaimable(msg.sender) {
        mochi.approve(address(vMochi), _amount);
        (, uint256 end) = vMochi.locked(msg.sender);
        if (end >= block.timestamp + 90 days) {
            vMochi.depositFor(msg.sender, _amount);
        } else {
            revert("lock should be longer than 90 days");
        }
        vesting[msg.sender].vested -= _amount;
        mochiUnderManagement -= _amount;
    }

    function forceClaim(uint256 _amount) external checkClaimable(msg.sender) {
        mochi.transfer(msg.sender, _amount / 2);
        mochi.transfer(address(vMochi), _amount / 2);
        vesting[msg.sender].vested -= _amount;
        mochiUnderManagement -= _amount;
    }
}
