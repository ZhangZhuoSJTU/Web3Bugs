// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "../../interfaces/IStakerVault.sol";
import "../../interfaces/IController.sol";
import "../../interfaces/tokenomics/ILpGauge.sol";
import "../../interfaces/tokenomics/IRewardsGauge.sol";

import "../../libraries/ScaledMath.sol";
import "../../libraries/Errors.sol";
import "../../libraries/AddressProviderHelpers.sol";

import "../access/Authorization.sol";

contract LpGauge is ILpGauge, IRewardsGauge, Authorization {
    using AddressProviderHelpers for IAddressProvider;
    using ScaledMath for uint256;

    IController public immutable controller;
    IStakerVault public immutable stakerVault;
    IInflationManager public immutable inflationManager;

    uint256 public poolStakedIntegral;
    uint256 public poolLastUpdate;
    mapping(address => uint256) public perUserStakedIntegral;
    mapping(address => uint256) public perUserShare;

    constructor(IController _controller, address _stakerVault)
        Authorization(_controller.addressProvider().getRoleManager())
    {
        require(_stakerVault != address(0), Error.ZERO_ADDRESS_NOT_ALLOWED);
        controller = IController(_controller);
        stakerVault = IStakerVault(_stakerVault);
        IInflationManager _inflationManager = IController(_controller).inflationManager();
        require(address(_inflationManager) != address(0), Error.ZERO_ADDRESS_NOT_ALLOWED);
        inflationManager = _inflationManager;
    }

    /**
     * @notice Checkpoint function for the pool statistics.
     * @return `true` if successful.
     */
    function poolCheckpoint() external override returns (bool) {
        return _poolCheckpoint();
    }

    /**
     * @notice Calculates the token rewards a user should receive and mints these.
     * @param beneficiary Address to claim rewards for.
     * @return `true` if success.
     */
    function claimRewards(address beneficiary) external override returns (uint256) {
        require(
            msg.sender == beneficiary || _roleManager().hasRole(Roles.GAUGE_ZAP, msg.sender),
            Error.UNAUTHORIZED_ACCESS
        );
        userCheckpoint(beneficiary);
        uint256 amount = perUserShare[beneficiary];
        if (amount <= 0) return 0;
        perUserShare[beneficiary] = 0;
        _mintRewards(beneficiary, amount);
        return amount;
    }

    function claimableRewards(address beneficiary) external view override returns (uint256) {
        uint256 poolTotalStaked = stakerVault.getPoolTotalStaked();
        uint256 poolStakedIntegral_ = poolStakedIntegral;
        if (poolTotalStaked > 0) {
            poolStakedIntegral_ += (inflationManager.getLpRateForStakerVault(address(stakerVault)) *
                (block.timestamp - poolLastUpdate)).scaledDiv(poolTotalStaked);
        }

        return
            perUserShare[beneficiary] +
            stakerVault.stakedAndActionLockedBalanceOf(beneficiary).scaledMul(
                poolStakedIntegral_ - perUserStakedIntegral[beneficiary]
            );
    }

    /**
     * @notice Checkpoint function for the statistics for a particular user.
     * @param user Address of the user to checkpoint.
     * @return `true` if successful.
     */
    function userCheckpoint(address user) public override returns (bool) {
        _poolCheckpoint();

        // No checkpoint for the actions and strategies, since this does not accumulate tokens
        if (
            IController(controller).addressProvider().isAction(user) || stakerVault.isStrategy(user)
        ) {
            return false;
        }
        uint256 poolStakedIntegral_ = poolStakedIntegral;
        perUserShare[user] += (
            (stakerVault.stakedAndActionLockedBalanceOf(user)).scaledMul(
                (poolStakedIntegral_ - perUserStakedIntegral[user])
            )
        );

        perUserStakedIntegral[user] = poolStakedIntegral_;

        return true;
    }

    function _mintRewards(address beneficiary, uint256 amount) internal {
        inflationManager.mintRewards(beneficiary, amount);
    }

    function _poolCheckpoint() internal returns (bool) {
        uint256 currentRate = inflationManager.getLpRateForStakerVault(address(stakerVault));
        // Update the integral of total token supply for the pool
        uint256 poolTotalStaked = stakerVault.getPoolTotalStaked();
        if (poolTotalStaked > 0) {
            poolStakedIntegral += (currentRate * (block.timestamp - poolLastUpdate)).scaledDiv(
                poolTotalStaked
            );
        }
        poolLastUpdate = block.timestamp;
        return true;
    }
}
