// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "./IAddressProvider.sol";
import "./IPreparable.sol";
import "./IGasBank.sol";
import "./pool/ILiquidityPool.sol";
import "./tokenomics/IInflationManager.sol";

// solhint-disable ordering

interface IController is IPreparable {
    function addressProvider() external view returns (IAddressProvider);

    function inflationManager() external view returns (IInflationManager);

    function addStakerVault(address stakerVault) external returns (bool);

    function removePool(address pool) external returns (bool);

    /** Keeper functions */
    function prepareKeeperRequiredStakedBKD(uint256 amount) external;

    function resetKeeperRequiredStakedBKD() external;

    function executeKeeperRequiredStakedBKD() external;

    function getKeeperRequiredStakedBKD() external view returns (uint256);

    function canKeeperExecuteAction(address keeper) external view returns (bool);

    /** Miscellaneous functions */

    function getTotalEthRequiredForGas(address payer) external view returns (uint256);
}
