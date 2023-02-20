// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "@openzeppelin/contracts-0.6/utils/Address.sol";
import "@openzeppelin/contracts-0.6/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-0.6/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts-0.6/math/SafeMath.sol";


/**
 * @title   RewardHook
 * @author  ConvexFinance
 * @notice  Example Reward hook for stash
 * @dev     ExtraRewardStash contracts call this hook if it is set. This hook
 *          can be used to pull rewards during a claim. For example pulling
 *          rewards from master chef.
 */
contract RewardHook{
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;


    address public immutable stash;
    address public immutable rewardToken;


    /**
     * @param _stash    Address of the reward stash
     * @param _reward   Reward token
     */
    constructor(address _stash, address _reward) public {
        stash = _stash;
        rewardToken = _reward;
    }


    /**
     * @dev Called when claimRewards is called in ExtraRewardStash can implement
     *      logic to pull rewards i.e from a master chef contract. This is just an example
     *      and assumes rewards are just sent directly to this hook contract
     */
    function onRewardClaim() external{

        //get balance
        uint256 bal = IERC20(rewardToken).balanceOf(address(this));

        //send
        IERC20(rewardToken).safeTransfer(stash,bal);
    }
}
