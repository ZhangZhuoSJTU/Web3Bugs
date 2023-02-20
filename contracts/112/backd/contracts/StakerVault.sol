// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.9;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import "../libraries/ScaledMath.sol";
import "../libraries/Errors.sol";
import "../libraries/Errors.sol";
import "../libraries/AddressProviderHelpers.sol";

import "../interfaces/IStakerVault.sol";
import "../interfaces/IAddressProvider.sol";
import "../interfaces/IVault.sol";
import "../interfaces/IController.sol";
import "../interfaces/tokenomics/IRewardsGauge.sol";
import "../interfaces/IController.sol";
import "../interfaces/pool/ILiquidityPool.sol";
import "../interfaces/tokenomics/ILpGauge.sol";
import "../interfaces/IERC20Full.sol";

import "./utils/Preparable.sol";
import "./Controller.sol";
import "./pool/LiquidityPool.sol";
import "./access/Authorization.sol";
import "./utils/Pausable.sol";

/**
 * @notice This contract handles staked tokens from Backd pools
 * However, not that this is NOT an ERC-20 compliant contract and these
 * tokens should never be integrated with any protocol assuming ERC-20 compliant
 * tokens
 * @dev When paused, allows only withdraw/unstake
 */
contract StakerVault is IStakerVault, Authorization, Pausable, Initializable, Preparable {
    using AddressProviderHelpers for IAddressProvider;
    using SafeERC20 for IERC20;
    using ScaledMath for uint256;

    bytes32 internal constant _LP_GAUGE = "lpGauge";

    IController public immutable controller;

    address public token;

    mapping(address => uint256) public balances;
    mapping(address => uint256) public actionLockedBalances;

    mapping(address => mapping(address => uint256)) internal _allowances;

    // All the data fields required for the staking tracking
    uint256 private _poolTotalStaked;

    mapping(address => bool) public strategies;
    uint256 public strategiesTotalStaked;

    constructor(IController _controller)
        Authorization(_controller.addressProvider().getRoleManager())
    {
        require(address(_controller) != address(0), Error.ZERO_ADDRESS_NOT_ALLOWED);
        controller = _controller;
    }

    function initialize(address _token) external override initializer {
        token = _token;
    }

    function initializeLpGauge(address _lpGauge) external override onlyGovernance returns (bool) {
        require(currentAddresses[_LP_GAUGE] == address(0), Error.ROLE_EXISTS);
        _setConfig(_LP_GAUGE, _lpGauge);
        controller.inflationManager().addGaugeForVault(token);
        return true;
    }

    function prepareLpGauge(address _lpGauge) external override onlyGovernance returns (bool) {
        _prepare(_LP_GAUGE, _lpGauge);
        return true;
    }

    function executeLpGauge() external override onlyGovernance returns (bool) {
        _executeAddress(_LP_GAUGE);
        controller.inflationManager().addGaugeForVault(token);
        return true;
    }

    /**
     * @notice Registers an address as a strategy to be excluded from token accumulation.
     * @dev This should be used is a strategy deposits into a stakerVault and should not get gov. tokens.
     * @return `true` if success.
     */
    function addStrategy(address strategy) external override returns (bool) {
        require(msg.sender == address(controller.inflationManager()), Error.UNAUTHORIZED_ACCESS);
        strategies[strategy] = true;
        return true;
    }

    /**
     * @notice Transfer staked tokens to an account.
     * @dev This is not an ERC20 transfer, as tokens are still owned by this contract, but fees get updated in the LP pool.
     * @param account Address to transfer to.
     * @param amount Amount to transfer.
     * @return `true` if success.
     */
    function transfer(address account, uint256 amount) external override notPaused returns (bool) {
        require(msg.sender != account, Error.SELF_TRANSFER_NOT_ALLOWED);
        require(balances[msg.sender] >= amount, Error.INSUFFICIENT_BALANCE);

        ILiquidityPool pool = controller.addressProvider().getPoolForToken(token);
        pool.handleLpTokenTransfer(msg.sender, account, amount);

        balances[msg.sender] -= amount;
        balances[account] += amount;

        address lpGauge = currentAddresses[_LP_GAUGE];
        if (lpGauge != address(0)) {
            ILpGauge(lpGauge).userCheckpoint(msg.sender);
            ILpGauge(lpGauge).userCheckpoint(account);
        }

        emit Transfer(msg.sender, account, amount);
        return true;
    }

    /**
     * @notice Transfer staked tokens from src to dst.
     * @dev This is not an ERC20 transfer, as tokens are still owned by this contract, but fees get updated in the LP pool.
     * @param src Address to transfer from.
     * @param dst Address to transfer to.
     * @param amount Amount to transfer.
     * @return `true` if success.
     */
    function transferFrom(
        address src,
        address dst,
        uint256 amount
    ) external override notPaused returns (bool) {
        /* Do not allow self transfers */
        require(src != dst, Error.SAME_ADDRESS_NOT_ALLOWED);

        address spender = msg.sender;

        /* Get the allowance, infinite for the account owner */
        uint256 startingAllowance = 0;
        if (spender == src) {
            startingAllowance = type(uint256).max;
        } else {
            startingAllowance = _allowances[src][spender];
        }
        require(startingAllowance >= amount, Error.INSUFFICIENT_BALANCE);

        uint256 srcTokens = balances[src];
        require(srcTokens >= amount, Error.INSUFFICIENT_BALANCE);

        address lpGauge = currentAddresses[_LP_GAUGE];
        if (lpGauge != address(0)) {
            ILpGauge(lpGauge).userCheckpoint(src);
            ILpGauge(lpGauge).userCheckpoint(dst);
        }
        ILiquidityPool pool = controller.addressProvider().getPoolForToken(token);
        pool.handleLpTokenTransfer(src, dst, amount);

        uint256 allowanceNew = startingAllowance - amount;
        uint256 srcTokensNew = srcTokens - amount;
        uint256 dstTokensNew = balances[dst] + amount;

        /* Update token balances */
        balances[src] = srcTokensNew;
        balances[dst] = dstTokensNew;

        /* Update allowance if necessary */
        if (startingAllowance != type(uint256).max) {
            _allowances[src][spender] = allowanceNew;
        }
        emit Transfer(src, dst, amount);
        return true;
    }

    /**
     * @notice Approve staked tokens for spender.
     * @param spender Address to approve tokens for.
     * @param amount Amount to approve.
     * @return `true` if success.
     */
    function approve(address spender, uint256 amount) external override notPaused returns (bool) {
        address src = msg.sender;
        _allowances[src][spender] = amount;
        emit Approval(src, spender, amount);
        return true;
    }

    /**
     * @notice If an action is registered and stakes funds, this updates the actionLockedBalances for the user.
     * @param account Address that registered the action.
     * @param amount Amount staked by the action.
     * @return `true` if success.
     */
    function increaseActionLockedBalance(address account, uint256 amount)
        external
        override
        returns (bool)
    {
        require(controller.addressProvider().isAction(msg.sender), Error.UNAUTHORIZED_ACCESS);

        address lpGauge = currentAddresses[_LP_GAUGE];
        if (lpGauge != address(0)) {
            ILpGauge(lpGauge).userCheckpoint(account);
        }
        actionLockedBalances[account] += amount;
        return true;
    }

    /**
     * @notice If an action is executed/reset, this updates the actionLockedBalances for the user.
     * @param account Address that registered the action.
     * @param amount Amount executed/reset by the action.
     * @return `true` if success.
     */
    function decreaseActionLockedBalance(address account, uint256 amount)
        external
        override
        returns (bool)
    {
        require(controller.addressProvider().isAction(msg.sender), Error.UNAUTHORIZED_ACCESS);

        address lpGauge = currentAddresses[_LP_GAUGE];
        if (lpGauge != address(0)) {
            ILpGauge(lpGauge).userCheckpoint(account);
        }
        if (actionLockedBalances[account] > amount) {
            actionLockedBalances[account] -= amount;
        } else {
            actionLockedBalances[account] = 0;
        }
        return true;
    }

    function poolCheckpoint() external override returns (bool) {
        if (currentAddresses[_LP_GAUGE] != address(0)) {
            return ILpGauge(currentAddresses[_LP_GAUGE]).poolCheckpoint();
        }
        return false;
    }

    function getLpGauge() external view override returns (address) {
        return currentAddresses[_LP_GAUGE];
    }

    function isStrategy(address user) external view override returns (bool) {
        return strategies[user];
    }

    /**
     * @notice Get the total amount of tokens that are staked by actions
     * @return Total amount staked by actions
     */
    function getStakedByActions() external view override returns (uint256) {
        address[] memory actions = controller.addressProvider().allActions();
        uint256 total;
        for (uint256 i = 0; i < actions.length; i++) {
            total += balances[actions[i]];
        }
        return total;
    }

    function allowance(address owner, address spender) external view override returns (uint256) {
        return _allowances[owner][spender];
    }

    function balanceOf(address account) external view override returns (uint256) {
        return balances[account];
    }

    function getPoolTotalStaked() external view override returns (uint256) {
        return _poolTotalStaked;
    }

    /**
     * @notice Returns the total balance in the staker vault, including that locked in positions.
     * @param account Account to query balance for.
     * @return Total balance in staker vault for account.
     */
    function stakedAndActionLockedBalanceOf(address account)
        external
        view
        override
        returns (uint256)
    {
        return balances[account] + actionLockedBalances[account];
    }

    function actionLockedBalanceOf(address account) external view override returns (uint256) {
        return actionLockedBalances[account];
    }

    function decimals() external view returns (uint8) {
        return IERC20Full(token).decimals();
    }

    function getToken() external view override returns (address) {
        return token;
    }

    function unstake(uint256 amount) public override returns (bool) {
        return unstakeFor(msg.sender, msg.sender, amount);
    }

    /**
     * @notice Stake an amount of vault tokens.
     * @param amount Amount of token to stake.
     * @return `true` if success.
     */
    function stake(uint256 amount) public override returns (bool) {
        return stakeFor(msg.sender, amount);
    }

    /**
     * @notice Stake amount of vault token on behalf of another account.
     * @param account Account for which tokens will be staked.
     * @param amount Amount of token to stake.
     * @return `true` if success.
     */
    function stakeFor(address account, uint256 amount) public override notPaused returns (bool) {
        require(IERC20(token).balanceOf(msg.sender) >= amount, Error.INSUFFICIENT_BALANCE);

        address lpGauge = currentAddresses[_LP_GAUGE];
        if (lpGauge != address(0)) {
            ILpGauge(lpGauge).userCheckpoint(account);
        }

        uint256 oldBal = IERC20(token).balanceOf(address(this));

        if (msg.sender != account) {
            ILiquidityPool pool = controller.addressProvider().getPoolForToken(token);
            pool.handleLpTokenTransfer(msg.sender, account, amount);
        }

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        uint256 staked = IERC20(token).balanceOf(address(this)) - oldBal;
        require(staked == amount, Error.INVALID_AMOUNT);
        balances[account] += staked;

        if (strategies[account]) {
            strategiesTotalStaked += staked;
        } else {
            _poolTotalStaked += staked;
        }
        emit Staked(account, amount);
        return true;
    }

    /**
     * @notice Unstake tokens on behalf of another account.
     * @dev Needs to be approved.
     * @param src Account for which tokens will be unstaked.
     * @param dst Account receiving the tokens.
     * @param amount Amount of token to unstake/receive.
     * @return `true` if success.
     */
    function unstakeFor(
        address src,
        address dst,
        uint256 amount
    ) public override returns (bool) {
        ILiquidityPool pool = controller.addressProvider().getPoolForToken(token);
        uint256 allowance_ = _allowances[src][msg.sender];
        require(
            src == msg.sender || allowance_ >= amount || address(pool) == msg.sender,
            Error.UNAUTHORIZED_ACCESS
        );
        require(balances[src] >= amount, Error.INSUFFICIENT_BALANCE);
        address lpGauge = currentAddresses[_LP_GAUGE];
        if (lpGauge != address(0)) {
            ILpGauge(lpGauge).userCheckpoint(src);
        }
        uint256 oldBal = IERC20(token).balanceOf(address(this));

        if (src != dst) {
            pool.handleLpTokenTransfer(src, dst, amount);
        }

        IERC20(token).safeTransfer(dst, amount);

        uint256 unstaked = oldBal - IERC20(token).balanceOf(address(this));

        if (src != msg.sender && allowance_ != type(uint256).max && address(pool) != msg.sender) {
            // update allowance
            _allowances[src][msg.sender] -= unstaked;
        }
        balances[src] -= unstaked;

        if (strategies[src]) {
            strategiesTotalStaked -= unstaked;
        } else {
            _poolTotalStaked -= unstaked;
        }
        emit Unstaked(src, amount);
        return true;
    }

    function _isAuthorizedToPause(address account) internal view override returns (bool) {
        return _roleManager().hasRole(Roles.GOVERNANCE, account);
    }
}
