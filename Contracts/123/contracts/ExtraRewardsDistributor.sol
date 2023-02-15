// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import { IExtraRewardsDistributor, IAuraLocker } from "./Interfaces.sol";
import { IERC20 } from "@openzeppelin/contracts-0.8/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts-0.8/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts-0.8/security/ReentrancyGuard.sol";

/**
 * @title   ExtraRewardsDistributor
 * @author  adapted from ConvexFinance
 * @notice  Allows anyone to distribute rewards to the AuraLocker at a given epoch.
 */
contract ExtraRewardsDistributor is ReentrancyGuard, IExtraRewardsDistributor {
    using SafeERC20 for IERC20;

    IAuraLocker public immutable auraLocker;

    // token -> epoch -> amount
    mapping(address => mapping(uint256 => uint256)) public rewardData;
    // token -> epochList
    mapping(address => uint256[]) public rewardEpochs;
    // token -> account -> last claimed epoch index
    mapping(address => mapping(address => uint256)) public userClaims;

    /* ========== EVENTS ========== */

    event RewardAdded(address indexed token, uint256 indexed epoch, uint256 reward);
    event RewardPaid(address indexed user, address indexed token, uint256 reward, uint256 index);
    event RewardForfeited(address indexed user, address indexed token, uint256 index);

    /**
     * @dev Simple constructoor
     * @param _auraLocker Aura Locker address
     */
    constructor(address _auraLocker) {
        auraLocker = IAuraLocker(_auraLocker);
    }

    /* ========== ADD REWARDS ========== */

    /**
     * @notice Add a reward to the current epoch. can be called multiple times for the same reward token
     * @param _token    Reward token address
     * @param _amount   Amount of reward tokenπ
     */
    function addReward(address _token, uint256 _amount) external {
        auraLocker.checkpointEpoch();

        uint256 latestEpoch = auraLocker.epochCount() - 1;
        _addReward(_token, _amount, latestEpoch);
    }

    /**
     * @notice Add reward token to a specific epoch
     * @param _token    Reward token address
     * @param _amount   Amount of reward tokens to add
     * @param _epoch    Which epoch to add to (must be less than the previous epoch)
     */
    function addRewardToEpoch(
        address _token,
        uint256 _amount,
        uint256 _epoch
    ) external {
        auraLocker.checkpointEpoch();

        uint256 latestEpoch = auraLocker.epochCount() - 1;
        require(_epoch <= latestEpoch, "Cannot assign to the future");

        if (_epoch == latestEpoch) {
            _addReward(_token, _amount, latestEpoch);
        } else {
            uint256 len = rewardEpochs[_token].length;
            require(len == 0 || rewardEpochs[_token][len - 1] < _epoch, "Cannot backdate to this epoch");

            _addReward(_token, _amount, _epoch);
        }
    }

    /**
     * @notice  Transfer reward tokens from sender to contract for vlCVX holders
     * @dev     Add reward token for specific epoch
     * @param _token    Reward token address
     * @param _amount   Amount of reward tokens
     * @param _epoch    Epoch to add tokens to
     */
    function _addReward(
        address _token,
        uint256 _amount,
        uint256 _epoch
    ) internal nonReentrant {
        // Pull before reward accrual
        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);

        //convert to reward per token
        uint256 supply = auraLocker.totalSupplyAtEpoch(_epoch);
        uint256 rPerT = (_amount * 1e20) / supply;
        rewardData[_token][_epoch] += rPerT;

        //add epoch to list
        uint256 len = rewardEpochs[_token].length;
        if (len == 0 || rewardEpochs[_token][len - 1] < _epoch) {
            rewardEpochs[_token].push(_epoch);
        }

        //event
        emit RewardAdded(_token, _epoch, _amount);
    }

    /* ========== GET REWARDS ========== */

    /**
     * @notice Claim rewards for a specific token since the first epoch.
     * @param _account  Address of vlCVX holder
     * @param _token    Reward token address
     */
    function getReward(address _account, address _token) public {
        _getReward(_account, _token, 0);
    }

    /**
     * @notice Claim rewards for a specific token at a specific epoch
     * @param _account      Address of vlCVX holder
     * @param _token        Reward token address
     * @param _startIndex   Index of rewardEpochs[_token] to start checking for rewards from
     */
    function getReward(
        address _account,
        address _token,
        uint256 _startIndex
    ) public {
        _getReward(_account, _token, _startIndex);
    }

    /**
     * @notice Claim rewards for a specific token at a specific epoch
     * @param _account     Address of vlCVX holder
     * @param _token       Reward token address
     * @param _startIndex  Index of rewardEpochs[_token] to start checking for rewards from
     */
    function _getReward(
        address _account,
        address _token,
        uint256 _startIndex
    ) public {
        //get claimable tokens
        (uint256 claimableTokens, uint256 index) = _allClaimableRewards(_account, _token, _startIndex);

        if (claimableTokens > 0) {
            //set claim checkpoint
            userClaims[_token][_account] = index;

            //send
            IERC20(_token).safeTransfer(_account, claimableTokens);

            //event
            emit RewardPaid(_account, _token, claimableTokens, index);
        }
    }

    /**
     * @notice  Allow a user to set their claimed index forward without claiming rewards
     *          Because claims cycle through all periods that a specific reward was given
     *          there becomes a situation where, for example, a new user could lock
     *          2 years from now and try to claim a token that was given out every week prior.
     *          This would result in a 2mil gas checkpoint.(about 20k gas * 52 weeks * 2 years)
     * @param _token  Reward token to forfeit
     * @param _index  Epoch index to forfeit from
     */
    function forfeitRewards(address _token, uint256 _index) external {
        require(_index > 0 && _index < rewardEpochs[_token].length - 1, "!past");
        require(_index >= userClaims[_token][msg.sender], "already claimed");

        //set claim checkpoint. next claim starts from index+1
        userClaims[_token][msg.sender] = _index + 1;

        emit RewardForfeited(msg.sender, _token, _index);
    }

    /* ========== VIEW REWARDS ========== */

    /**
     * @notice Get claimable rewards (rewardToken) for vlCVX holder
     * @param _account  Address of vlCVX holder
     * @param _token    Reward token address
     */
    function claimableRewards(address _account, address _token) external view returns (uint256) {
        (uint256 rewards, ) = _allClaimableRewards(_account, _token, 0);
        return rewards;
    }

    /**
     * @notice Get claimable rewards for a token at a specific epoch
     * @param _account     Address of vlCVX holder
     * @param _token       Reward token address
     * @param _epoch       The epoch to check for rewards
     */
    function claimableRewardsAtEpoch(
        address _account,
        address _token,
        uint256 _epoch
    ) external view returns (uint256) {
        return _claimableRewards(_account, _token, _epoch);
    }

    /**
     * @notice  Get all claimable rewards by looping through each epoch starting with the latest
     *          saved epoch the user last claimed from
     * @param _account  Address of vlCVX holder
     * @param _token    Reward token
     * @param _startIndex  Index of rewardEpochs[_token] to start checking for rewards from
     */
    function _allClaimableRewards(
        address _account,
        address _token,
        uint256 _startIndex
    ) internal view returns (uint256, uint256) {
        uint256 latestEpoch = auraLocker.epochCount() - 1;
        // e.g. tokenEpochs = 31, 21
        uint256 tokenEpochs = rewardEpochs[_token].length;

        // e.g. epochIndex = 0
        uint256 epochIndex = userClaims[_token][_account];
        // e.g. epochIndex = 27 > 0 ? 27 : 0 = 27
        epochIndex = _startIndex > epochIndex ? _startIndex : epochIndex;

        if (epochIndex >= tokenEpochs) {
            return (0, tokenEpochs);
        }

        uint256 claimableTokens = 0;

        for (uint256 i = epochIndex; i < tokenEpochs; i++) {
            //only claimable after rewards are "locked in"
            if (rewardEpochs[_token][i] < latestEpoch) {
                claimableTokens += _claimableRewards(_account, _token, rewardEpochs[_token][i]);
                //return index user claims should be set to
                epochIndex = i + 1;
            }
        }
        return (claimableTokens, epochIndex);
    }

    /**
     * @notice Get claimable rewards for a token at a specific epoch
     * @param _account     Address of vlCVX holder
     * @param _token       Reward token address
     * @param _epoch       The epoch to check for rewards
     */
    function _claimableRewards(
        address _account,
        address _token,
        uint256 _epoch
    ) internal view returns (uint256) {
        //get balance and calc share
        uint256 balance = auraLocker.balanceAtEpochOf(_epoch, _account);
        return (balance * rewardData[_token][_epoch]) / 1e20;
    }

    /**
     * @notice Simply gets the current epoch count for a given reward token
     * @param _token    Reward token address
     * @return _epochs  Number of epochs
     */
    function rewardEpochsCount(address _token) external view returns (uint256) {
        return rewardEpochs[_token].length;
    }
}
