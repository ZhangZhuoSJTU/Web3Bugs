// SPDX-License-Identifier: MIT
pragma experimental ABIEncoderV2;
pragma solidity 0.6.12;

import "./IConfigProviderV1.sol";
import "./ILiquidationManagerV1.sol";
import "./IVaultsCoreV1.sol";
import "../../interfaces/IVaultsCore.sol";
import "../../interfaces/IAccessController.sol";
import "../../interfaces/ISTABLEX.sol";
import "../../interfaces/IPriceFeed.sol";
import "../../interfaces/IRatesManager.sol";
import "../../interfaces/IVaultsDataProvider.sol";
import "../../interfaces/IFeeDistributor.sol";

interface IAddressProviderV1 {
  function setAccessController(IAccessController _controller) external;

  function setConfigProvider(IConfigProviderV1 _config) external;

  function setVaultsCore(IVaultsCoreV1 _core) external;

  function setStableX(ISTABLEX _stablex) external;

  function setRatesManager(IRatesManager _ratesManager) external;

  function setPriceFeed(IPriceFeed _priceFeed) external;

  function setLiquidationManager(ILiquidationManagerV1 _liquidationManager) external;

  function setVaultsDataProvider(IVaultsDataProvider _vaultsData) external;

  function setFeeDistributor(IFeeDistributor _feeDistributor) external;

  function controller() external view returns (IAccessController);

  function config() external view returns (IConfigProviderV1);

  function core() external view returns (IVaultsCoreV1);

  function stablex() external view returns (ISTABLEX);

  function ratesManager() external view returns (IRatesManager);

  function priceFeed() external view returns (IPriceFeed);

  function liquidationManager() external view returns (ILiquidationManagerV1);

  function vaultsData() external view returns (IVaultsDataProvider);

  function feeDistributor() external view returns (IFeeDistributor);
}
