// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "../interfaces/actions/IAction.sol";
import "../interfaces/IAddressProvider.sol";
import "../interfaces/IController.sol";
import "../interfaces/IStakerVault.sol";
import "../interfaces/pool/ILiquidityPool.sol";
import "../interfaces/tokenomics/IInflationManager.sol";

import "../libraries/AddressProviderHelpers.sol";
import "../libraries/UncheckedMath.sol";

import "./utils/Preparable.sol";
import "./access/Authorization.sol";

contract Controller is IController, Authorization, Preparable {
    using UncheckedMath for uint256;
    using AddressProviderHelpers for IAddressProvider;

    IAddressProvider public immutable override addressProvider;

    IInflationManager public inflationManager;

    bytes32 internal constant _KEEPER_REQUIRED_STAKED_BKD = "KEEPER_REQUIRED_STAKED_BKD";

    constructor(IAddressProvider _addressProvider)
        Authorization(_addressProvider.getRoleManager())
    {
        addressProvider = _addressProvider;
    }

    function setInflationManager(address _inflationManager) external onlyGovernance {
        require(address(inflationManager) == address(0), Error.ADDRESS_ALREADY_SET);
        require(_inflationManager != address(0), Error.INVALID_ARGUMENT);
        inflationManager = IInflationManager(_inflationManager);
    }

    function addStakerVault(address stakerVault)
        external
        override
        onlyRoles2(Roles.GOVERNANCE, Roles.POOL_FACTORY)
        returns (bool)
    {
        if (!addressProvider.addStakerVault(stakerVault)) {
            return false;
        }
        if (address(inflationManager) != address(0)) {
            address lpGauge = IStakerVault(stakerVault).getLpGauge();
            if (lpGauge != address(0)) {
                inflationManager.whitelistGauge(lpGauge);
            }
        }
        return true;
    }

    /**
     * @notice Delists pool.
     * @param pool Address of pool to delist.
     * @return `true` if successful.
     */
    function removePool(address pool) external override onlyGovernance returns (bool) {
        if (!addressProvider.removePool(pool)) {
            return false;
        }
        address lpToken = ILiquidityPool(pool).getLpToken();

        if (address(inflationManager) != address(0)) {
            (bool exists, address stakerVault) = addressProvider.tryGetStakerVault(lpToken);
            if (exists) {
                inflationManager.removeStakerVaultFromInflation(stakerVault, lpToken);
            }
        }

        return true;
    }

    /**
     * @notice Prepares the minimum amount of staked BKD required by a keeper
     */
    function prepareKeeperRequiredStakedBKD(uint256 amount) external override onlyGovernance {
        require(addressProvider.getBKDLocker() != address(0), Error.ZERO_ADDRESS_NOT_ALLOWED);
        _prepare(_KEEPER_REQUIRED_STAKED_BKD, amount);
    }

    /**
     * @notice Resets the minimum amount of staked BKD required by a keeper
     */
    function resetKeeperRequiredStakedBKD() external override onlyGovernance {
        _resetUInt256Config(_KEEPER_REQUIRED_STAKED_BKD);
    }

    /**
     * @notice Sets the minimum amount of staked BKD required by a keeper to the prepared value
     */
    function executeKeeperRequiredStakedBKD() external override {
        _executeUInt256(_KEEPER_REQUIRED_STAKED_BKD);
    }

    /**
     * @notice Returns true if the given keeper has enough staked BKD to execute actions
     */
    function canKeeperExecuteAction(address keeper) external view override returns (bool) {
        uint256 requiredBKD = getKeeperRequiredStakedBKD();
        return
            requiredBKD == 0 ||
            IERC20(addressProvider.getBKDLocker()).balanceOf(keeper) >= requiredBKD;
    }

    /**
     * @return Returns the minimum amount of staked BKD required by a keeper
     */
    function getKeeperRequiredStakedBKD() public view override returns (uint256) {
        return currentUInts256[_KEEPER_REQUIRED_STAKED_BKD];
    }

    /**
     * @return the total amount of ETH require by `payer` to cover the fees for
     * positions registered in all actions
     */
    function getTotalEthRequiredForGas(address payer) external view override returns (uint256) {
        // solhint-disable-previous-line ordering
        uint256 totalEthRequired;
        address[] memory actions = addressProvider.allActions();
        uint256 numActions = actions.length;
        for (uint256 i; i < numActions; i = i.uncheckedInc()) {
            totalEthRequired += IAction(actions[i]).getEthRequiredForGas(payer);
        }
        return totalEthRequired;
    }
}
