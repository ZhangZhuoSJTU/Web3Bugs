// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "./open-zeppelin/ERC20.sol";
import "./open-zeppelin/utils/Ownable.sol";
import "./open-zeppelin/interfaces/IERC20.sol";
import "./open-zeppelin/libraries/SafeERC20.sol";
import "./open-zeppelin/utils/Math.sol";

/** @title Holy Paladin Token (hPAL) contract  */
/// @author Paladin
contract HolyPaladinToken is ERC20("Holy Paladin Token", "hPAL"), Ownable {
    using SafeERC20 for IERC20;


    /** @notice Seconds in a Week */
    uint256 public constant WEEK = 604800;
    /** @notice Seconds in a Month */
    uint256 public constant MONTH = 2629800;
    /** @notice 1e18 scale */
    uint256 public constant UNIT = 1e18;
    /** @notice Max BPS value (100%) */
    uint256 public constant MAX_BPS = 10000;
    /** @notice Seconds in a Year */
    uint256 public constant ONE_YEAR = 31557600;

    /** @notice  Period to wait before unstaking tokens  */
    uint256 public constant COOLDOWN_PERIOD = 864000; // 10 days
    /** @notice  Duration of the unstaking period
    After that period, unstaking cooldown is expired  */
    uint256 public constant UNSTAKE_PERIOD = 432000; // 5 days

    /** @notice Period to unlock/re-lock tokens without possibility of punishement   */
    uint256 public constant UNLOCK_DELAY = 1209600; // 2 weeks

    /** @notice Minimum duration of a Lock  */
    uint256 public constant MIN_LOCK_DURATION = 7889400; // 3 months
    /** @notice Maximum duration of a Lock  */
    uint256 public constant MAX_LOCK_DURATION = 63115200; // 2 years

    /** @notice Address of the PAL token  */
    IERC20 public immutable pal;

    /** @notice Struct of the Lock of an user  */
    struct UserLock {
        // Amount of locked balance
        uint128 amount; // safe because PAL max supply is 10M tokens
        // Start of the Lock
        uint48 startTimestamp;
        // Duration of the Lock
        uint48 duration;
        // BlockNumber for the Lock
        uint32 fromBlock; // because we want to search by block number
    }

    /** @notice Array of all user Locks, ordered from oldest to newest  */
    mapping(address => UserLock[]) public userLocks;

    /** @notice Struct trancking the total amount locked  */
    struct TotalLock {
        // Total locked Supply
        uint224 total;
        // BlockNumber for the last update
        uint32 fromBlock;
    }

    /** @notice Current Total locked Supply  */
    uint256 public currentTotalLocked;
    /** @notice List of TotalLocks, ordered from oldest to newest  */
    TotalLock[] public totalLocks;

    /** @notice User Cooldowns  */
    mapping(address => uint256) public cooldowns;

    /** @notice Checkpoints for users votes  */
    struct Checkpoint {
        uint32 fromBlock;
        uint224 votes;
    }

    /** @notice Checkpoints for users Delegates  */
    struct DelegateCheckpoint {
        uint32 fromBlock;
        address delegate;
    }

    /** @notice mapping tracking the Delegator for each Delegatee  */
    mapping(address => address) public delegates;

    /** @notice List of Vote checkpoints for each user  */
    mapping(address => Checkpoint[]) public checkpoints;

    /** @notice List of Delegate checkpoints for each user  */
    mapping(address => DelegateCheckpoint[]) public delegateCheckpoints;

    /** @notice Ratio (in BPS) of locked balance applied of penalty for each week over lock end  */
    uint256 public kickRatioPerWeek = 1000;

    /** @notice Ratio of bonus votes applied on user locked balance  */
    uint256 public bonusLockVoteRatio = 0.5e18;

    /** @notice Allow emergency withdraws  */
    bool public emergency = false;

    /** @notice Address of the vault holding the PAL rewards  */
    address public immutable rewardsVault;

    /** @notice Global reward index  */
    uint256 public rewardIndex;
    /** @notice Timstamp of last update for global reward index  */
    uint256 public lastRewardUpdate;

    /** @notice Amount of rewards distriubted per second at the start  */
    uint256 public immutable startDropPerSecond;
    /** @notice Amount of rewards distributed per second at the end of the decrease duration  */
    uint256 public endDropPerSecond;
    /** @notice Current amount of rewards distriubted per second  */
    uint256 public currentDropPerSecond;
    /** @notice Timestamp of last update for currentDropPerSecond  */
    uint256 public lastDropUpdate;
    /** @notice Duration (in seconds) of the DropPerSecond decrease period  */
    uint256 public immutable dropDecreaseDuration;
    /** @notice Timestamp: start of the DropPerSecond decrease period  */
    uint256 public immutable startDropTimestamp;

    /** @notice Last reward index for each user  */
    mapping(address => uint256) public userRewardIndex;
    /** @notice Current amount of rewards claimable for the user  */
    mapping(address => uint256) public claimableRewards;
    /** @notice Timestamp of last update for user rewards  */
    mapping(address => uint256) public rewardsLastUpdate;

    /** @notice Base reward multiplier for lock  */
    uint256 public immutable baseLockBonusRatio;
    /** @notice Minimum reward multiplier for minimum lock duration  */
    uint256 public immutable minLockBonusRatio;
    /** @notice Maximum reward multiplier for maximum duration  */
    uint256 public immutable maxLockBonusRatio;

    /** @notice Last updated Bonus Ratio for rewards  */
    mapping(address => uint256) public userCurrentBonusRatio;
    /** @notice Value by which user Bonus Ratio decrease each second  */
    mapping(address => uint256) public userBonusRatioDecrease;

    /** @notice Error raised if contract is turned in emergency mode */
    error EmergencyBlock(); 

    // Event

    /** @notice Emitted when an user stake PAL in the contract */
    event Stake(address indexed user, uint256 amount);
    /** @notice Emitted when an user burns hPAL to withdraw PAL */
    event Unstake(address indexed user, uint256 amount);
    /** @notice Emitted when an user triggers the cooldown period */
    event Cooldown(address indexed user);
    /** @notice Emitted when an user creates or update its Lock */
    event Lock(address indexed user, uint256 amount, uint256 indexed startTimestamp, uint256 indexed duration, uint256 totalLocked);
    /** @notice Emitted when an user exits the Lock */
    event Unlock(address indexed user, uint256 amount, uint256 totalLocked);
    /** @notice Emitted when an user is kicked out of the Lock */
    event Kick(address indexed user, address indexed kicker, uint256 amount, uint256 penalty, uint256 totalLocked);
    /** @notice Emitted when an user claim the rewards */
    event ClaimRewards(address indexed user, uint256 amount);
    /** @notice Emitted when the delegate of an address changes */
    event DelegateChanged(address indexed delegator, address indexed fromDelegate, address indexed toDelegate);
    /** @notice Emitted when the votes of a delegate is updated */
    event DelegateVotesChanged(address indexed delegate, uint256 previousBalance, uint256 newBalance);
    /** @notice Emitted when un user withdraw through the emergency method */
    event EmergencyUnstake(address indexed user, uint256 amount);

    constructor(
        address palToken,
        address _admin,
        address _rewardsVault,
        uint256 _startDropPerSecond,
        uint256 _endDropPerSecond,
        uint256 _dropDecreaseDuration,
        uint256 _baseLockBonusRatio,
        uint256 _minLockBonusRatio,
        uint256 _maxLockBonusRatio
    ){
        require(palToken != address(0));
        require(_admin != address(0));

        pal = IERC20(palToken);

        transferOwnership(_admin);

        totalLocks.push(TotalLock(
            0,
            safe32(block.number)
        ));
        // Set the immutable variables
        rewardsVault = _rewardsVault;

        startDropPerSecond = _startDropPerSecond;
        endDropPerSecond = _endDropPerSecond;

        currentDropPerSecond = _startDropPerSecond;

        dropDecreaseDuration = _dropDecreaseDuration;

        baseLockBonusRatio = _baseLockBonusRatio;
        minLockBonusRatio = _minLockBonusRatio;
        maxLockBonusRatio = _maxLockBonusRatio;

        // Set all update timestamp as contract creation timestamp
        lastRewardUpdate = block.timestamp;
        lastDropUpdate = block.timestamp;
        // Start the reward distribution & DropPerSecond decrease
        startDropTimestamp = block.timestamp;
    }


    /**
     * @notice Deposits PAL & mints hPAL tokens
     * @param amount amount to stake
     * @return uint256 : amount of hPAL minted
     */
    function stake(uint256 amount) external returns(uint256) {
        if(emergency) revert EmergencyBlock();
        return _stake(msg.sender, amount);
    }

    /**
     * @notice Updates the Cooldown for the caller
     */
    function cooldown() external {
        require(balanceOf(msg.sender) > 0, "hPAL: No balance");

        // Set the current timestamp as start of the user cooldown
        cooldowns[msg.sender] = block.timestamp;

        emit Cooldown(msg.sender);
    }

    /**
     * @notice Burns hPAL & withdraws PAL
     * @param amount amount ot withdraw
     * @param receiver address to receive the withdrawn PAL
     * @return uint256 : amount withdrawn
     */
    function unstake(uint256 amount, address receiver) external returns(uint256) {
        if(emergency) revert EmergencyBlock();
        return _unstake(msg.sender, amount, receiver);
    }

    /**
     * @notice Locks hPAL for a given duration
     * @param amount amount of the hPAL balance to lock
     * @param duration duration of the Lock (in seconds)
     */
    function lock(uint256 amount, uint256 duration) external {
        if(emergency) revert EmergencyBlock();
        // Update user rewards before any change on their balance (staked and locked)
        _updateUserRewards(msg.sender);
        if(delegates[msg.sender] == address(0)){
            // If the user does not deelegate currently, automatically self-delegate
            _delegate(msg.sender, msg.sender);
        }
        _lock(msg.sender, amount, duration, LockAction.LOCK);
    }

    /**
     * @notice Increase the user current Lock duration (& restarts the Lock)
     * @param duration new duration for the Lock (in seconds)
     */
    function increaseLockDuration(uint256 duration) external {
        if(emergency) revert EmergencyBlock();
        require(userLocks[msg.sender].length != 0, "hPAL: No Lock");
        // Find the current Lock
        uint256 currentUserLockIndex = userLocks[msg.sender].length - 1;
        UserLock storage currentUserLock = userLocks[msg.sender][currentUserLockIndex];
        // Update user rewards before any change on their balance (staked and locked)
        _updateUserRewards(msg.sender);
        // Call the _lock method with the current amount, and the new duration
        _lock(msg.sender, currentUserLock.amount, duration, LockAction.INCREASE_DURATION);
    }

    /**
     * @notice Increase the amount of hPAL locked for the user
     * @param amount new amount of hPAL to be locked (in total)
     */
    function increaseLock(uint256 amount) external {
        if(emergency) revert EmergencyBlock();
        require(userLocks[msg.sender].length != 0, "hPAL: No Lock");
        // Find the current Lock
        uint256 currentUserLockIndex = userLocks[msg.sender].length - 1;
        UserLock storage currentUserLock = userLocks[msg.sender][currentUserLockIndex];
        // Update user rewards before any change on their balance (staked and locked)
        _updateUserRewards(msg.sender);
        // Call the _lock method with the current duration, and the new amount
        _lock(msg.sender, amount, currentUserLock.duration, LockAction.INCREASE_AMOUNT);
    }

    /**
     * @notice Removes the user Lock after expiration
     */
    function unlock() external {
        if(emergency) revert EmergencyBlock();
        require(userLocks[msg.sender].length != 0, "hPAL: No Lock");
        // Update user rewards before any change on their balance (staked and locked)
        _updateUserRewards(msg.sender);
        _unlock(msg.sender);
    }

    /**
     * @notice Removes an user Lock if too long after expiry, and applies a penalty
     * @param user address of the user to kick out of a Lock
     */
    function kick(address user) external {
        if(emergency) revert EmergencyBlock();
        require(msg.sender != user, "hPAL: cannot kick yourself");
        // Update user rewards before any change on their balance (staked and locked)
        // For both the user and the kicker
        _updateUserRewards(user);
        _updateUserRewards(msg.sender);
        _kick(user, msg.sender);
    }

    /**
     * @notice Staked PAL to get hPAL, and locks it for the given duration
     * @param amount amount of PAL to stake and lock
     * @param duration duration of the Lock (in seconds)
     * @return uint256 : amount of hPAL minted
     */
    function stakeAndLock(uint256 amount, uint256 duration) external returns(uint256) {
        if(emergency) revert EmergencyBlock();
        // Stake the given amount
        uint256 stakedAmount = _stake(msg.sender, amount);
        // No need to update user rewards since it's done through the _stake() method
        if(delegates[msg.sender] == address(0)){
            _delegate(msg.sender, msg.sender);
        }
        // And then lock it
        _lock(msg.sender, amount, duration, LockAction.LOCK);
        return stakedAmount;
    }

    /**
     * @notice Stake more PAL into hPAL & add them to the current user Lock
     * @param amount amount of PAL to stake and lock
     * @param duration duration of the Lock (in seconds)
     * @return uint256 : amount of hPAL minted
     */
    function stakeAndIncreaseLock(uint256 amount, uint256 duration) external returns(uint256) {
        if(emergency) revert EmergencyBlock();
        require(userLocks[msg.sender].length != 0, "hPAL: No Lock");
        // Find the current Lock
        uint256 currentUserLockIndex = userLocks[msg.sender].length - 1;
        uint256 previousLockAmount = userLocks[msg.sender][currentUserLockIndex].amount;
        // Stake the new amount
        uint256 stakedAmount = _stake(msg.sender, amount);
        // No need to update user rewards since it's done through the _stake() method
        if(delegates[msg.sender] == address(0)){
            _delegate(msg.sender, msg.sender);
        }
        // Then update the lock with the new increased amount
        if(duration == userLocks[msg.sender][currentUserLockIndex].duration) {
            _lock(msg.sender, previousLockAmount + amount, duration, LockAction.INCREASE_AMOUNT);
        } else {
            _lock(msg.sender, previousLockAmount + amount, duration, LockAction.LOCK);
        }
        return stakedAmount;
    }

    /**
     * @notice Delegates the caller voting power to another address
     * @param delegatee address to delegate to
     */
    function delegate(address delegatee) external virtual {
        if(emergency) revert EmergencyBlock();
        return _delegate(_msgSender(), delegatee);
    }

    /**
     * @notice Claim the given amount of rewards for the caller
     * @param amount amount ot claim
     */
    function claim(uint256 amount) external {
        if(emergency) revert EmergencyBlock();
        // Update user rewards before any change on their balance (staked and locked)
        _updateUserRewards(msg.sender);

        require(amount > 0, "hPAL: incorrect amount");

        // Cannot claim more than accrued rewards, but we can use a higher amount to claim all the rewards
        uint256 claimAmount = amount < claimableRewards[msg.sender] ? amount : claimableRewards[msg.sender];

        // remove the claimed amount from the claimable mapping for the user, 
        // and transfer the PAL from the rewardsVault to the user
        claimableRewards[msg.sender] -= claimAmount;

        pal.safeTransferFrom(rewardsVault, msg.sender, claimAmount);

        emit ClaimRewards(msg.sender, claimAmount);
    }

    /**
     * @notice Updates the global Reward State for the contract
     */
    function updateRewardState() external {
        if(emergency) revert EmergencyBlock();
        _updateRewardState();
    }

    /**
     * @notice Updates the given user Reward State
     * @param user address of the user to update
     */
    function updateUserRewardState(address user) external {
        if(emergency) revert EmergencyBlock();
        _updateUserRewards(user);
    }

    // ---------------

    /**
     * @notice Estimates the new Cooldown for the receiver, based on sender & amount of transfer
     * @param sender address of the sender
     * @param receiver address fo the receiver
     * @param amount amount ot transfer
     * @return uint256 : new cooldown
     */
    function getNewReceiverCooldown(address sender, address receiver, uint256 amount) external view returns(uint256) {
        uint256 senderCooldown = cooldowns[sender];
        uint256 receiverBalance = balanceOf(receiver);

        return _getNewReceiverCooldown(
            senderCooldown,
            amount,
            receiver,
            receiverBalance
        );
    }

    /**
     * @notice Get the total number of Locks for an user
     * @param user address of the user
     * @return uint256 : total number of Locks
     */
    function getUserLockCount(address user) external view returns(uint256) {
        return userLocks[user].length;
    }

    /**
     * @notice Get the current user Lock
     * @param user address of the user
     * @return UserLock : user Lock
     */
    function getUserLock(address user) external view returns(UserLock memory) {
        //If the contract is blocked (emergency mode)
        //Or if the user does not have a Lock yet
        //Return an empty lock
        if(emergency || userLocks[user].length == 0) return UserLock(0, 0, 0, 0);
        uint256 lastUserLockIndex = userLocks[user].length - 1;
        return userLocks[user][lastUserLockIndex];
    }

    /**
     * @notice Get the user Lock at a given block (returns empty Lock if not existing / block number too old)
     * @param user address of the user
     * @param blockNumber block number
     * @return UserLock : user past Lock
     */
    function getUserPastLock(address user, uint256 blockNumber) external view returns(UserLock memory) {
        return _getPastLock(user, blockNumber);
    }

    /**
     * @notice Get the total count of TotalLock
     * @return uint256 : total count
     */
    function getTotalLockLength() external view returns(uint256){
        return totalLocks.length;
    }

    /**
     * @notice Get the latest TotalLock
     * @return TotalLock : current TotalLock
     */
    function getCurrentTotalLock() external view returns(TotalLock memory){
        if(emergency) return TotalLock(0, 0); //If the contract is blocked (emergency mode), return an empty totalLocked
        return totalLocks[totalLocks.length - 1];
    }

    /**
     * @notice Get the TotalLock at a given block
     * @param blockNumber block number
     * @return TotalLock : past TotalLock
     */
    function getPastTotalLock(uint256 blockNumber) external view returns(TotalLock memory) {
        require(
            blockNumber < block.number,
            "hPAL: invalid blockNumber"
        );

        TotalLock memory emptyLock = TotalLock(
            0,
            0
        );

        uint256 nbCheckpoints = totalLocks.length;

        // last checkpoint check
        if (totalLocks[nbCheckpoints - 1].fromBlock <= blockNumber) {
            return totalLocks[nbCheckpoints - 1];
        }

        // no checkpoint old enough
        if (totalLocks[0].fromBlock > blockNumber) {
            return emptyLock;
        }

        uint256 high = nbCheckpoints - 1; // last checkpoint already checked
        uint256 low = 0;
        uint256 mid;
        while (low < high) {
            mid = Math.average(low, high);
            if (totalLocks[mid].fromBlock == blockNumber) {
                return totalLocks[mid];
            }
            if (totalLocks[mid].fromBlock > blockNumber) {
                high = mid;
            } else {
                low = mid + 1;
            }
        }
        return high == 0 ? emptyLock : totalLocks[high - 1];
    }

    /**
     * @notice Get the user available balance (staked - locked)
     * @param user address of the user
     * @return uint256 : available balance
     */
    function availableBalanceOf(address user) external view returns(uint256) {
        return _availableBalanceOf(user);
    }

    /**
     * @notice Get all user balances
     * @param user address of the user
     * @return staked : staked balance
     * @return locked : locked balance
     * @return available : available balance (staked - locked)
     */
    function allBalancesOf(address user) external view returns(
        uint256 staked,
        uint256 locked,
        uint256 available
    ) {
        // If the contract was blocked (emergency mode) or
        // If the user has no Lock
        // then available == staked
        if(emergency || userLocks[user].length == 0) {
            return(
                balanceOf(user),
                0,
                balanceOf(user)
            );
        }
        // If a Lock exists
        // Then return
        // total staked balance
        // locked balance
        // available balance (staked - locked)
        uint256 lastUserLockIndex = userLocks[user].length - 1;
        return(
            balanceOf(user),
            uint256(userLocks[user][lastUserLockIndex].amount),
            balanceOf(user) - uint256(userLocks[user][lastUserLockIndex].amount)
        );
    }

    /**
     * @notice Get the estimated current amount of rewards claimable by the user
     * @param user address of the user
     * @return uint256 : estimated amount of rewards to claim
     */
    function estimateClaimableRewards(address user) external view returns(uint256) {
        // no rewards for address 0x0
        // & in case of emergency mode, show 0
        if(emergency || user == address(0)) return 0;
        // If the user rewards where updated on that block, then return the last updated value
        if(rewardsLastUpdate[user] == block.timestamp) return claimableRewards[user];

        // Get the user current claimable amount
        uint256 estimatedClaimableRewards = claimableRewards[user];
        // Get the last updated reward index
        uint256 currentRewardIndex = rewardIndex;

        if(lastRewardUpdate < block.timestamp){
            // If needed, update the reward index
            currentRewardIndex = _getNewIndex(currentDropPerSecond);
        }

        (uint256 accruedRewards,) = _getUserAccruedRewards(user, currentRewardIndex);

        estimatedClaimableRewards += accruedRewards;

        return estimatedClaimableRewards;
    }

    /**
     * @notice Current number of vote checkpoints for the user
     * @param account address of the user
     * @return uint256 : number of checkpoints
     */
    function numCheckpoints(address account) external view virtual returns (uint256){
        return checkpoints[account].length;
    }

    /**
     * @notice Get the user current voting power (with bonus voting power from the Lock)
     * @param user address of the user
     * @return uint256 : user current voting power
     */
    function getCurrentVotes(address user) external view returns (uint256) {
        if(emergency) return 0; //If emergency mode, do not show voting power

        uint256 nbCheckpoints = checkpoints[user].length;
        // current votes with delegation
        uint256 currentVotes = nbCheckpoints == 0 ? 0 : checkpoints[user][nbCheckpoints - 1].votes;

        // check if user has a lock
        uint256 nbLocks = userLocks[user].length;

        if(nbLocks == 0) return currentVotes;

        // and if there is a lock, and user self-delegate, add the bonus voting power 
        uint256 lockAmount = userLocks[user][nbLocks - 1].amount;
        uint256 bonusVotes = delegates[user] == user && userLocks[user][nbLocks - 1].duration >= ONE_YEAR ? (lockAmount * bonusLockVoteRatio) / UNIT : 0;

        return currentVotes + bonusVotes;
    }

    /**
     * @notice Get the user voting power for a given block (with bonus voting power from the Lock)
     * @param user address of the user
     * @param blockNumber block number
     * @return uint256 : user past voting power
     */
    function getPastVotes(address user, uint256 blockNumber) external view returns(uint256) {
        // votes with delegation for the given block
        uint256 votes = _getPastVotes(user, blockNumber);


        // check if user has a lock at that block
        UserLock memory pastLock = _getPastLock(user, blockNumber);
        // and if there is a lock, and user self-delegated, add the bonus voting power 
        uint256 bonusVotes = getPastDelegate(user, blockNumber) == user && pastLock.duration >= ONE_YEAR ? (pastLock.amount * bonusLockVoteRatio) / UNIT : 0;

        return votes + bonusVotes;
    }

    /**
     * @notice Get the user delegate at a given block
     * @param account address of the user
     * @param blockNumber block number
     * @return address : delegate
     */
    function getPastDelegate(address account, uint256 blockNumber)
        public
        view
        returns (address)
    {
        require(
            blockNumber < block.number,
            "hPAL: invalid blockNumber"
        );

        // no checkpoints written
        uint256 nbCheckpoints = delegateCheckpoints[account].length;
        if (nbCheckpoints == 0) return address(0);

        // last checkpoint check
        if (delegateCheckpoints[account][nbCheckpoints - 1].fromBlock <= blockNumber) {
            return delegateCheckpoints[account][nbCheckpoints - 1].delegate;
        }

        // no checkpoint old enough
        if (delegateCheckpoints[account][0].fromBlock > blockNumber) {
            return address(0);
        }

        uint256 high = nbCheckpoints - 1; // last checkpoint already checked
        uint256 low = 0;
        uint256 mid;
        while (low < high) {
            mid = Math.average(low, high);
            if (delegateCheckpoints[account][mid].fromBlock == blockNumber) {
                return delegateCheckpoints[account][mid].delegate;
            }
            if (delegateCheckpoints[account][mid].fromBlock > blockNumber) {
                high = mid;
            } else {
                low = mid + 1;
            }
        }
        return high == 0 ? address(0) : delegateCheckpoints[account][high - 1].delegate;
    }

    // ----------------

    // Find the user available balance (staked - locked) => the balance that can be transfered
    function _availableBalanceOf(address user) internal view returns(uint256) {
        if(userLocks[user].length == 0) return balanceOf(user);
        uint256 lastUserLockIndex = userLocks[user].length - 1;
        return balanceOf(user) - uint256(userLocks[user][lastUserLockIndex].amount);
    }

    // Update dropPerSecond value
    function _updateDropPerSecond() internal returns (uint256){
        // If no more need for monthly updates => decrease duration is over
        if(block.timestamp > startDropTimestamp + dropDecreaseDuration) {
            // Set the current DropPerSecond as the end value
            // Plus allows to be updated if the end value is later updated
            if(currentDropPerSecond != endDropPerSecond) {
                currentDropPerSecond = endDropPerSecond;
                lastDropUpdate = block.timestamp;
            }

            return endDropPerSecond;
        }

        if(block.timestamp < lastDropUpdate + MONTH) return currentDropPerSecond; // Update it once a month

        uint256 dropDecreasePerMonth = (startDropPerSecond - endDropPerSecond) / (dropDecreaseDuration / MONTH);
        uint256 nbMonthEllapsed = (block.timestamp - lastDropUpdate) / MONTH;

        uint256 dropPerSecondDecrease = dropDecreasePerMonth * nbMonthEllapsed;

        // We calculate the new dropPerSecond value
        // We don't want to go under the endDropPerSecond
        uint256 newDropPerSecond = currentDropPerSecond - dropPerSecondDecrease > endDropPerSecond ? currentDropPerSecond - dropPerSecondDecrease : endDropPerSecond;
    
        currentDropPerSecond = newDropPerSecond;
        lastDropUpdate = block.timestamp;

        return newDropPerSecond;
    }

    function _getNewIndex(uint256 _currentDropPerSecond) internal view returns (uint256){
        // Get the current total Supply
        uint256 currentTotalSupply = totalSupply();
        // and the seconds since the last update
        uint256 ellapsedTime = block.timestamp - lastRewardUpdate;

        // DropPerSeond without any multiplier => the base dropPerSecond for stakers
        // The multiplier for LockedBalance is applied later, accruing more rewards depending on the Lock.
        uint256 baseDropPerSecond = (_currentDropPerSecond * UNIT) / maxLockBonusRatio;

        // total base reward (without multiplier) to be distributed since last update
        uint256 accruedBaseAmount = ellapsedTime * baseDropPerSecond;

         // calculate the ratio to add to the index
        uint256 ratio = currentTotalSupply > 0 ? (accruedBaseAmount * UNIT) / currentTotalSupply : 0;

        return rewardIndex + ratio;
    }

    // Update global reward state internal
    function _updateRewardState() internal returns (uint256){
        if(lastRewardUpdate == block.timestamp) return rewardIndex; // Already updated for this block

        // Update (if needed) & get the current DropPerSecond
        uint256 _currentDropPerSecond = _updateDropPerSecond();

        // Update the index
        uint256 newIndex = _getNewIndex(_currentDropPerSecond);
        rewardIndex = newIndex;
        lastRewardUpdate = block.timestamp;

        return newIndex;
    }

    struct UserLockRewardVars {
        uint256 lastUserLockIndex;
        uint256 previousBonusRatio;
        uint256 userRatioDecrease;
        uint256 bonusRatioDecrease;
        uint256 periodBonusRatio;
    }

    function _getUserAccruedRewards(
        address user,
        uint256 currentRewardsIndex
    ) internal view returns(
        uint256 accruedRewards,
        uint256 newBonusRatio
    ) {
        // Find the user last index & current balances
        uint256 userLastIndex = userRewardIndex[user];
        uint256 userStakedBalance = _availableBalanceOf(user);
        uint256 userLockedBalance = 0;

        if(userLastIndex != currentRewardsIndex){

            if(balanceOf(user) > 0){
                // calculate the base rewards for the user staked balance
                // (using avaialable balance to count the locked balance with the multiplier later in this function)
                uint256 indexDiff = currentRewardsIndex - userLastIndex;

                uint256 stakingRewards = (userStakedBalance * indexDiff) / UNIT;

                uint256 lockingRewards = 0;

                if(userLocks[user].length > 0){
                    UserLockRewardVars memory vars;

                    // and if an user has a lock, calculate the locked rewards
                    vars.lastUserLockIndex = userLocks[user].length - 1;

                    // using the locked balance, and the lock duration
                    userLockedBalance = uint256(userLocks[user][vars.lastUserLockIndex].amount);

                    // Check that the user's Lock is not empty
                    if(userLockedBalance > 0 && userLocks[user][vars.lastUserLockIndex].duration != 0){
                        vars.previousBonusRatio = userCurrentBonusRatio[user];

                        if(vars.previousBonusRatio > 0){
                            vars.userRatioDecrease = userBonusRatioDecrease[user];
                            // Find the new multiplier for user:
                            // From the last Ratio, where we remove userBonusRatioDecrease for each second since last update
                            vars.bonusRatioDecrease = (block.timestamp - rewardsLastUpdate[user]) * vars.userRatioDecrease;
                            
                            newBonusRatio = vars.bonusRatioDecrease >= vars.previousBonusRatio ? 0 : vars.previousBonusRatio - vars.bonusRatioDecrease;

                            if(vars.bonusRatioDecrease >= vars.previousBonusRatio){
                                // Since the last update, bonus ratio decrease under 0
                                // We count the bonusRatioDecrease as the difference between the last Bonus Ratio and 0
                                vars.bonusRatioDecrease = vars.previousBonusRatio;
                                // In the case this update is made far after the end of the lock, this method would mean
                                // the user could get a multiplier for longer than expected
                                // We count on the Kick logic to avoid that scenario
                            }

                            // and calculate the locking rewards based on the locked balance & 
                            // a ratio based on the rpevious one and the newly calculated one
                            vars.periodBonusRatio = newBonusRatio + ((vars.userRatioDecrease + vars.bonusRatioDecrease) / 2);
                            lockingRewards = (userLockedBalance * ((indexDiff * vars.periodBonusRatio) / UNIT)) / UNIT;
                        }
                    }

                }
                // sum up the accrued rewards, and return it
                accruedRewards = stakingRewards + lockingRewards;
            }
        }
    }

    // Update user reward state internal
    function _updateUserRewards(address user) internal {
        // Update the global reward state and get the latest index
        uint256 newIndex = _updateRewardState();

        // Called for minting & burning, but we don't want to update for address 0x0
        if(user == address(0)) return;

        if(rewardsLastUpdate[user] == block.timestamp) return; // Already updated for this block

        // Update the user claimable rewards
        (uint256 accruedRewards, uint256 newBonusRatio) = _getUserAccruedRewards(user, newIndex);
        claimableRewards[user] += accruedRewards;
        // Store the new Bonus Ratio
        userCurrentBonusRatio[user] = newBonusRatio;
        
        // and set the current timestamp for last update, and the last used index for the user rewards
        rewardsLastUpdate[user] = block.timestamp;
        userRewardIndex[user] = newIndex;

    }

    /** @dev Hook called before any transfer */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        if(from != address(0)) { //check must be skipped on minting
            // Only allow the balance that is unlocked to be transfered
            require(amount <= _availableBalanceOf(from), "hPAL: Available balance too low");
        }

        // Update user rewards before any change on their balance (staked and locked)
        _updateUserRewards(from);

        uint256 fromCooldown = cooldowns[from]; //If from is address 0x00...0, cooldown is always 0 

        if(from != to) {
            // Update user rewards before any change on their balance (staked and locked)
            _updateUserRewards(to);
            // => we don't want a self-transfer to double count new claimable rewards
            // + no need to update the cooldown on a self-transfer

            uint256 previousToBalance = balanceOf(to);
            cooldowns[to] = _getNewReceiverCooldown(fromCooldown, amount, to, previousToBalance);
        }

        // If from transfer all of its balance, reset the cooldown to 0
        uint256 previousFromBalance = balanceOf(from);
        if(previousFromBalance == amount && fromCooldown != 0) {
            cooldowns[from] = 0;
        }
    }

    function _afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        // update delegation for the sender & the receiver if they delegate
        _moveDelegates(delegates[from], delegates[to], amount);
    }

    function _getPastLock(address account, uint256 blockNumber) internal view returns(UserLock memory) {
        require(
            blockNumber < block.number,
            "hPAL: invalid blockNumber"
        );

        UserLock memory emptyLock = UserLock(
            0,
            0,
            0,
            0
        );

        // no checkpoints written
        uint256 nbCheckpoints = userLocks[account].length;
        if (nbCheckpoints == 0) return emptyLock;

        // last checkpoint check
        if (userLocks[account][nbCheckpoints - 1].fromBlock <= blockNumber) {
            return userLocks[account][nbCheckpoints - 1];
        }

        // no checkpoint old enough
        if (userLocks[account][0].fromBlock > blockNumber) {
            return emptyLock;
        }

        uint256 high = nbCheckpoints - 1; // last checkpoint already checked
        uint256 low = 0;
        uint256 mid;
        while (low < high) {
            mid = Math.average(low, high);
            if (userLocks[account][mid].fromBlock == blockNumber) {
                return userLocks[account][mid];
            }
            if (userLocks[account][mid].fromBlock > blockNumber) {
                high = mid;
            } else {
                low = mid + 1;
            }
        }
        return high == 0 ? emptyLock : userLocks[account][high - 1];
    }

    function _getPastVotes(address account, uint256 blockNumber) internal view returns (uint256){
        require( blockNumber < block.number, "hPAL: invalid blockNumber");

        // no checkpoints written
        uint256 nbCheckpoints = checkpoints[account].length;
        if (nbCheckpoints == 0) return 0;

        // last checkpoint check
        if (checkpoints[account][nbCheckpoints - 1].fromBlock <= blockNumber) {
            return checkpoints[account][nbCheckpoints - 1].votes;
        }

        // no checkpoint old enough
        if (checkpoints[account][0].fromBlock > blockNumber) return 0;

        uint256 high = nbCheckpoints - 1; // last checkpoint already checked
        uint256 low = 0;
        uint256 mid;
        while (low < high) {
            mid = Math.average(low, high);
            if (checkpoints[account][mid].fromBlock == blockNumber) {
                return checkpoints[account][mid].votes;
            }
            if (checkpoints[account][mid].fromBlock > blockNumber) {
                high = mid;
            } else {
                low = mid + 1;
            }
        }
        return high == 0 ? 0 : checkpoints[account][high - 1].votes;
    }

    function _getPastDelegate(address account, uint256 blockNumber) internal view returns (address) {
        require(blockNumber < block.number, "hPAL: invalid blockNumber");

        // no checkpoints written
        uint256 nbCheckpoints = delegateCheckpoints[account].length;
        if (nbCheckpoints == 0) return address(0);

        // last checkpoint check
        if (delegateCheckpoints[account][nbCheckpoints - 1].fromBlock <= blockNumber) {
            return delegateCheckpoints[account][nbCheckpoints - 1].delegate;
        }

        // no checkpoint old enough
        if (delegateCheckpoints[account][0].fromBlock > blockNumber) return address(0);

        uint256 high = nbCheckpoints - 1; // last checkpoint already checked
        uint256 low = 0;
        uint256 mid;
        while (low < high) {
            mid = Math.average(low, high);
            if (delegateCheckpoints[account][mid].fromBlock == blockNumber) {
                return delegateCheckpoints[account][mid].delegate;
            }
            if (delegateCheckpoints[account][mid].fromBlock > blockNumber) {
                high = mid;
            } else {
                low = mid + 1;
            }
        }
        return high == 0 ? address(0) : delegateCheckpoints[account][high - 1].delegate;
    }

    function _moveDelegates(address from, address to, uint256 amount) internal {
        if (from != to && amount > 0) {
            if (from != address(0)) {
                // Calculate the change in voting power, then write a new checkpoint
                uint256 nbCheckpoints = checkpoints[from].length;
                uint256 oldVotes = nbCheckpoints == 0 ? 0 : checkpoints[from][nbCheckpoints - 1].votes;
                uint256 newVotes = oldVotes - amount;
                _writeCheckpoint(from, newVotes);
                emit DelegateVotesChanged(from, oldVotes, newVotes);
            }

            if (to != address(0)) {
                // Calculate the change in voting power, then write a new checkpoint
                uint256 nbCheckpoints = checkpoints[to].length;
                uint256 oldVotes = nbCheckpoints == 0 ? 0 : checkpoints[to][nbCheckpoints - 1].votes;
                uint256 newVotes = oldVotes + amount;
                _writeCheckpoint(to, newVotes);
                emit DelegateVotesChanged(to, oldVotes, newVotes);
            }
        }
    }

    function _writeCheckpoint(address delegatee, uint256 newVotes) internal {
        // write a new checkpoint for an user
        uint pos = checkpoints[delegatee].length;

        if (pos > 0 && checkpoints[delegatee][pos - 1].fromBlock == block.number) {
            checkpoints[delegatee][pos - 1].votes = safe224(newVotes);
        } else {
            uint32 blockNumber = safe32(block.number);
            checkpoints[delegatee].push(Checkpoint(blockNumber, safe224(newVotes)));
        }
    }

    // -----------------

    function _stake(address user, uint256 amount) internal returns(uint256) {
        require(amount > 0, "hPAL: Null amount");

        // No need to update user rewards here since the _mint() method will trigger _beforeTokenTransfer()
        // Same for the Cooldown update, as it will be handled by _beforeTokenTransfer()    

        _mint(user, amount); //We mint hPAL 1:1 with PAL

        // Pull the PAL into this contract
        pal.safeTransferFrom(user, address(this), amount);

        emit Stake(user, amount);

        return amount;
    }

    function _unstake(address user, uint256 amount, address receiver) internal returns(uint256) {
        require(amount > 0, "hPAL: Null amount");
        require(receiver != address(0), "hPAL: Address Zero");

        // Check if user in inside the allowed period base on its cooldown
        uint256 userCooldown = cooldowns[user];
        require(block.timestamp > (userCooldown + COOLDOWN_PERIOD), "hPAL: Insufficient cooldown");
        require(block.timestamp - (userCooldown + COOLDOWN_PERIOD) <= UNSTAKE_PERIOD, "hPAL: unstake period expired");

        // No need to update user rewards here since the _burn() method will trigger _beforeTokenTransfer()

        // Can only unstake was is available, need to unlock before
        uint256 userAvailableBalance = _availableBalanceOf(user);
        uint256 burnAmount = amount > userAvailableBalance ? userAvailableBalance : amount;

        // Burn the hPAL 1:1 with PAL
        _burn(user, burnAmount);

        // If all the balance is unstaked, cooldown reset is handled by _beforeTokenTransfer()

        // Then transfer the PAL to the user
        pal.safeTransfer(receiver, burnAmount);

        emit Unstake(user, burnAmount);

        return burnAmount;
    }

    // Get the new cooldown for an user receiving hPAL (mint or transfer),
    // based on receiver cooldown and sender cooldown
    // Inspired by stkAAVE cooldown system
    function _getNewReceiverCooldown(
        uint256 senderCooldown,
        uint256 amount,
        address receiver,
        uint256 receiverBalance
    ) internal view returns(uint256) {
        uint256 receiverCooldown = cooldowns[receiver];

        // If receiver has no cooldown, no need to set a new one
        if(receiverCooldown == 0) return 0;

        uint256 minValidCooldown = block.timestamp - (COOLDOWN_PERIOD + UNSTAKE_PERIOD);

        // If last receiver cooldown is expired, set it back to 0
        if(receiverCooldown < minValidCooldown) return 0;

        // In case the given senderCooldown is 0 (sender has no cooldown, or minting)
        uint256 _senderCooldown = senderCooldown < minValidCooldown ? block.timestamp : senderCooldown;

        // If the sender cooldown is better, we keep the receiver cooldown
        if(_senderCooldown < receiverCooldown) return receiverCooldown;

        // Default new cooldown, weighted average based on the amount and the previous balance
        return ((amount * _senderCooldown) + (receiverBalance * receiverCooldown)) / (amount + receiverBalance);

    }

    enum LockAction { LOCK, INCREASE_AMOUNT, INCREASE_DURATION }

    function _lock(address user, uint256 amount, uint256 duration, LockAction action) internal {
        require(user != address(0)); //Never supposed to happen, but security check
        require(amount != 0, "hPAL: Null amount");
        uint256 userBalance = balanceOf(user);
        require(amount <= userBalance, "hPAL: Amount over balance");
        require(duration >= MIN_LOCK_DURATION, "hPAL: Lock duration under min");
        require(duration <= MAX_LOCK_DURATION, "hPAL: Lock duration over max");

        if(userLocks[user].length == 0){
            //User 1st Lock

            userLocks[user].push(UserLock(
                safe128(amount),
                safe48(block.timestamp),
                safe48(duration),
                safe32(block.number)
            ));

            // find the reward multiplier based on the user lock duration
            uint256 durationRatio = ((duration - MIN_LOCK_DURATION) * UNIT) / (MAX_LOCK_DURATION - MIN_LOCK_DURATION);
            uint256 userLockBonusRatio = minLockBonusRatio + (((maxLockBonusRatio - minLockBonusRatio) * durationRatio) / UNIT);

            userCurrentBonusRatio[user] = userLockBonusRatio;
            userBonusRatioDecrease[user] = (userLockBonusRatio - baseLockBonusRatio) / duration;

            // Update total locked supply
            currentTotalLocked += amount;
            totalLocks.push(TotalLock(
                safe224(currentTotalLocked),
                safe32(block.number)
            ));

            emit Lock(user, amount, block.timestamp, duration, currentTotalLocked);
        } 
        else {
            // Get the current user Lock
            uint256 currentUserLockIndex = userLocks[user].length - 1;
            UserLock storage currentUserLock = userLocks[user][currentUserLockIndex];
            // Calculate the end of the user current lock
            uint256 userCurrentLockEnd = currentUserLock.startTimestamp + currentUserLock.duration;

            uint256 startTimestamp = block.timestamp;

            if(currentUserLock.amount == 0 || userCurrentLockEnd < block.timestamp) { 
                // User locked, and then unlocked
                // or user lock expired

                userLocks[user].push(UserLock(
                    safe128(amount),
                    safe48(startTimestamp),
                    safe48(duration),
                    safe32(block.number)
                ));
            }
            else {
                // Update of the current Lock : increase amount or increase duration
                // or renew with the same parameters, but starting at the current timestamp
                require(amount >=  currentUserLock.amount,"hPAL: smaller amount");
                require(duration >=  currentUserLock.duration,"hPAL: smaller duration");

                // If the method is called with INCREASE_AMOUNT, then we don't change the startTimestamp of the Lock

                userLocks[user].push(UserLock(
                    safe128(amount),
                    action == LockAction.INCREASE_AMOUNT ? currentUserLock.startTimestamp : safe48(startTimestamp),
                    safe48(duration),
                    safe32(block.number)
                ));

                startTimestamp = action == LockAction.INCREASE_AMOUNT ? currentUserLock.startTimestamp : startTimestamp;
            }

            // If the duration is updated, re-calculate the multiplier for the Lock
            if(action != LockAction.INCREASE_AMOUNT){
                // find the reward multiplier based on the user lock duration
                uint256 durationRatio = ((duration - MIN_LOCK_DURATION) * UNIT) / (MAX_LOCK_DURATION - MIN_LOCK_DURATION);
                uint256 userLockBonusRatio = minLockBonusRatio + (((maxLockBonusRatio - minLockBonusRatio) * durationRatio) / UNIT);

                userCurrentBonusRatio[user] = userLockBonusRatio;
                userBonusRatioDecrease[user] = (userLockBonusRatio - baseLockBonusRatio) / duration;
            }
            
            // Update total locked supply
            if(amount != currentUserLock.amount){

                if(currentUserLock.amount != 0) currentTotalLocked -= currentUserLock.amount;
                
                currentTotalLocked += amount;
                totalLocks.push(TotalLock(
                    safe224(currentTotalLocked),
                    safe32(block.number)
                ));
            }

            emit Lock(user, amount, startTimestamp, duration, currentTotalLocked);
        }
    }

    function _unlock(address user) internal {
        require(user != address(0)); //Never supposed to happen, but security check
        require(userLocks[user].length > 0, "hPAL: No Lock");

        // Get the user current Lock
        // And calculate the end of the Lock
        uint256 currentUserLockIndex = userLocks[user].length - 1;
        UserLock storage currentUserLock = userLocks[user][currentUserLockIndex];
        uint256 userCurrentLockEnd = currentUserLock.startTimestamp + currentUserLock.duration;

        require(block.timestamp > userCurrentLockEnd, "hPAL: Not expired");
        require(currentUserLock.amount > 0, "hPAL: No Lock");

        // Remove amount from total locked supply
        currentTotalLocked -= currentUserLock.amount;
        totalLocks.push(TotalLock(
            safe224(currentTotalLocked),
            safe32(block.number)
        ));

        // Remove the bonus multiplier
        userCurrentBonusRatio[user] = 0;
        userBonusRatioDecrease[user] = 0;

        // Set the user Lock as an empty Lock
        userLocks[user].push(UserLock(
            safe128(0),
            safe48(block.timestamp),
            safe48(0),
            safe32(block.number)
        ));

        emit Unlock(user, currentUserLock.amount, currentTotalLocked);
    }

    function _kick(address user, address kicker) internal {
        require(user != address(0) && kicker != address(0), "hPAL: Address Zero");
        require(userLocks[user].length > 0, "hPAL: No Lock");

        // Get the user to kick current Lock
        // and calculate the end of the Lock
        uint256 currentUserLockIndex = userLocks[user].length - 1;
        UserLock storage currentUserLock = userLocks[user][currentUserLockIndex];
        uint256 userCurrentLockEnd = currentUserLock.startTimestamp + currentUserLock.duration;

        require(block.timestamp > userCurrentLockEnd, "hPAL: Not expired");
        require(currentUserLock.amount > 0, "hPAL: No Lock");

        require(block.timestamp > userCurrentLockEnd + UNLOCK_DELAY, "hPAL: Not kickable");

        // Remove amount from total locked supply
        currentTotalLocked -= currentUserLock.amount;
        totalLocks.push(TotalLock(
            safe224(currentTotalLocked),
            safe32(block.number)
        ));

        // Set an empty Lock for the user
        userLocks[user].push(UserLock(
            safe128(0),
            safe48(block.timestamp),
            safe48(0),
            safe32(block.number)
        ));

        // Remove the bonus multiplier
        userCurrentBonusRatio[user] = 0;
        userBonusRatioDecrease[user] = 0;

        // Calculate the penalty for the Lock
        uint256 nbWeeksOverLockTime = (block.timestamp - userCurrentLockEnd) / WEEK;
        uint256 penaltyPercent = nbWeeksOverLockTime * kickRatioPerWeek;
        uint256 penaltyAmount = penaltyPercent >= MAX_BPS ? 
            currentUserLock.amount : 
            (currentUserLock.amount * penaltyPercent) / MAX_BPS;

        // Send penalties to the kicker
        _transfer(user, kicker, penaltyAmount);

        emit Kick(user, kicker, currentUserLock.amount, penaltyAmount, currentTotalLocked);
    }

    function _delegate(address delegator, address delegatee) internal {
        // Move delegation from the old delegate to the given delegate
        address oldDelegatee = delegates[delegator];
        uint256 delegatorBalance = balanceOf(delegator);
        delegates[delegator] = delegatee;

        // update the the Delegate chekpoint for the delegatee
        delegateCheckpoints[delegator].push(DelegateCheckpoint(safe32(block.number), delegatee));

        emit DelegateChanged(delegator, oldDelegatee, delegatee);

        // and write the checkpoints for Votes
        _moveDelegates(oldDelegatee, delegatee, delegatorBalance);
    }

    /**
     * @notice Allow to withdraw with override of the lock & cooldown in case of emergency
     * @param amount amount to withdraw
     * @param receiver address to receive the withdrawn funds
     * @return uint256 : amount withdrawn
     */
    function emergencyWithdraw(uint256 amount, address receiver) external returns(uint256) {

        require(emergency, "hPAL: Not emergency");

        require(amount > 0, "hPAL: Null amount");
        require(receiver != address(0), "hPAL: Address Zero");

        if(userLocks[msg.sender].length != 0){
            // Check if the user has a Lock, and if so, fetch it
            uint256 currentUserLockIndex = userLocks[msg.sender].length - 1;
            UserLock storage currentUserLock = userLocks[msg.sender][currentUserLockIndex];

            // To remove the Lock and update the total locked
            currentTotalLocked -= currentUserLock.amount;
            totalLocks.push(TotalLock(
                safe224(currentTotalLocked),
                safe32(block.number)
            ));

            userLocks[msg.sender].push(UserLock(
                safe128(0),
                safe48(block.timestamp),
                safe48(0),
                safe32(block.number)
            ));
        }

        // Get the user hPAL balance, and burn & send the given amount, or the user balance if the amount is bigger
        uint256 userAvailableBalance = balanceOf(msg.sender);
        uint256 burnAmount = amount > userAvailableBalance ? userAvailableBalance : amount;

        _burn(msg.sender, burnAmount);

        // Transfer the PAL to the user
        pal.safeTransfer(receiver, burnAmount);

        emit EmergencyUnstake(msg.sender, burnAmount);

        return burnAmount;

    }

    // Utils

    error Exceed224Bits(); 
    error Exceed128Bits(); 
    error Exceed48Bits(); 
    error Exceed32Bits(); 

    function safe32(uint n) internal pure returns (uint32) {
        if(n > type(uint32).max) revert Exceed32Bits();
        return uint32(n);
    }

    function safe48(uint n) internal pure returns (uint48) {
        if(n > type(uint48).max) revert Exceed48Bits();
        return uint48(n);
    }

    function safe128(uint n) internal pure returns (uint128) {
        if(n > type(uint128).max) revert Exceed128Bits();
        return uint128(n);
    }

    function safe224(uint n) internal pure returns (uint224) {
        if(n > type(uint224).max) revert Exceed224Bits();
        return uint224(n);
    }

    // Admin methods

    error IncorrectParameters();
    error DecreaseDurationNotOver();

    /**
     * @notice Updates the ratio of penalty applied for each week after boost expiry
     * @param newKickRatioPerWeek new kick ratio (in BPS)
     */
    function setKickRatio(uint256 newKickRatioPerWeek) external onlyOwner {
        if(newKickRatioPerWeek == 0 || newKickRatioPerWeek > 5000) revert IncorrectParameters();
        kickRatioPerWeek = newKickRatioPerWeek;
    }

    /**
     * @notice Triggers the emergency mode on the smart contract (admin method)
     * @param trigger True to set the emergency mode
     */
    function triggerEmergencyWithdraw(bool trigger) external onlyOwner {
        emergency = trigger;
    }

    /**
     * @notice Updates the EndDropPerSecond for the rewards distribution (after the 2 year decrease period) (admin method)
     * @param newEndDropPerSecond new amount of PAL to distribute per second
     */
    function setEndDropPerSecond(uint256 newEndDropPerSecond) external onlyOwner {
        if(block.timestamp < startDropTimestamp + dropDecreaseDuration) revert DecreaseDurationNotOver();
        endDropPerSecond = newEndDropPerSecond;
    }
}