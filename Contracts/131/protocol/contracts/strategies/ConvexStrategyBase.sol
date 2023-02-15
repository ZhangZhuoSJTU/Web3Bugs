// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../utils/CvxMintAmount.sol";

import "../access/Authorization.sol";

import "../../libraries/ScaledMath.sol";
import "../../libraries/AddressProviderHelpers.sol";
import "../../libraries/EnumerableExtensions.sol";
import "../../libraries/UncheckedMath.sol";

import "../../interfaces/ISwapperRouter.sol";
import "../../interfaces/strategies/IConvexStrategyBase.sol";
import "../../interfaces/vendor/IBooster.sol";
import "../../interfaces/vendor/IRewardStaking.sol";
import "../../interfaces/vendor/ICurveSwapEth.sol";
import "../../interfaces/vendor/ICurveRegistry.sol";

abstract contract ConvexStrategyBase is IConvexStrategyBase, Authorization, CvxMintAmount {
    using ScaledMath for uint256;
    using UncheckedMath for uint256;
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;
    using EnumerableExtensions for EnumerableSet.AddressSet;
    using AddressProviderHelpers for IAddressProvider;

    IBooster internal constant _BOOSTER = IBooster(0xF403C135812408BFbE8713b5A23a04b3D48AAE31); // Convex Booster Contract
    IERC20 internal constant _CRV = IERC20(0xD533a949740bb3306d119CC777fa900bA034cd52); // CRV
    IERC20 internal constant _CVX = IERC20(0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B); // CVX
    IERC20 internal constant _WETH = IERC20(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2); // WETH
    ICurveRegistry internal constant _CURVE_REGISTRY =
        ICurveRegistry(0x90E00ACe148ca3b23Ac1bC8C240C2a7Dd9c2d7f5); // Curve Registry Contract
    address internal constant _CURVE_ETH_ADDRESS =
        address(0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE); // Null Address used for Curve ETH pools

    ISwapperRouter internal immutable _swapperRouter; // Swapper Router, used for swapping tokens

    address internal _strategist; // The strategist for the strategy
    EnumerableSet.AddressSet internal _rewardTokens; // List of additional reward tokens when claiming rewards on Convex
    IERC20 public underlying; // Strategy Underlying
    bool public isShutdown; // If the strategy is shutdown, stops all deposits
    address public communityReserve; // Address for sending CVX & CRV Community Reserve share
    address public immutable vault; // Backd Vault
    uint256 public crvCommunityReserveShare; // Share of CRV sent to Community Reserve
    uint256 public cvxCommunityReserveShare; // Share of CVX sent to Community Reserve
    uint256 public imbalanceToleranceIn; // Maximum allowed slippage from Curve Pool Imbalance for depositing
    uint256 public imbalanceToleranceOut; // Maximum allowed slippage from Curve Pool Imbalance for withdrawing
    IRewardStaking public rewards; // Rewards Contract for claiming Convex Rewards
    IERC20 public lp; // Curve Pool LP Token
    ICurveSwapEth public curvePool; // Curve Pool
    uint256 public convexPid; // Index of Convex Pool in Booster Contract
    uint256 public curveIndex; // Underlying index in Curve Pool

    event Deposit(); // Emitted after a successfull deposit
    event Withdraw(uint256 amount); // Emitted after a successful withdrawal
    event WithdrawAll(uint256 amount); // Emitted after successfully withdrwaing all
    event Shutdown(); // Emitted after a successful shutdown
    event SetCommunityReserve(address reserve); // Emitted after a successful setting of reserve
    event SetCrvCommunityReserveShare(uint256 value); // Emitted after a successful setting of CRV Community Reserve Share
    event SetCvxCommunityReserveShare(uint256 value); // Emitted after a successful setting of CVX Community Reserve Share
    event SetImbalanceToleranceIn(uint256 value); // Emitted after a successful setting of imbalance tolerance in
    event SetImbalanceToleranceOut(uint256 value); // Emitted after a successful setting of imbalance tolerance out
    event SetStrategist(address strategist); // Emitted after a successful setting of strategist
    event AddRewardToken(address token); // Emitted after successfully adding a new reward token
    event RemoveRewardToken(address token); // Emitted after successfully removing a reward token
    event Harvest(uint256 amount); // Emitted after a successful harvest

    modifier onlyVault() {
        require(msg.sender == vault, Error.UNAUTHORIZED_ACCESS);
        _;
    }

    constructor(
        address vault_,
        address strategist_,
        uint256 convexPid_,
        address curvePool_,
        uint256 curveIndex_,
        IAddressProvider addressProvider_
    ) Authorization(addressProvider_.getRoleManager()) {
        // Getting data from supporting contracts
        _validateCurvePool(curvePool_);
        (address lp_, , , address rewards_, , ) = _BOOSTER.poolInfo(convexPid_);
        lp = IERC20(lp_);
        rewards = IRewardStaking(rewards_);
        curvePool = ICurveSwapEth(curvePool_);
        address underlying_ = ICurveSwapEth(curvePool_).coins(curveIndex_);
        if (underlying_ == _CURVE_ETH_ADDRESS) underlying_ = address(0);
        underlying = IERC20(underlying_);

        // Setting inputs
        vault = vault_;
        _strategist = strategist_;
        convexPid = convexPid_;
        curveIndex = curveIndex_;
        ISwapperRouter swapperRouter_ = addressProvider_.getSwapperRouter();
        _swapperRouter = swapperRouter_;

        // Approvals
        _CRV.safeApprove(address(swapperRouter_), type(uint256).max);
        _CVX.safeApprove(address(swapperRouter_), type(uint256).max);
        _WETH.safeApprove(address(swapperRouter_), type(uint256).max);
    }

    /**
     * @notice Deposit all available underlying into Convex pool.
     * @return True if successful deposit.
     */
    function deposit() external payable override onlyVault returns (bool) {
        require(!isShutdown, Error.STRATEGY_SHUT_DOWN);
        if (!_deposit()) return false;
        emit Deposit();
        return true;
    }

    /**
     * @notice Withdraw an amount of underlying to the vault.
     * @dev This can only be called by the vault.
     *      If the amount is not available, it will be made liquid.
     * @param amount_ Amount of underlying to withdraw.
     * @return True if successful withdrawal.
     */
    function withdraw(uint256 amount_) external override onlyVault returns (bool) {
        if (amount_ == 0) return false;
        if (!_withdraw(amount_)) return false;
        emit Withdraw(amount_);
        return true;
    }

    /**
     * @notice Withdraw all underlying.
     * @dev This does not liquidate reward tokens and only considers
     *      idle underlying, idle lp tokens and staked lp tokens.
     * @return Amount of underlying withdrawn
     */
    function withdrawAll() external override returns (uint256) {
        require(
            msg.sender == vault || _roleManager().hasRole(Roles.GOVERNANCE, msg.sender),
            Error.UNAUTHORIZED_ACCESS
        );
        uint256 amountWithdrawn_ = _withdrawAll();
        if (amountWithdrawn_ == 0) return 0;
        emit WithdrawAll(amountWithdrawn_);
        return amountWithdrawn_;
    }

    /**
     * @notice Harvests reward tokens and sells these for the underlying.
     * @dev Any underlying harvested is not redeposited by this method.
     * @return Amount of underlying harvested.
     */
    function harvest() external override onlyVault returns (uint256) {
        return _harvest();
    }

    /**
     * @notice Shuts down the strategy, disabling deposits.
     * @return True if reserve was successfully set.
     */
    function shutdown() external override onlyVault returns (bool) {
        if (isShutdown) return false;
        isShutdown = true;
        emit Shutdown();
        return true;
    }

    /**
     * @notice Set the address of the community reserve.
     * @dev CRV & CVX will be taxed and allocated to the reserve,
     *      such that Backd can participate in governance.
     * @param _communityReserve Address of the community reserve.
     * @return True if successfully set.
     */
    function setCommunityReserve(address _communityReserve)
        external
        override
        onlyGovernance
        returns (bool)
    {
        require(_communityReserve != address(0), Error.ZERO_ADDRESS_NOT_ALLOWED);
        communityReserve = _communityReserve;
        emit SetCommunityReserve(_communityReserve);
        return true;
    }

    /**
     * @notice Set the share of CRV to send to the Community Reserve.
     * @param crvCommunityReserveShare_ New fee charged on CRV rewards for governance.
     * @return True if successfully set.
     */
    function setCrvCommunityReserveShare(uint256 crvCommunityReserveShare_)
        external
        override
        onlyGovernance
        returns (bool)
    {
        require(crvCommunityReserveShare_ <= ScaledMath.ONE, Error.INVALID_AMOUNT);
        require(communityReserve != address(0), "Community reserve must be set");
        crvCommunityReserveShare = crvCommunityReserveShare_;
        emit SetCrvCommunityReserveShare(crvCommunityReserveShare_);
        return true;
    }

    /**
     * @notice Set the share of CVX to send to the Community Reserve.
     * @param cvxCommunityReserveShare_ New fee charged on CVX rewards for governance.
     * @return True if successfully set.
     */
    function setCvxCommunityReserveShare(uint256 cvxCommunityReserveShare_)
        external
        override
        onlyGovernance
        returns (bool)
    {
        require(cvxCommunityReserveShare_ <= ScaledMath.ONE, Error.INVALID_AMOUNT);
        require(communityReserve != address(0), "Community reserve must be set");
        cvxCommunityReserveShare = cvxCommunityReserveShare_;
        emit SetCvxCommunityReserveShare(cvxCommunityReserveShare_);
        return true;
    }

    /**
     * @notice Set imbalance tolerance for Curve Pool deposits.
     * @dev Stored as a percent, e.g. 1% would be set as 0.01
     * @param imbalanceToleranceIn_ New imbalance tolerance in.
     * @return True if successfully set.
     */
    function setImbalanceToleranceIn(uint256 imbalanceToleranceIn_)
        external
        override
        onlyGovernance
        returns (bool)
    {
        imbalanceToleranceIn = imbalanceToleranceIn_;
        emit SetImbalanceToleranceIn(imbalanceToleranceIn_);
        return true;
    }

    /**
     * @notice Set imbalance tolerance for Curve Pool withdrawals.
     * @dev Stored as a percent, e.g. 1% would be set as 0.01
     * @param imbalanceToleranceOut_ New imbalance tolerance out.
     * @return True if successfully set.
     */
    function setImbalanceToleranceOut(uint256 imbalanceToleranceOut_)
        external
        override
        onlyGovernance
        returns (bool)
    {
        imbalanceToleranceOut = imbalanceToleranceOut_;
        emit SetImbalanceToleranceOut(imbalanceToleranceOut_);
        return true;
    }

    /**
     * @notice Set strategist.
     * @dev Can only be set by current strategist.
     * @param strategist_ Address of new strategist.
     * @return True if successfully set.
     */
    function setStrategist(address strategist_) external override returns (bool) {
        require(msg.sender == _strategist, Error.UNAUTHORIZED_ACCESS);
        _strategist = strategist_;
        emit SetStrategist(strategist_);
        return true;
    }

    /**
     * @notice Add a reward token to list of extra reward tokens.
     * @dev These are tokens that are not the main assets of the strategy. For instance, temporary incentives.
     * @param token_ Address of token to add to reward token list.
     * @return True if successfully added.
     */
    function addRewardToken(address token_) external override onlyGovernance returns (bool) {
        require(
            token_ != address(_CVX) && token_ != address(underlying) && token_ != address(_CRV),
            Error.INVALID_TOKEN_TO_ADD
        );
        if (_rewardTokens.contains(token_)) return false;
        _rewardTokens.add(token_);
        address _swapperRouter = address(_swapperRouter);
        IERC20(token_).safeApprove(_swapperRouter, 0);
        IERC20(token_).safeApprove(_swapperRouter, type(uint256).max);
        emit AddRewardToken(token_);
        return true;
    }

    /**
     * @notice Remove a reward token.
     * @param token_ Address of token to remove from reward token list.
     * @return True if successfully removed.
     */
    function removeRewardToken(address token_) external override onlyGovernance returns (bool) {
        if (!_rewardTokens.remove(token_)) return false;
        emit RemoveRewardToken(token_);
        return true;
    }

    /**
     * @notice Amount of rewards that can be harvested in the underlying.
     * @dev Includes rewards for CRV, CVX & Extra Rewards.
     * @return Estimated amount of underlying available to harvest.
     */
    function harvestable() external view override returns (uint256) {
        IRewardStaking rewards_ = rewards;
        uint256 crvAmount_ = rewards_.earned(address(this));
        if (crvAmount_ == 0) return 0;
        uint256 harvestable_ = _underlyingAmountOut(
            address(_CRV),
            crvAmount_.scaledMul(ScaledMath.ONE - crvCommunityReserveShare)
        ) +
            _underlyingAmountOut(
                address(_CVX),
                getCvxMintAmount(crvAmount_).scaledMul(ScaledMath.ONE - cvxCommunityReserveShare)
            );
        uint256 length_ = _rewardTokens.length();
        for (uint256 i; i < length_; i = i.uncheckedInc()) {
            IRewardStaking extraRewards_ = IRewardStaking(rewards_.extraRewards(i));
            address rewardToken_ = extraRewards_.rewardToken();
            if (!_rewardTokens.contains(rewardToken_)) continue;
            harvestable_ += _underlyingAmountOut(rewardToken_, extraRewards_.earned(address(this)));
        }
        return harvestable_;
    }

    /**
     * @notice Returns the address of the strategist.
     * @return The the address of the strategist.
     */
    function strategist() external view override returns (address) {
        return _strategist;
    }

    /**
     * @notice Returns the list of reward tokens supported by the strategy.
     * @return The list of reward tokens supported by the strategy.
     */
    function rewardTokens() external view override returns (address[] memory) {
        return _rewardTokens.toArray();
    }

    /**
     * @notice Get the total underlying balance of the strategy.
     * @return Underlying balance of strategy.
     */
    function balance() external view virtual override returns (uint256);

    /**
     * @notice Returns the name of the strategy.
     * @return The name of the strategy.
     */
    function name() external view virtual override returns (string memory);

    /**
     * @dev Contract does not stash tokens.
     */
    function hasPendingFunds() external pure override returns (bool) {
        return false;
    }

    function _deposit() internal virtual returns (bool);

    function _withdraw(uint256 amount_) internal virtual returns (bool);

    function _withdrawAll() internal virtual returns (uint256);

    function _harvest() internal returns (uint256) {
        uint256 initialBalance_ = _underlyingBalance();

        // Claim Convex rewards
        rewards.getReward();

        // Sending share to Community Reserve
        _sendCommunityReserveShare();

        // Swap CVX for WETH
        ISwapperRouter swapperRouter_ = _swapperRouter;
        swapperRouter_.swapAll(address(_CVX), address(_WETH));

        // Swap CRV for WETH
        swapperRouter_.swapAll(address(_CRV), address(_WETH));

        // Swap Extra Rewards for WETH
        uint256 length_ = _rewardTokens.length();
        for (uint256 i; i < length_; i = i.uncheckedInc()) {
            swapperRouter_.swapAll(_rewardTokens.at(i), address(_WETH));
        }

        // Swap WETH for underlying
        swapperRouter_.swapAll(address(_WETH), address(underlying));

        uint256 harvested_ = _underlyingBalance() - initialBalance_;
        emit Harvest(harvested_);
        return harvested_;
    }

    /**
     * @notice Sends a share of the current balance of CRV and CVX to the Community Reserve.
     */
    function _sendCommunityReserveShare() internal {
        address communityReserve_ = communityReserve;
        if (communityReserve_ == address(0)) return;
        uint256 cvxCommunityReserveShare_ = cvxCommunityReserveShare;
        if (cvxCommunityReserveShare_ > 0) {
            IERC20 cvx_ = _CVX;
            uint256 cvxBalance_ = cvx_.balanceOf(address(this));
            if (cvxBalance_ > 0) {
                cvx_.safeTransfer(
                    communityReserve_,
                    cvxBalance_.scaledMul(cvxCommunityReserveShare_)
                );
            }
        }
        uint256 crvCommunityReserveShare_ = crvCommunityReserveShare;
        if (crvCommunityReserveShare_ > 0) {
            IERC20 crv_ = _CRV;
            uint256 crvBalance_ = crv_.balanceOf(address(this));
            if (crvBalance_ > 0) {
                crv_.safeTransfer(
                    communityReserve_,
                    crvBalance_.scaledMul(crvCommunityReserveShare_)
                );
            }
        }
    }

    /**
     * @dev Get the balance of the underlying.
     */
    function _underlyingBalance() internal view virtual returns (uint256);

    /**
     * @dev Get the balance of the lp.
     */
    function _lpBalance() internal view returns (uint256) {
        return lp.balanceOf(address(this));
    }

    /**
     * @dev Get the balance of the underlying staked in the Curve pool.
     */
    function _stakedBalance() internal view returns (uint256) {
        return rewards.balanceOf(address(this));
    }

    function _underlyingAmountOut(address token_, uint256 amount_) internal view returns (uint256) {
        return _swapperRouter.getAmountOut(token_, address(underlying), amount_);
    }

    /**
     * @dev Reverts if it is not a valid Curve Pool.
     */
    function _validateCurvePool(address curvePool_) internal view {
        _CURVE_REGISTRY.get_A(curvePool_);
    }
}
