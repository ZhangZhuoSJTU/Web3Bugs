// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../libraries/ScaledMath.sol";
import "../libraries/Errors.sol";
import "../libraries/EnumerableExtensions.sol";
import "../libraries/UncheckedMath.sol";
import "../interfaces/IBkdLocker.sol";
import "../interfaces/tokenomics/IMigrationContract.sol";
import "./utils/Preparable.sol";
import "./access/Authorization.sol";

contract BkdLocker is IBkdLocker, Authorization, Preparable {
    using ScaledMath for uint256;
    using UncheckedMath for uint256;
    using SafeERC20 for IERC20;
    using EnumerableMapping for EnumerableMapping.AddressToUintMap;
    using EnumerableExtensions for EnumerableMapping.AddressToUintMap;

    bytes32 internal constant _START_BOOST = "startBoost";
    bytes32 internal constant _MAX_BOOST = "maxBoost";
    bytes32 internal constant _INCREASE_PERIOD = "increasePeriod";
    bytes32 internal constant _WITHDRAW_DELAY = "withdrawDelay";

    // User-specific data
    mapping(address => uint256) public balances;
    mapping(address => uint256) public boostFactors;
    mapping(address => uint256) public lastUpdated;
    mapping(address => WithdrawStash[]) public stashedGovTokens;
    mapping(address => uint256) public totalStashed;

    // Global data
    uint256 public totalLocked;
    uint256 public totalLockedBoosted;
    uint256 public lastMigrationEvent;
    EnumerableMapping.AddressToUintMap private _replacedRewardTokens;

    // Reward token data
    mapping(address => RewardTokenData) public rewardTokenData;
    address public override rewardToken;
    IERC20 public immutable govToken;

    constructor(
        address _rewardToken,
        address _govToken,
        IRoleManager roleManager
    ) Authorization(roleManager) {
        rewardToken = _rewardToken;
        govToken = IERC20(_govToken);
    }

    function initialize(
        uint256 startBoost,
        uint256 maxBoost,
        uint256 increasePeriod,
        uint256 withdrawDelay
    ) external override onlyGovernance {
        require(currentUInts256[_START_BOOST] == 0, Error.CONTRACT_INITIALIZED);
        _setConfig(_START_BOOST, startBoost);
        _setConfig(_MAX_BOOST, maxBoost);
        _setConfig(_INCREASE_PERIOD, increasePeriod);
        _setConfig(_WITHDRAW_DELAY, withdrawDelay);
    }

    /**
     * @notice Sets a new token to be the rewardToken. Fees are then accumulated in this token.
     * @dev Previously used rewardTokens can be set again here.
     */
    function migrate(address newRewardToken) external override onlyGovernance {
        _replacedRewardTokens.remove(newRewardToken);
        _replacedRewardTokens.set(rewardToken, block.timestamp);
        lastMigrationEvent = block.timestamp;
        rewardToken = newRewardToken;
    }

    /**
     * @notice Lock gov. tokens.
     * @dev The amount needs to be approved in advance.
     */
    function lock(uint256 amount) external override {
        return lockFor(msg.sender, amount);
    }

    /**
     * @notice Deposit fees (in the rewardToken) to be distributed to lockers of gov. tokens.
     * @dev `deposit` or `depositFor` needs to be called at least once before this function can be called
     * @param amount Amount of rewardToken to deposit.
     */
    function depositFees(uint256 amount) external override {
        require(amount > 0, Error.INVALID_AMOUNT);
        require(totalLockedBoosted > 0, Error.NOT_ENOUGH_FUNDS);
        IERC20(rewardToken).safeTransferFrom(msg.sender, address(this), amount);

        RewardTokenData storage curRewardTokenData = rewardTokenData[rewardToken];

        curRewardTokenData.feeIntegral += amount.scaledDiv(totalLockedBoosted);
        curRewardTokenData.feeBalance += amount;
        emit FeesDeposited(amount);
    }

    function claimFees() external override {
        claimFees(rewardToken);
    }

    /**
     * @notice Checkpoint function to update user data, in particular the boost factor.
     */
    function userCheckpoint(address user) external override {
        _userCheckpoint(user, 0, balances[user]);
    }

    /**
     * @notice Prepare unlocking of locked gov. tokens.
     * @dev A delay is enforced and unlocking can only be executed after that.
     * @param amount Amount of gov. tokens to prepare for unlocking.
     */
    function prepareUnlock(uint256 amount) external override {
        require(
            totalStashed[msg.sender] + amount <= balances[msg.sender],
            "Amount exceeds locked balance"
        );
        totalStashed[msg.sender] += amount;
        stashedGovTokens[msg.sender].push(
            WithdrawStash(block.timestamp + currentUInts256[_WITHDRAW_DELAY], amount)
        );
        emit WithdrawPrepared(msg.sender, amount);
    }

    /**
     * @notice Execute all prepared gov. token withdrawals.
     */
    function executeUnlocks() external override {
        uint256 totalAvailableToWithdraw;
        WithdrawStash[] storage stashedWithdraws = stashedGovTokens[msg.sender];
        uint256 length = stashedWithdraws.length;
        require(length > 0, "No entries");
        uint256 i = length;
        while (i > 0) {
            i = i - 1;
            if (stashedWithdraws[i].releaseTime <= block.timestamp) {
                totalAvailableToWithdraw += stashedWithdraws[i].amount;

                stashedWithdraws[i] = stashedWithdraws[stashedWithdraws.length - 1];

                stashedWithdraws.pop();
            }
        }
        totalStashed[msg.sender] -= totalAvailableToWithdraw;
        uint256 newTotal = balances[msg.sender] - totalAvailableToWithdraw;
        _userCheckpoint(msg.sender, 0, newTotal);
        totalLocked -= totalAvailableToWithdraw;
        govToken.safeTransfer(msg.sender, totalAvailableToWithdraw);
        emit WithdrawExecuted(msg.sender, totalAvailableToWithdraw);
    }

    function getUserShare(address user) external view override returns (uint256) {
        return getUserShare(user, rewardToken);
    }

    /**
     * @notice Get the boosted locked balance for a user.
     * @dev This includes the gov. tokens queued for withdrawal.
     * @param user Address to get the boosted balance for.
     * @return boosted balance for user.
     */
    function boostedBalance(address user) external view override returns (uint256) {
        return balances[user].scaledMul(boostFactors[user]);
    }

    /**
     * @notice Get the vote weight for a user.
     * @dev This does not invlude the gov. tokens queued for withdrawal.
     * @param user Address to get the vote weight for.
     * @return vote weight for user.
     */
    function balanceOf(address user) external view override returns (uint256) {
        return (balances[user] - totalStashed[user]).scaledMul(boostFactors[user]);
    }

    /**
     * @notice Get the share of the total boosted locked balance for a user.
     * @dev This includes the gov. tokens queued for withdrawal.
     * @param user Address to get the share of the total boosted balance for.
     * @return share of the total boosted balance for user.
     */
    function getShareOfTotalBoostedBalance(address user) external view override returns (uint256) {
        return balances[user].scaledMul(boostFactors[user]).scaledDiv(totalLockedBoosted);
    }

    function getStashedGovTokens(address user)
        external
        view
        override
        returns (WithdrawStash[] memory)
    {
        return stashedGovTokens[user];
    }

    function claimableFees(address user) external view override returns (uint256) {
        return claimableFees(user, rewardToken);
    }

    /**
     * @notice Claim fees accumulated in the Locker.
     */
    function claimFees(address _rewardToken) public override {
        require(
            _rewardToken == rewardToken || _replacedRewardTokens.contains(_rewardToken),
            Error.INVALID_ARGUMENT
        );
        _userCheckpoint(msg.sender, 0, balances[msg.sender]);
        RewardTokenData storage curRewardTokenData = rewardTokenData[_rewardToken];
        uint256 claimable = curRewardTokenData.userShares[msg.sender];
        curRewardTokenData.userShares[msg.sender] = 0;
        curRewardTokenData.feeBalance -= claimable;
        IERC20(_rewardToken).safeTransfer(msg.sender, claimable);
        emit RewardsClaimed(msg.sender, _rewardToken, claimable);
    }

    /**
     * @notice Lock gov. tokens on behalf of another user.
     * @dev The amount needs to be approved in advance.
     * @param user Address of user to lock on behalf of.
     * @param amount Amount of gov. tokens to lock.
     */
    function lockFor(address user, uint256 amount) public override {
        govToken.safeTransferFrom(msg.sender, address(this), amount);
        _userCheckpoint(user, amount, balances[user] + amount);
        totalLocked += amount;
        emit Locked(user, amount);
    }

    function getUserShare(address user, address _rewardToken)
        public
        view
        override
        returns (uint256)
    {
        return rewardTokenData[_rewardToken].userShares[user];
    }

    function claimableFees(address user, address _rewardToken)
        public
        view
        override
        returns (uint256)
    {
        uint256 currentShare;
        uint256 userBalance = balances[user];
        RewardTokenData storage curRewardTokenData = rewardTokenData[_rewardToken];

        // Compute the share earned by the user since they last updated
        if (userBalance > 0) {
            currentShare += (curRewardTokenData.feeIntegral -
                curRewardTokenData.userFeeIntegrals[user]).scaledMul(
                    userBalance.scaledMul(boostFactors[user])
                );
        }
        return curRewardTokenData.userShares[user] + currentShare;
    }

    function computeNewBoost(
        address user,
        uint256 amountAdded,
        uint256 newTotal
    ) public view override returns (uint256) {
        uint256 newBoost;
        uint256 balance = balances[user];
        uint256 startBoost = currentUInts256[_START_BOOST];
        if (balance == 0 || newTotal == 0) {
            newBoost = startBoost;
        } else {
            uint256 maxBoost = currentUInts256[_MAX_BOOST];
            newBoost = boostFactors[user];
            newBoost += (block.timestamp - lastUpdated[user])
                .scaledDiv(currentUInts256[_INCREASE_PERIOD])
                .scaledMul(maxBoost - startBoost);
            if (newBoost > maxBoost) {
                newBoost = maxBoost;
            }
            if (newTotal <= balance) {
                return newBoost;
            }
            newBoost =
                newBoost.scaledMul(balance.scaledDiv(newTotal)) +
                startBoost.scaledMul(amountAdded.scaledDiv(newTotal));
        }
        return newBoost;
    }

    function _userCheckpoint(
        address user,
        uint256 amountAdded,
        uint256 newTotal
    ) internal {
        RewardTokenData storage curRewardTokenData = rewardTokenData[rewardToken];

        // Compute the share earned by the user since they last updated
        uint256 userBalance = balances[user];
        if (userBalance > 0) {
            curRewardTokenData.userShares[user] += (curRewardTokenData.feeIntegral -
                curRewardTokenData.userFeeIntegrals[user]).scaledMul(
                    userBalance.scaledMul(boostFactors[user])
                );

            // Update values for previous rewardTokens
            if (lastUpdated[user] < lastMigrationEvent) {
                uint256 length = _replacedRewardTokens.length();
                for (uint256 i; i < length; i = i.uncheckedInc()) {
                    (address token, uint256 replacedAt) = _replacedRewardTokens.at(i);
                    if (lastUpdated[user] < replacedAt) {
                        RewardTokenData storage prevRewardTokenData = rewardTokenData[token];
                        prevRewardTokenData.userShares[user] += (prevRewardTokenData.feeIntegral -
                            prevRewardTokenData.userFeeIntegrals[user]).scaledMul(
                                userBalance.scaledMul(boostFactors[user])
                            );
                        prevRewardTokenData.userFeeIntegrals[user] = prevRewardTokenData
                            .feeIntegral;
                    }
                }
            }
        }

        uint256 newBoost = computeNewBoost(user, amountAdded, newTotal);
        totalLockedBoosted =
            totalLockedBoosted +
            newTotal.scaledMul(newBoost) -
            balances[user].scaledMul(boostFactors[user]);

        // Update user values
        curRewardTokenData.userFeeIntegrals[user] = curRewardTokenData.feeIntegral;
        lastUpdated[user] = block.timestamp;
        boostFactors[user] = newBoost;
        balances[user] = newTotal;
    }
}
