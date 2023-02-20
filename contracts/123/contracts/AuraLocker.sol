// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;
pragma experimental ABIEncoderV2;

import { IERC20 } from "@openzeppelin/contracts-0.8/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts-0.8/token/ERC20/utils/SafeERC20.sol";
import { Ownable } from "@openzeppelin/contracts-0.8/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts-0.8/security/ReentrancyGuard.sol";
import { AuraMath, AuraMath32, AuraMath112, AuraMath224 } from "./AuraMath.sol";
import "./Interfaces.sol";

interface IRewardStaking {
    function stakeFor(address, uint256) external;
}

/**
 * @title   AuraLocker
 * @author  ConvexFinance
 * @notice  Effectively allows for rolling 16 week lockups of CVX, and provides balances available
 *          at each epoch (1 week). Also receives cvxCrv from `CvxStakingProxy` and redistributes
 *          to depositors.
 * @dev     Invdividual and delegatee vote power lookups both use independent accounting mechanisms.
 */
contract AuraLocker is ReentrancyGuard, Ownable, IAuraLocker {
    using AuraMath for uint256;
    using AuraMath224 for uint224;
    using AuraMath112 for uint112;
    using AuraMath32 for uint32;
    using SafeERC20 for IERC20;

    /* ==========     STRUCTS     ========== */

    struct RewardData {
        /// Timestamp for current period finish
        uint32 periodFinish;
        /// Last time any user took action
        uint32 lastUpdateTime;
        /// RewardRate for the rest of the period
        uint96 rewardRate;
        /// Ever increasing rewardPerToken rate, based on % of total supply
        uint96 rewardPerTokenStored;
    }
    struct UserData {
        uint128 rewardPerTokenPaid;
        uint128 rewards;
    }
    struct EarnedData {
        address token;
        uint256 amount;
    }
    struct Balances {
        uint112 locked;
        uint32 nextUnlockIndex;
    }
    struct LockedBalance {
        uint112 amount;
        uint32 unlockTime;
    }
    struct Epoch {
        uint224 supply;
        uint32 date; //epoch start date
    }
    struct DelegateeCheckpoint {
        uint224 votes;
        uint32 epochStart;
    }

    /* ========== STATE VARIABLES ========== */

    // Rewards
    address[] public rewardTokens;
    uint256 public queuedCvxCrvRewards = 0;
    uint256 public constant newRewardRatio = 830;
    //     Core reward data
    mapping(address => RewardData) public rewardData;
    //     Reward token -> distributor -> is approved to add rewards
    mapping(address => mapping(address => bool)) public rewardDistributors;
    //     User -> reward token -> amount
    mapping(address => mapping(address => UserData)) public userData;
    //     Duration that rewards are streamed over
    uint256 public constant rewardsDuration = 86400 * 7;
    //     Duration of lock/earned penalty period
    uint256 public constant lockDuration = rewardsDuration * 17;

    // Balances
    //     Supplies and historic supply
    uint256 public lockedSupply;
    //     Epochs contains only the tokens that were locked at that epoch, not a cumulative supply
    Epoch[] public epochs;
    //     Mappings for balance data
    mapping(address => Balances) public balances;
    mapping(address => LockedBalance[]) public userLocks;

    // Voting
    //     Stored delegations
    mapping(address => address) private _delegates;
    //     Checkpointed votes
    mapping(address => DelegateeCheckpoint[]) private _checkpointedVotes;
    //     Delegatee balances (user -> unlock timestamp -> amount)
    mapping(address => mapping(uint256 => uint256)) public delegateeUnlocks;

    // Config
    //     Tokens
    IERC20 public immutable stakingToken;
    address public immutable cvxCrv;
    //     Denom for calcs
    uint256 public constant denominator = 10000;
    //     Staking cvxCrv
    address public immutable cvxcrvStaking;
    //     Incentives
    uint256 public kickRewardPerEpoch = 100;
    uint256 public kickRewardEpochDelay = 3;
    //     Shutdown
    bool public isShutdown = false;

    // Basic token data
    string private _name;
    string private _symbol;
    uint8 private immutable _decimals;

    /* ========== EVENTS ========== */

    event DelegateChanged(address indexed delegator, address indexed fromDelegate, address indexed toDelegate);
    event DelegateCheckpointed(address indexed delegate);

    event Recovered(address _token, uint256 _amount);
    event RewardPaid(address indexed _user, address indexed _rewardsToken, uint256 _reward);
    event Staked(address indexed _user, uint256 _paidAmount, uint256 _lockedAmount);
    event Withdrawn(address indexed _user, uint256 _amount, bool _relocked);
    event KickReward(address indexed _user, address indexed _kicked, uint256 _reward);
    event RewardAdded(address indexed _token, uint256 _reward);

    event KickIncentiveSet(uint256 rate, uint256 delay);
    event Shutdown();

    /***************************************
                    CONSTRUCTOR
    ****************************************/

    /**
     * @param _nameArg          Token name, simples
     * @param _symbolArg        Token symbol
     * @param _stakingToken     CVX (0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B)
     * @param _cvxCrv           cvxCRV (0x62B9c7356A2Dc64a1969e19C23e4f579F9810Aa7)
     * @param _cvxCrvStaking    cvxCRV rewards (0x3Fe65692bfCD0e6CF84cB1E7d24108E434A7587e)
     */
    constructor(
        string memory _nameArg,
        string memory _symbolArg,
        address _stakingToken,
        address _cvxCrv,
        address _cvxCrvStaking
    ) Ownable() {
        _name = _nameArg;
        _symbol = _symbolArg;
        _decimals = 18;

        stakingToken = IERC20(_stakingToken);
        cvxCrv = _cvxCrv;
        cvxcrvStaking = _cvxCrvStaking;

        uint256 currentEpoch = block.timestamp.div(rewardsDuration).mul(rewardsDuration);
        epochs.push(Epoch({ supply: 0, date: uint32(currentEpoch) }));
    }

    /***************************************
                    MODIFIER
    ****************************************/

    modifier updateReward(address _account) {
        {
            Balances storage userBalance = balances[_account];
            uint256 rewardTokensLength = rewardTokens.length;
            for (uint256 i = 0; i < rewardTokensLength; i++) {
                address token = rewardTokens[i];
                uint256 newRewardPerToken = _rewardPerToken(token);
                rewardData[token].rewardPerTokenStored = newRewardPerToken.to96();
                rewardData[token].lastUpdateTime = _lastTimeRewardApplicable(rewardData[token].periodFinish).to32();
                if (_account != address(0)) {
                    userData[_account][token] = UserData({
                        rewardPerTokenPaid: newRewardPerToken.to128(),
                        rewards: _earned(_account, token, userBalance.locked).to128()
                    });
                }
            }
        }
        _;
    }

    /***************************************
                    ADMIN
    ****************************************/

    // Add a new reward token to be distributed to stakers
    function addReward(address _rewardsToken, address _distributor) external onlyOwner {
        require(rewardData[_rewardsToken].lastUpdateTime == 0, "Reward already exists");
        require(_rewardsToken != address(stakingToken), "Cannot add StakingToken as reward");
        rewardTokens.push(_rewardsToken);
        rewardData[_rewardsToken].lastUpdateTime = uint32(block.timestamp);
        rewardData[_rewardsToken].periodFinish = uint32(block.timestamp);
        rewardDistributors[_rewardsToken][_distributor] = true;
    }

    // Modify approval for an address to call notifyRewardAmount
    function approveRewardDistributor(
        address _rewardsToken,
        address _distributor,
        bool _approved
    ) external onlyOwner {
        require(rewardData[_rewardsToken].lastUpdateTime > 0, "Reward does not exist");
        rewardDistributors[_rewardsToken][_distributor] = _approved;
    }

    //set kick incentive
    function setKickIncentive(uint256 _rate, uint256 _delay) external onlyOwner {
        require(_rate <= 500, "over max rate"); //max 5% per epoch
        require(_delay >= 2, "min delay"); //minimum 2 epochs of grace
        kickRewardPerEpoch = _rate;
        kickRewardEpochDelay = _delay;

        emit KickIncentiveSet(_rate, _delay);
    }

    //shutdown the contract. unstake all tokens. release all locks
    function shutdown() external onlyOwner {
        isShutdown = true;
        emit Shutdown();
    }

    // Added to support recovering LP Rewards from other systems such as BAL to be distributed to holders
    function recoverERC20(address _tokenAddress, uint256 _tokenAmount) external onlyOwner {
        require(_tokenAddress != address(stakingToken), "Cannot withdraw staking token");
        require(rewardData[_tokenAddress].lastUpdateTime == 0, "Cannot withdraw reward token");
        IERC20(_tokenAddress).safeTransfer(owner(), _tokenAmount);
        emit Recovered(_tokenAddress, _tokenAmount);
    }

    // Set approvals for staking cvx and cvxcrv
    function setApprovals() external {
        IERC20(cvxCrv).safeApprove(cvxcrvStaking, 0);
        IERC20(cvxCrv).safeApprove(cvxcrvStaking, type(uint256).max);
    }

    /***************************************
                    ACTIONS
    ****************************************/

    // Locked tokens cannot be withdrawn for lockDuration and are eligible to receive stakingReward rewards
    function lock(address _account, uint256 _amount) external nonReentrant updateReward(_account) {
        //pull tokens
        stakingToken.safeTransferFrom(msg.sender, address(this), _amount);

        //lock
        _lock(_account, _amount);
    }

    //lock tokens
    function _lock(address _account, uint256 _amount) internal {
        require(_amount > 0, "Cannot stake 0");
        require(!isShutdown, "shutdown");

        Balances storage bal = balances[_account];

        //must try check pointing epoch first
        _checkpointEpoch();

        //add user balances
        uint112 lockAmount = _amount.to112();
        bal.locked = bal.locked.add(lockAmount);

        //add to total supplies
        lockedSupply = lockedSupply.add(_amount);

        //add user lock records or add to current
        uint256 currentEpoch = block.timestamp.div(rewardsDuration).mul(rewardsDuration);
        uint256 unlockTime = currentEpoch.add(lockDuration);
        uint256 idx = userLocks[_account].length;
        if (idx == 0 || userLocks[_account][idx - 1].unlockTime < unlockTime) {
            userLocks[_account].push(LockedBalance({ amount: lockAmount, unlockTime: uint32(unlockTime) }));
        } else {
            LockedBalance storage userL = userLocks[_account][idx - 1];
            userL.amount = userL.amount.add(lockAmount);
        }

        address delegatee = delegates(_account);
        if (delegatee != address(0)) {
            delegateeUnlocks[delegatee][unlockTime] += lockAmount;
            _checkpointDelegate(delegatee, lockAmount, 0);
        }

        //update epoch supply, epoch checkpointed above so safe to add to latest
        Epoch storage e = epochs[epochs.length - 1];
        e.supply = e.supply.add(lockAmount);

        emit Staked(_account, lockAmount, lockAmount);
    }

    // claim all pending rewards
    function getReward(address _account) external {
        getReward(_account, false);
    }

    // Claim all pending rewards
    function getReward(address _account, bool _stake) public nonReentrant updateReward(_account) {
        uint256 rewardTokensLength = rewardTokens.length;
        for (uint256 i; i < rewardTokensLength; i++) {
            address _rewardsToken = rewardTokens[i];
            uint256 reward = userData[_account][_rewardsToken].rewards;
            if (reward > 0) {
                userData[_account][_rewardsToken].rewards = 0;
                if (_rewardsToken == cvxCrv && _stake && _account == msg.sender) {
                    IRewardStaking(cvxcrvStaking).stakeFor(_account, reward);
                } else {
                    IERC20(_rewardsToken).safeTransfer(_account, reward);
                }
                emit RewardPaid(_account, _rewardsToken, reward);
            }
        }
    }

    function checkpointEpoch() external {
        _checkpointEpoch();
    }

    //insert a new epoch if needed. fill in any gaps
    function _checkpointEpoch() internal {
        uint256 currentEpoch = block.timestamp.div(rewardsDuration).mul(rewardsDuration);
        uint256 epochindex = epochs.length;

        //first epoch add in constructor, no need to check 0 length
        //check to add
        if (epochs[epochindex - 1].date < currentEpoch) {
            //fill any epoch gaps until the next epoch date.
            while (epochs[epochs.length - 1].date != currentEpoch) {
                uint256 nextEpochDate = uint256(epochs[epochs.length - 1].date).add(rewardsDuration);
                epochs.push(Epoch({ supply: 0, date: uint32(nextEpochDate) }));
            }
        }
    }

    // Withdraw/relock all currently locked tokens where the unlock time has passed
    function processExpiredLocks(bool _relock) external nonReentrant {
        _processExpiredLocks(msg.sender, _relock, msg.sender, 0);
    }

    function kickExpiredLocks(address _account) external nonReentrant {
        //allow kick after grace period of 'kickRewardEpochDelay'
        _processExpiredLocks(_account, false, msg.sender, rewardsDuration.mul(kickRewardEpochDelay));
    }

    // Withdraw without checkpointing or accruing any rewards, providing system is shutdown
    function emergencyWithdraw() external nonReentrant {
        require(isShutdown, "Must be shutdown");

        LockedBalance[] memory locks = userLocks[msg.sender];
        Balances storage userBalance = balances[msg.sender];

        uint256 amt = userBalance.locked;
        require(amt > 0, "Nothing locked");

        userBalance.locked = 0;
        userBalance.nextUnlockIndex = locks.length.to32();
        lockedSupply -= amt;

        emit Withdrawn(msg.sender, amt, false);

        stakingToken.safeTransfer(msg.sender, amt);
    }

    // Withdraw all currently locked tokens where the unlock time has passed
    function _processExpiredLocks(
        address _account,
        bool _relock,
        address _rewardAddress,
        uint256 _checkDelay
    ) internal updateReward(_account) {
        LockedBalance[] storage locks = userLocks[_account];
        Balances storage userBalance = balances[_account];
        uint112 locked;
        uint256 length = locks.length;
        uint256 reward = 0;
        uint256 expiryTime = _checkDelay == 0 && _relock
            ? block.timestamp.add(rewardsDuration)
            : block.timestamp.sub(_checkDelay);
        require(length > 0, "no locks");
        // e.g. now = 16
        // if contract is shutdown OR latest lock unlock time (e.g. 17) <= now - (1)
        // e.g. 17 <= (16 + 1)
        if (isShutdown || locks[length - 1].unlockTime <= expiryTime) {
            //if time is beyond last lock, can just bundle everything together
            locked = userBalance.locked;

            //dont delete, just set next index
            userBalance.nextUnlockIndex = length.to32();

            //check for kick reward
            //this wont have the exact reward rate that you would get if looped through
            //but this section is supposed to be for quick and easy low gas processing of all locks
            //we'll assume that if the reward was good enough someone would have processed at an earlier epoch
            if (_checkDelay > 0) {
                uint256 currentEpoch = block.timestamp.sub(_checkDelay).div(rewardsDuration).mul(rewardsDuration);
                uint256 epochsover = currentEpoch.sub(uint256(locks[length - 1].unlockTime)).div(rewardsDuration);
                uint256 rRate = AuraMath.min(kickRewardPerEpoch.mul(epochsover + 1), denominator);
                reward = uint256(locks[length - 1].amount).mul(rRate).div(denominator);
            }
        } else {
            //use a processed index(nextUnlockIndex) to not loop as much
            //deleting does not change array length
            uint32 nextUnlockIndex = userBalance.nextUnlockIndex;
            for (uint256 i = nextUnlockIndex; i < length; i++) {
                //unlock time must be less or equal to time
                if (locks[i].unlockTime > expiryTime) break;

                //add to cumulative amounts
                locked = locked.add(locks[i].amount);

                //check for kick reward
                //each epoch over due increases reward
                if (_checkDelay > 0) {
                    uint256 currentEpoch = block.timestamp.sub(_checkDelay).div(rewardsDuration).mul(rewardsDuration);
                    uint256 epochsover = currentEpoch.sub(uint256(locks[i].unlockTime)).div(rewardsDuration);
                    uint256 rRate = AuraMath.min(kickRewardPerEpoch.mul(epochsover + 1), denominator);
                    reward = reward.add(uint256(locks[i].amount).mul(rRate).div(denominator));
                }
                //set next unlock index
                nextUnlockIndex++;
            }
            //update next unlock index
            userBalance.nextUnlockIndex = nextUnlockIndex;
        }
        require(locked > 0, "no exp locks");

        //update user balances and total supplies
        userBalance.locked = userBalance.locked.sub(locked);
        lockedSupply = lockedSupply.sub(locked);

        //checkpoint the delegatee
        _checkpointDelegate(delegates(_account), 0, 0);

        emit Withdrawn(_account, locked, _relock);

        //send process incentive
        if (reward > 0) {
            //reduce return amount by the kick reward
            locked = locked.sub(reward.to112());

            //transfer reward
            stakingToken.safeTransfer(_rewardAddress, reward);
            emit KickReward(_rewardAddress, _account, reward);
        }

        //relock or return to user
        if (_relock) {
            _lock(_account, locked);
        } else {
            stakingToken.safeTransfer(_account, locked);
        }
    }

    /***************************************
            DELEGATION & VOTE BALANCE
    ****************************************/

    /**
     * @dev Delegate votes from the sender to `newDelegatee`.
     */
    function delegate(address newDelegatee) external virtual nonReentrant {
        // Step 1: Get lock data
        LockedBalance[] storage locks = userLocks[msg.sender];
        uint256 len = locks.length;
        require(len > 0, "Nothing to delegate");
        require(newDelegatee != address(0), "Must delegate to someone");

        // Step 2: Update delegatee storage
        address oldDelegatee = delegates(msg.sender);
        require(newDelegatee != oldDelegatee, "Must choose new delegatee");
        _delegates[msg.sender] = newDelegatee;

        emit DelegateChanged(msg.sender, oldDelegatee, newDelegatee);

        // Step 3: Move balances around
        //         Delegate for the upcoming epoch
        uint256 upcomingEpoch = block.timestamp.add(rewardsDuration).div(rewardsDuration).mul(rewardsDuration);
        uint256 i = len - 1;
        uint256 futureUnlocksSum = 0;
        LockedBalance memory currentLock = locks[i];
        // Step 3.1: Add future unlocks and sum balances
        while (currentLock.unlockTime > upcomingEpoch) {
            futureUnlocksSum += currentLock.amount;

            if (oldDelegatee != address(0)) {
                delegateeUnlocks[oldDelegatee][currentLock.unlockTime] -= currentLock.amount;
            }
            delegateeUnlocks[newDelegatee][currentLock.unlockTime] += currentLock.amount;

            if (i > 0) {
                i--;
                currentLock = locks[i];
            } else {
                break;
            }
        }

        // Step 3.2: Checkpoint old delegatee
        _checkpointDelegate(oldDelegatee, 0, futureUnlocksSum);

        // Step 3.3: Checkpoint new delegatee
        _checkpointDelegate(newDelegatee, futureUnlocksSum, 0);
    }

    function _checkpointDelegate(
        address _account,
        uint256 _upcomingAddition,
        uint256 _upcomingDeduction
    ) internal {
        // This would only skip on first checkpointing
        if (_account != address(0)) {
            uint256 upcomingEpoch = block.timestamp.add(rewardsDuration).div(rewardsDuration).mul(rewardsDuration);
            DelegateeCheckpoint[] storage ckpts = _checkpointedVotes[_account];
            if (ckpts.length > 0) {
                DelegateeCheckpoint memory prevCkpt = ckpts[ckpts.length - 1];
                // If there has already been a record for the upcoming epoch, no need to deduct the unlocks
                if (prevCkpt.epochStart == upcomingEpoch) {
                    ckpts[ckpts.length - 1] = DelegateeCheckpoint({
                        votes: (prevCkpt.votes + _upcomingAddition - _upcomingDeduction).to224(),
                        epochStart: upcomingEpoch.to32()
                    });
                }
                // else if it has been over 16 weeks since the previous checkpoint, all locks have since expired
                // e.g. week 1 + 17 <= 18
                else if (prevCkpt.epochStart + lockDuration <= upcomingEpoch) {
                    ckpts.push(
                        DelegateeCheckpoint({
                            votes: (_upcomingAddition - _upcomingDeduction).to224(),
                            epochStart: upcomingEpoch.to32()
                        })
                    );
                } else {
                    uint256 nextEpoch = upcomingEpoch;
                    uint256 unlocksSinceLatestCkpt = 0;
                    // Should be maximum 18 iterations
                    while (nextEpoch > prevCkpt.epochStart) {
                        unlocksSinceLatestCkpt += delegateeUnlocks[_account][nextEpoch];
                        nextEpoch -= rewardsDuration;
                    }
                    ckpts.push(
                        DelegateeCheckpoint({
                            votes: (prevCkpt.votes - unlocksSinceLatestCkpt + _upcomingAddition - _upcomingDeduction)
                                .to224(),
                            epochStart: upcomingEpoch.to32()
                        })
                    );
                }
            } else {
                ckpts.push(
                    DelegateeCheckpoint({
                        votes: (_upcomingAddition - _upcomingDeduction).to224(),
                        epochStart: upcomingEpoch.to32()
                    })
                );
            }
            emit DelegateCheckpointed(_account);
        }
    }

    /**
     * @dev Get the address `account` is currently delegating to.
     */
    function delegates(address account) public view virtual returns (address) {
        return _delegates[account];
    }

    /**
     * @dev Gets the current votes balance for `account`
     */
    function getVotes(address account) external view returns (uint256) {
        return getPastVotes(account, block.timestamp);
    }

    /**
     * @dev Get the `pos`-th checkpoint for `account`.
     */
    function checkpoints(address account, uint32 pos) external view virtual returns (DelegateeCheckpoint memory) {
        return _checkpointedVotes[account][pos];
    }

    /**
     * @dev Get number of checkpoints for `account`.
     */
    function numCheckpoints(address account) external view virtual returns (uint32) {
        return _checkpointedVotes[account].length.to32();
    }

    /**
     * @dev Retrieve the number of votes for `account` at the end of `blockNumber`.
     */
    function getPastVotes(address account, uint256 timestamp) public view returns (uint256 votes) {
        require(timestamp <= block.timestamp, "ERC20Votes: block not yet mined");
        uint256 epoch = timestamp.div(rewardsDuration).mul(rewardsDuration);
        DelegateeCheckpoint memory ckpt = _checkpointsLookup(_checkpointedVotes[account], epoch);
        votes = ckpt.votes;
        if (votes == 0 || ckpt.epochStart + lockDuration <= epoch) {
            return 0;
        }
        while (epoch > ckpt.epochStart) {
            votes -= delegateeUnlocks[account][epoch];
            epoch -= rewardsDuration;
        }
    }

    /**
     * @dev Retrieve the `totalSupply` at the end of `timestamp`. Note, this value is the sum of all balances.
     * It is but NOT the sum of all the delegated votes!
     */
    function getPastTotalSupply(uint256 timestamp) external view returns (uint256) {
        require(timestamp < block.timestamp, "ERC20Votes: block not yet mined");
        return totalSupplyAtEpoch(findEpochId(timestamp));
    }

    /**
     * @dev Lookup a value in a list of (sorted) checkpoints.
     *      Copied from oz/ERC20Votes.sol
     */
    function _checkpointsLookup(DelegateeCheckpoint[] storage ckpts, uint256 epochStart)
        private
        view
        returns (DelegateeCheckpoint memory)
    {
        uint256 high = ckpts.length;
        uint256 low = 0;
        while (low < high) {
            uint256 mid = AuraMath.average(low, high);
            if (ckpts[mid].epochStart > epochStart) {
                high = mid;
            } else {
                low = mid + 1;
            }
        }

        return high == 0 ? DelegateeCheckpoint(0, 0) : ckpts[high - 1];
    }

    /***************************************
                VIEWS - BALANCES
    ****************************************/

    // Balance of an account which only includes properly locked tokens as of the most recent eligible epoch
    function balanceOf(address _user) external view returns (uint256 amount) {
        return balanceAtEpochOf(findEpochId(block.timestamp), _user);
    }

    // Balance of an account which only includes properly locked tokens at the given epoch
    function balanceAtEpochOf(uint256 _epoch, address _user) public view returns (uint256 amount) {
        uint256 epochStart = uint256(epochs[0].date).add(uint256(_epoch).mul(rewardsDuration));
        require(epochStart < block.timestamp, "Epoch is in the future");

        uint256 cutoffEpoch = epochStart.sub(lockDuration);

        LockedBalance[] storage locks = userLocks[_user];

        //need to add up since the range could be in the middle somewhere
        //traverse inversely to make more current queries more gas efficient
        uint256 locksLength = locks.length;
        for (uint256 i = locksLength; i > 0; i--) {
            uint256 lockEpoch = uint256(locks[i - 1].unlockTime).sub(lockDuration);
            //lock epoch must be less or equal to the epoch we're basing from.
            //also not include the current epoch
            if (lockEpoch < epochStart) {
                if (lockEpoch > cutoffEpoch) {
                    amount = amount.add(locks[i - 1].amount);
                } else {
                    //stop now as no futher checks matter
                    break;
                }
            }
        }

        return amount;
    }

    // Information on a user's locked balances
    function lockedBalances(address _user)
        external
        view
        returns (
            uint256 total,
            uint256 unlockable,
            uint256 locked,
            LockedBalance[] memory lockData
        )
    {
        LockedBalance[] storage locks = userLocks[_user];
        Balances storage userBalance = balances[_user];
        uint256 nextUnlockIndex = userBalance.nextUnlockIndex;
        uint256 idx;
        for (uint256 i = nextUnlockIndex; i < locks.length; i++) {
            if (locks[i].unlockTime > block.timestamp) {
                if (idx == 0) {
                    lockData = new LockedBalance[](locks.length - i);
                }
                lockData[idx] = locks[i];
                idx++;
                locked = locked.add(locks[i].amount);
            } else {
                unlockable = unlockable.add(locks[i].amount);
            }
        }
        return (userBalance.locked, unlockable, locked, lockData);
    }

    // Supply of all properly locked balances at most recent eligible epoch
    function totalSupply() external view returns (uint256 supply) {
        return totalSupplyAtEpoch(findEpochId(block.timestamp));
    }

    // Supply of all properly locked balances at the given epoch
    function totalSupplyAtEpoch(uint256 _epoch) public view returns (uint256 supply) {
        uint256 epochStart = uint256(epochs[0].date).add(uint256(_epoch).mul(rewardsDuration));
        require(epochStart < block.timestamp, "Epoch is in the future");

        uint256 cutoffEpoch = epochStart.sub(lockDuration);
        uint256 lastIndex = epochs.length - 1;

        uint256 epochIndex = _epoch > lastIndex ? lastIndex : _epoch;

        for (uint256 i = epochIndex + 1; i > 0; i--) {
            Epoch memory e = epochs[i - 1];
            if (e.date == epochStart) {
                continue;
            } else if (e.date <= cutoffEpoch) {
                break;
            } else {
                supply += e.supply;
            }
        }
    }

    // Get an epoch index based on timestamp
    function findEpochId(uint256 _time) public view returns (uint256 epoch) {
        return _time.sub(epochs[0].date).div(rewardsDuration);
    }

    /***************************************
                VIEWS - GENERAL
    ****************************************/

    // Number of epochs
    function epochCount() external view returns (uint256) {
        return epochs.length;
    }

    function decimals() external view returns (uint8) {
        return _decimals;
    }

    function name() external view returns (string memory) {
        return _name;
    }

    function symbol() external view returns (string memory) {
        return _symbol;
    }

    /***************************************
                VIEWS - REWARDS
    ****************************************/

    // Address and claimable amount of all reward tokens for the given account
    function claimableRewards(address _account) external view returns (EarnedData[] memory userRewards) {
        userRewards = new EarnedData[](rewardTokens.length);
        Balances storage userBalance = balances[_account];
        uint256 userRewardsLength = userRewards.length;
        for (uint256 i = 0; i < userRewardsLength; i++) {
            address token = rewardTokens[i];
            userRewards[i].token = token;
            userRewards[i].amount = _earned(_account, token, userBalance.locked);
        }
        return userRewards;
    }

    function lastTimeRewardApplicable(address _rewardsToken) external view returns (uint256) {
        return _lastTimeRewardApplicable(rewardData[_rewardsToken].periodFinish);
    }

    function rewardPerToken(address _rewardsToken) external view returns (uint256) {
        return _rewardPerToken(_rewardsToken);
    }

    function _earned(
        address _user,
        address _rewardsToken,
        uint256 _balance
    ) internal view returns (uint256) {
        UserData memory data = userData[_user][_rewardsToken];
        return _balance.mul(_rewardPerToken(_rewardsToken).sub(data.rewardPerTokenPaid)).div(1e18).add(data.rewards);
    }

    function _lastTimeRewardApplicable(uint256 _finishTime) internal view returns (uint256) {
        return AuraMath.min(block.timestamp, _finishTime);
    }

    function _rewardPerToken(address _rewardsToken) internal view returns (uint256) {
        if (lockedSupply == 0) {
            return rewardData[_rewardsToken].rewardPerTokenStored;
        }
        return
            uint256(rewardData[_rewardsToken].rewardPerTokenStored).add(
                _lastTimeRewardApplicable(rewardData[_rewardsToken].periodFinish)
                    .sub(rewardData[_rewardsToken].lastUpdateTime)
                    .mul(rewardData[_rewardsToken].rewardRate)
                    .mul(1e18)
                    .div(lockedSupply)
            );
    }

    /***************************************
                REWARD FUNDING
    ****************************************/

    function queueNewRewards(uint256 _rewards) external nonReentrant {
        require(rewardDistributors[cvxCrv][msg.sender], "!authorized");
        require(_rewards > 0, "No reward");

        RewardData storage rdata = rewardData[cvxCrv];

        IERC20(cvxCrv).safeTransferFrom(msg.sender, address(this), _rewards);

        _rewards = _rewards.add(queuedCvxCrvRewards);
        if (block.timestamp >= rdata.periodFinish) {
            _notifyReward(cvxCrv, _rewards);
            queuedCvxCrvRewards = 0;
            return;
        }

        //et = now - (finish-duration)
        uint256 elapsedTime = block.timestamp.sub(rdata.periodFinish.sub(rewardsDuration.to32()));
        //current at now: rewardRate * elapsedTime
        uint256 currentAtNow = rdata.rewardRate * elapsedTime;
        uint256 queuedRatio = currentAtNow.mul(1000).div(_rewards);
        if (queuedRatio < newRewardRatio) {
            _notifyReward(cvxCrv, _rewards);
            queuedCvxCrvRewards = 0;
        } else {
            queuedCvxCrvRewards = _rewards;
        }
    }

    function notifyRewardAmount(address _rewardsToken, uint256 _reward) external {
        require(_rewardsToken != cvxCrv, "Use queueNewRewards");
        require(rewardDistributors[_rewardsToken][msg.sender], "Must be rewardsDistributor");
        require(_reward > 0, "No reward");

        _notifyReward(_rewardsToken, _reward);

        // handle the transfer of reward tokens via `transferFrom` to reduce the number
        // of transactions required and ensure correctness of the _reward amount
        IERC20(_rewardsToken).safeTransferFrom(msg.sender, address(this), _reward);
    }

    function _notifyReward(address _rewardsToken, uint256 _reward) internal updateReward(address(0)) {
        RewardData storage rdata = rewardData[_rewardsToken];

        if (block.timestamp >= rdata.periodFinish) {
            rdata.rewardRate = _reward.div(rewardsDuration).to96();
        } else {
            uint256 remaining = uint256(rdata.periodFinish).sub(block.timestamp);
            uint256 leftover = remaining.mul(rdata.rewardRate);
            rdata.rewardRate = _reward.add(leftover).div(rewardsDuration).to96();
        }

        rdata.lastUpdateTime = block.timestamp.to32();
        rdata.periodFinish = block.timestamp.add(rewardsDuration).to32();

        emit RewardAdded(_rewardsToken, _reward);
    }
}
