// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import { AuraMath } from "./AuraMath.sol";
import { SafeMath } from "@openzeppelin/contracts-0.8/utils/math/SafeMath.sol";
import { IERC20 } from "@openzeppelin/contracts-0.8/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts-0.8/token/ERC20/utils/SafeERC20.sol";

import { IAuraLocker } from "./Interfaces.sol";

/**
 * @title   AuraBalRewardPool
 * @author  Synthetix -> ConvexFinance -> adapted
 * @notice  This AuraBalRewardPool is deployed to support auraBAL deposits during the first 2
 *          weeks of system operation. After which, the BaseRewardPool hooked into the Booster (lockRewards)
 *          will be used for auraBAL farming.
 * @dev     Modifications from convex-platform/contracts/contracts/BaseRewardPool.sol:
 *            - Delayed start (tokens transferred then delay is enforced before notification)
 *            - One time duration of 14 days
 *            - Remove child reward contracts
 *            - Penalty on claim at 20%
 */
contract AuraBalRewardPool {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    IERC20 public immutable rewardToken;
    IERC20 public immutable stakingToken;
    uint256 public constant duration = 14 days;

    address public immutable rewardManager;

    IAuraLocker public immutable auraLocker;
    address public immutable penaltyForwarder;
    uint256 public pendingPenalty = 0;
    uint256 public immutable startTime;

    uint256 public periodFinish = 0;
    uint256 public rewardRate = 0;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;
    uint256 private _totalSupply;

    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;
    mapping(address => uint256) private _balances;

    event RewardAdded(uint256 reward);
    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward, bool locked);
    event PenaltyForwarded(uint256 amount);

    /**
     * @dev Simple constructoor
     * @param _stakingToken  Pool LP token
     * @param _rewardToken   $AURA
     * @param _rewardManager Depositor
     * @param _auraLocker    $AURA lock contract
     * @param _penaltyForwarder Address to which penalties are sent
     */
    constructor(
        address _stakingToken,
        address _rewardToken,
        address _rewardManager,
        address _auraLocker,
        address _penaltyForwarder,
        uint256 _startDelay
    ) {
        stakingToken = IERC20(_stakingToken);
        rewardToken = IERC20(_rewardToken);
        rewardManager = _rewardManager;
        auraLocker = IAuraLocker(_auraLocker);
        penaltyForwarder = _penaltyForwarder;
        rewardToken.safeApprove(_auraLocker, type(uint256).max);

        require(_startDelay < 2 weeks, "!delay");
        startTime = block.timestamp + _startDelay;
    }

    function totalSupply() public view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) public view returns (uint256) {
        return _balances[account];
    }

    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = lastTimeRewardApplicable();
        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }

    function lastTimeRewardApplicable() public view returns (uint256) {
        return AuraMath.min(block.timestamp, periodFinish);
    }

    function rewardPerToken() public view returns (uint256) {
        if (totalSupply() == 0) {
            return rewardPerTokenStored;
        }
        return
            rewardPerTokenStored.add(
                lastTimeRewardApplicable().sub(lastUpdateTime).mul(rewardRate).mul(1e18).div(totalSupply())
            );
    }

    function earned(address account) public view returns (uint256) {
        return
            balanceOf(account).mul(rewardPerToken().sub(userRewardPerTokenPaid[account])).div(1e18).add(
                rewards[account]
            );
    }

    function stake(uint256 _amount) public updateReward(msg.sender) returns (bool) {
        require(_amount > 0, "RewardPool : Cannot stake 0");

        _totalSupply = _totalSupply.add(_amount);
        _balances[msg.sender] = _balances[msg.sender].add(_amount);

        stakingToken.safeTransferFrom(msg.sender, address(this), _amount);
        emit Staked(msg.sender, _amount);

        return true;
    }

    function stakeAll() external returns (bool) {
        uint256 balance = stakingToken.balanceOf(msg.sender);
        stake(balance);
        return true;
    }

    function stakeFor(address _for, uint256 _amount) public updateReward(_for) returns (bool) {
        require(_amount > 0, "RewardPool : Cannot stake 0");

        //give to _for
        _totalSupply = _totalSupply.add(_amount);
        _balances[_for] = _balances[_for].add(_amount);

        //take away from sender
        stakingToken.safeTransferFrom(msg.sender, address(this), _amount);
        emit Staked(_for, _amount);

        return true;
    }

    function withdraw(
        uint256 amount,
        bool claim,
        bool lock
    ) public updateReward(msg.sender) returns (bool) {
        require(amount > 0, "RewardPool : Cannot withdraw 0");

        _totalSupply = _totalSupply.sub(amount);
        _balances[msg.sender] = _balances[msg.sender].sub(amount);

        stakingToken.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);

        if (claim) {
            getReward(lock);
        }

        return true;
    }

    /**
     * @dev Gives a staker their rewards
     * @param _lock Lock the rewards? If false, takes a 20% haircut
     */
    function getReward(bool _lock) public updateReward(msg.sender) returns (bool) {
        uint256 reward = rewards[msg.sender];
        if (reward > 0) {
            rewards[msg.sender] = 0;
            if (_lock) {
                auraLocker.lock(msg.sender, reward);
            } else {
                uint256 penalty = (reward * 2) / 10;
                pendingPenalty += penalty;
                rewardToken.safeTransfer(msg.sender, reward - penalty);
            }
            emit RewardPaid(msg.sender, reward, _lock);
        }
        return true;
    }

    /**
     * @dev Forwards to the penalty forwarder for distro to Aura Lockers
     */
    function forwardPenalty() public {
        uint256 toForward = pendingPenalty;
        pendingPenalty = 0;
        rewardToken.safeTransfer(penaltyForwarder, toForward);
        emit PenaltyForwarded(toForward);
    }

    /**
     * @dev Called once to initialise the rewards based on balance of stakeToken
     */
    function initialiseRewards() external returns (bool) {
        require(msg.sender == rewardManager || block.timestamp > startTime, "!authorized");
        require(rewardRate == 0, "!one time");

        uint256 rewardsAvailable = rewardToken.balanceOf(address(this));
        require(rewardsAvailable > 0, "!balance");

        rewardRate = rewardsAvailable.div(duration);

        lastUpdateTime = block.timestamp;
        periodFinish = block.timestamp.add(duration);

        emit RewardAdded(rewardsAvailable);

        return true;
    }
}
