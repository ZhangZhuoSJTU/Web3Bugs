// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./access/Authorization.sol";

import "../interfaces/IAddressProvider.sol";
import "../interfaces/vendor/IRewardStaking.sol";
import "../interfaces/vendor/ICrvDepositor.sol";
import "../interfaces/vendor/IDelegation.sol";
import "../interfaces/vendor/IvlCvxExtraRewardDistribution.sol";
import "../interfaces/vendor/ICurveSwap.sol";
import "../interfaces/vendor/ICvxLocker.sol";
import "../interfaces/ICvxCrvRewardsLocker.sol";

import "../libraries/Errors.sol";
import "../libraries/AddressProviderHelpers.sol";

contract CvxCrvRewardsLocker is ICvxCrvRewardsLocker, Authorization {
    using AddressProviderHelpers for IAddressProvider;

    using SafeERC20 for IERC20;

    // ERC20 tokens
    address public constant CVX = address(0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B);
    address public constant CVX_CRV = address(0x62B9c7356A2Dc64a1969e19C23e4f579F9810Aa7);
    address public constant CRV = address(0xD533a949740bb3306d119CC777fa900bA034cd52);

    address public constant CVX_CRV_CRV_CURVE_POOL =
        address(0x9D0464996170c6B9e75eED71c68B99dDEDf279e8); // cvxCRV/CRV Curve Pool
    address public constant CRV_DEPOSITOR = address(0x8014595F2AB54cD7c604B00E9fb932176fDc86Ae); // Lock CRV for cvxCRV
    address public constant CVX_CRV_STAKING = address(0x3Fe65692bfCD0e6CF84cB1E7d24108E434A7587e); // Stake cvxCRV and get rewards
    address public constant CVX_LOCKER = address(0x72a19342e8F1838460eBFCCEf09F6585e32db86E); // CVX Locker
    address public constant VL_CVX_EXTRA_REWARD_DISTRIBUTION =
        address(0xDecc7d761496d30F30b92Bdf764fb8803c79360D);

    uint256 public spendRatio;
    bool public prepareWithdrawal;
    address public treasury;

    int128 private constant _CRV_INDEX = 0;
    int128 private constant _CVX_CRV_INDEX = 1;

    event NewSpendRatio(uint256 newSpendRatio);
    event NewTreasury(address newTreasury);
    event DelegateSet(address newDelegate);
    event DelegateCleared();
    event WithdrawalFlagSet();
    event WithdrawalFlagReset();

    constructor(IAddressProvider _addressProvider)
        Authorization(_addressProvider.getRoleManager())
    {
        // Approve for locking CRV for cvxCRV
        IERC20(CRV).safeApprove(CRV_DEPOSITOR, type(uint256).max);

        // Approve for staking cvxCRV
        IERC20(CVX_CRV).safeApprove(CVX_CRV_STAKING, type(uint256).max);

        // Approve for cvxCRV/CRV Curve Pool Swaps
        IERC20(CRV).safeApprove(CVX_CRV_CRV_CURVE_POOL, type(uint256).max);

        // Approve CVX Locker
        IERC20(CVX).safeApprove(CVX_LOCKER, type(uint256).max);

        treasury = _addressProvider.getTreasury();
    }

    function lockCvx() external override {
        _lockCvx();
    }

    function lockCrv() external override {
        _lockCrv();
    }

    /**
     * @notice Set spend ratio for CVX locking.
     * @dev Spend ratio is the amount of CVX that should be donated to
     * the Convex treasury to boost vote power. This needs to be enabled
     * by Convex.
     * @param _spendRatio New spend ratio to be used.
     */
    function setSpendRatio(uint256 _spendRatio) external override onlyGovernance returns (bool) {
        require(
            _spendRatio <= ICvxLocker(CVX_LOCKER).maximumBoostPayment(),
            Error.EXCEEDS_MAX_BOOST
        );
        spendRatio = _spendRatio;
        emit NewSpendRatio(_spendRatio);
        return true;
    }

    /**
     * @notice Claim rewards from Convex.
     * @dev Rewards to claim are for staked cvxCRV and locked CVX.
     * @param lockAndStake If true, claimed reward tokens (CRV) will be locked and staked (CRV for cvxCRV and CVX for vlCVX).
     */
    function claimRewards(bool lockAndStake) external override returns (bool) {
        ICvxLocker(CVX_LOCKER).getReward(address(this), false);

        IRewardStaking(CVX_CRV_STAKING).getReward();

        if (lockAndStake) {
            lockRewards();
        }
        return true;
    }

    /**
     * @notice Stakes cvxCRV in the cvxCRV rewards contract on Convex.
     */
    function stakeCvxCrv() external override returns (bool) {
        return _stakeCvxCrv();
    }

    /**
     * @notice Prepares a withdrawal of funds.
     * @dev If this is set then no idle funds can get locked or staked.
     */
    function setWithdrawalFlag() external override onlyGovernance {
        prepareWithdrawal = true;
        emit WithdrawalFlagSet();
    }

    /**
     * @notice Resets prepared withdrawal of funds.
     */
    function resetWithdrawalFlag() external override onlyGovernance {
        prepareWithdrawal = false;
        emit WithdrawalFlagReset();
    }

    /**
     * @notice Processes expired locks.
     */
    function processExpiredLocks(bool relock) external override returns (bool) {
        if (prepareWithdrawal) {
            ICvxLocker(CVX_LOCKER).withdrawExpiredLocksTo(treasury);
        } else {
            ICvxLocker(CVX_LOCKER).processExpiredLocks(relock);
        }
        return true;
    }

    /**
     * @notice Set treasury to receive withdrawn funds.
     */
    function setTreasury(address _treasury) external override onlyGovernance returns (bool) {
        require(_treasury != address(0), Error.ZERO_ADDRESS_NOT_ALLOWED);
        treasury = _treasury;
        emit NewTreasury(treasury);
        return true;
    }

    /**
     * @notice Withdraw full amount of a token to the treasury.
     * @param token Token to withdraw entire balance of.
     */
    function withdraw(address token) external override onlyGovernance returns (bool) {
        IERC20(token).safeTransfer(treasury, IERC20(token).balanceOf(address(this)));
        return true;
    }

    /**
     * @notice Withdraw cvxCRV to treasury.
     * @dev Unstakes cvxCRV if it is staked.
     */
    function withdrawCvxCrv(uint256 amount) external override onlyGovernance {
        IRewardStaking(CVX_CRV_STAKING).withdraw(amount, true);
        uint256 cvxcrvBal = IERC20(CVX_CRV).balanceOf(address(this));
        if (cvxcrvBal > 0) {
            IERC20(CVX_CRV).safeTransfer(treasury, cvxcrvBal);
        }
    }

    function unstakeCvxCrv() external override onlyGovernance {
        unstakeCvxCrv(false);
    }

    function unstakeCvxCrv(uint256 amount, bool withdrawal) external override onlyGovernance {
        _unstakeCvxCrv(amount, withdrawal);
    }

    /**
     * @notice Set delegate to receive vote weight.
     */
    function setDelegate(address delegateContract, address delegate)
        external
        override
        onlyGovernance
    {
        require(delegate != address(0), Error.ZERO_ADDRESS_NOT_ALLOWED);
        IDelegation(delegateContract).setDelegate("cvx.eth", delegate);
        emit DelegateSet(delegate);
    }

    /**
     * @notice Clears a delegate for the msg.sender and a specific id.
     */
    function clearDelegate(address delegateContract) external override onlyGovernance {
        IDelegation(delegateContract).clearDelegate("cvx.eth");
        emit DelegateCleared();
    }

    function forfeitRewards(address token, uint256 index) external override onlyGovernance {
        IvlCvxExtraRewardDistribution(VL_CVX_EXTRA_REWARD_DISTRIBUTION).forfeitRewards(
            token,
            index
        );
    }

    /**
     * @notice Lock CRV and CVX tokens.
     * @dev CRV get locked for cvxCRV and staked on Convex.
     */
    function lockRewards() public override returns (bool) {
        _lockCrv();
        _lockCvx();
        return true;
    }

    /**
     * @notice Withdraw an amount of a token to the treasury.
     * @param token Token to withdraw.
     * @param amount Amount of token to withdraw.
     */
    function withdraw(address token, uint256 amount) public override onlyGovernance returns (bool) {
        IERC20(token).safeTransfer(treasury, amount);
        return true;
    }

    /**
     * @notice Unstake cvxCRV from Convex.
     */
    function unstakeCvxCrv(bool withdrawal) public override onlyGovernance {
        _unstakeCvxCrv(IRewardStaking(CVX_CRV_STAKING).balanceOf(address(this)), withdrawal);
    }

    function _lockCrv() internal {
        if (prepareWithdrawal) return;

        uint256 currentBalance = IERC20(CRV).balanceOf(address(this));
        if (currentBalance != 0) {
            // Checks if we can get a better rate on Curve Pool
            uint256 amountOut = ICurveSwap(CVX_CRV_CRV_CURVE_POOL).get_dy(
                _CRV_INDEX,
                _CVX_CRV_INDEX,
                currentBalance
            );
            if (amountOut > currentBalance) {
                ICurveSwap(CVX_CRV_CRV_CURVE_POOL).exchange(
                    _CRV_INDEX,
                    _CVX_CRV_INDEX,
                    currentBalance,
                    0
                );
            } else {
                // Swap CRV for cxvCRV and stake
                ICrvDepositor(CRV_DEPOSITOR).deposit(currentBalance, false, address(0));
            }
            IRewardStaking(CVX_CRV_STAKING).stakeAll();
            return;
        }

        if (IERC20(CVX_CRV).balanceOf(address(this)) > 0)
            IRewardStaking(CVX_CRV_STAKING).stakeAll();
    }

    function _lockCvx() internal {
        // Locks CVX for vlCVX
        if (prepareWithdrawal) return;
        uint256 currentBalance = IERC20(CVX).balanceOf(address(this));
        if (currentBalance == 0) return;
        ICvxLocker(CVX_LOCKER).lock(address(this), currentBalance, spendRatio);
    }

    function _stakeCvxCrv() internal returns (bool) {
        if (prepareWithdrawal) return false;

        if (IERC20(CVX_CRV).balanceOf(address(this)) == 0) return false;
        IRewardStaking(CVX_CRV_STAKING).stakeAll();
        return true;
    }

    function _unstakeCvxCrv(uint256 amount, bool withdrawal) internal {
        IRewardStaking(CVX_CRV_STAKING).withdraw(amount, true);
        if (withdrawal) {
            IERC20(CVX_CRV).safeTransfer(treasury, amount);
        }
    }
}
