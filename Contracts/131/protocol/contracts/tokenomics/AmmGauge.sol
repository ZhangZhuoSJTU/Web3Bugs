// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../../interfaces/IController.sol";
import "../../interfaces/tokenomics/IAmmGauge.sol";

import "../../libraries/ScaledMath.sol";
import "../../libraries/Errors.sol";
import "../../libraries/AddressProviderHelpers.sol";

import "../access/Authorization.sol";

contract AmmGauge is Authorization, IAmmGauge {
    using AddressProviderHelpers for IAddressProvider;
    using ScaledMath for uint256;
    using SafeERC20 for IERC20;

    IController public immutable controller;

    mapping(address => uint256) public balances;

    // All the data fields required for the staking tracking
    uint256 public ammStakedIntegral;
    uint256 public totalStaked;
    mapping(address => uint256) public perUserStakedIntegral;
    mapping(address => uint256) public perUserShare;

    address public immutable ammToken;
    bool public killed;
    uint48 public ammLastUpdated;

    event RewardClaimed(address indexed account, uint256 amount);

    constructor(IController _controller, address _ammToken)
        Authorization(_controller.addressProvider().getRoleManager())
    {
        ammToken = _ammToken;
        controller = _controller;
        ammLastUpdated = uint48(block.timestamp);
    }

    /**
     * @notice Shut down the gauge.
     * @dev Accrued inflation can still be claimed from the gauge after shutdown.
     * @return `true` if successful.
     */
    function kill() external override returns (bool) {
        require(msg.sender == address(controller.inflationManager()), Error.UNAUTHORIZED_ACCESS);
        poolCheckpoint();
        killed = true;
        return true;
    }

    function claimRewards(address beneficiary) external virtual override returns (uint256) {
        require(
            msg.sender == beneficiary || _roleManager().hasRole(Roles.GAUGE_ZAP, msg.sender),
            Error.UNAUTHORIZED_ACCESS
        );
        _userCheckpoint(beneficiary);
        uint256 amount = perUserShare[beneficiary];
        if (amount <= 0) return 0;
        perUserShare[beneficiary] = 0;
        controller.inflationManager().mintRewards(beneficiary, amount);
        emit RewardClaimed(beneficiary, amount);
        return amount;
    }

    function stake(uint256 amount) external virtual override returns (bool) {
        return stakeFor(msg.sender, amount);
    }

    function unstake(uint256 amount) external virtual override returns (bool) {
        return unstakeFor(msg.sender, amount);
    }

    function getAmmToken() external view override returns (address) {
        return ammToken;
    }

    function isAmmToken(address token) external view override returns (bool) {
        return token == ammToken;
    }

    function claimableRewards(address user) external view virtual override returns (uint256) {
        uint256 ammStakedIntegral_ = ammStakedIntegral;
        if (!killed && totalStaked > 0) {
            ammStakedIntegral_ += (controller.inflationManager().getAmmRateForToken(ammToken) *
                (block.timestamp - uint256(ammLastUpdated))).scaledDiv(totalStaked);
        }
        return
            perUserShare[user] +
            balances[user].scaledMul(ammStakedIntegral_ - perUserStakedIntegral[user]);
    }

    /**
     * @notice Stake amount of AMM token on behalf of another account.
     * @param account Account for which tokens will be staked.
     * @param amount Amount of token to stake.
     * @return `true` if success.
     */
    function stakeFor(address account, uint256 amount) public virtual override returns (bool) {
        require(amount > 0, Error.INVALID_AMOUNT);

        _userCheckpoint(account);

        uint256 oldBal = IERC20(ammToken).balanceOf(address(this));
        IERC20(ammToken).safeTransferFrom(msg.sender, address(this), amount);
        uint256 newBal = IERC20(ammToken).balanceOf(address(this));
        uint256 staked = newBal - oldBal;
        balances[account] += staked;
        totalStaked += staked;
        emit AmmStaked(account, ammToken, amount);
        return true;
    }

    /**
     * @notice Unstake amount of AMM token and send to another account.
     * @param dst Account to which unstaked AMM tokens will be sent.
     * @param amount Amount of token to unstake.
     * @return `true` if success.
     */
    function unstakeFor(address dst, uint256 amount) public virtual override returns (bool) {
        require(amount > 0, Error.INVALID_AMOUNT);
        require(balances[msg.sender] >= amount, Error.INSUFFICIENT_BALANCE);

        _userCheckpoint(msg.sender);

        uint256 oldBal = IERC20(ammToken).balanceOf(address(this));
        IERC20(ammToken).safeTransfer(dst, amount);
        uint256 newBal = IERC20(ammToken).balanceOf(address(this));
        uint256 unstaked = oldBal - newBal;
        balances[msg.sender] -= unstaked;
        totalStaked -= unstaked;
        emit AmmUnstaked(msg.sender, ammToken, amount);
        return true;
    }

    function poolCheckpoint() public virtual override returns (bool) {
        if (killed) {
            return false;
        }
        uint256 currentRate = controller.inflationManager().getAmmRateForToken(ammToken);
        // Update the integral of total token supply for the pool
        uint256 timeElapsed = block.timestamp - uint256(ammLastUpdated);
        if (totalStaked > 0) {
            ammStakedIntegral += (currentRate * timeElapsed).scaledDiv(totalStaked);
        }
        ammLastUpdated = uint48(block.timestamp);
        return true;
    }

    function _userCheckpoint(address user) internal virtual returns (bool) {
        poolCheckpoint();
        perUserShare[user] += balances[user].scaledMul(
            ammStakedIntegral - perUserStakedIntegral[user]
        );
        perUserStakedIntegral[user] = ammStakedIntegral;
        return true;
    }
}
