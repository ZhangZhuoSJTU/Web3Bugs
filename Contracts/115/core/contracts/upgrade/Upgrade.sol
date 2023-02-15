// SPDX-License-Identifier: MIT

pragma experimental ABIEncoderV2;
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../v1/interfaces/IConfigProviderV1.sol";
import "../v1/interfaces/IVaultsCoreV1.sol";
import "../v1/interfaces/IFeeDistributorV1.sol";
import "../interfaces/IAddressProvider.sol";
import "../interfaces/IVaultsCore.sol";
import "../interfaces/IVaultsCoreState.sol";
import "../interfaces/ILiquidationManager.sol";
import "../interfaces/IConfigProvider.sol";
import "../interfaces/IFeeDistributor.sol";
import "../liquidityMining/interfaces/IDebtNotifier.sol";

contract Upgrade {
  using SafeMath for uint256;

  uint256 public constant LIQUIDATION_BONUS = 5e16; // 5%

  IAddressProvider public a;
  IVaultsCore public core;
  IVaultsCoreState public coreState;
  ILiquidationManager public liquidationManager;
  IConfigProvider public config;
  IFeeDistributor public feeDistributor;
  IDebtNotifier public debtNotifier;
  IPriceFeed public priceFeed;
  address public bpool;

  modifier onlyManager() {
    require(a.controller().hasRole(a.controller().MANAGER_ROLE(), msg.sender));
    _;
  }

  constructor(
    IAddressProvider _addresses,
    IVaultsCore _core,
    IVaultsCoreState _coreState,
    ILiquidationManager _liquidationManager,
    IConfigProvider _config,
    IFeeDistributor _feeDistributor,
    IDebtNotifier _debtNotifier,
    IPriceFeed _priceFeed,
    address _bpool
  ) public {
    require(address(_addresses) != address(0));
    require(address(_core) != address(0));
    require(address(_coreState) != address(0));
    require(address(_liquidationManager) != address(0));
    require(address(_config) != address(0));
    require(address(_feeDistributor) != address(0));
    require(address(_debtNotifier) != address(0));
    require(address(_priceFeed) != address(0));
    require(_bpool != address(0));

    a = _addresses;
    core = _core;
    coreState = _coreState;
    liquidationManager = _liquidationManager;
    config = _config;
    feeDistributor = _feeDistributor;
    debtNotifier = _debtNotifier;
    priceFeed = _priceFeed;
    bpool = _bpool;
  }

  function upgrade() public onlyManager {
    IConfigProviderV1 oldConfig = IConfigProviderV1(address(a.config()));
    IPriceFeed oldPriceFeed = IPriceFeed(address(a.priceFeed()));
    IVaultsCoreV1 oldCore = IVaultsCoreV1(address(a.core()));
    IFeeDistributorV1 oldFeeDistributor = IFeeDistributorV1(address(a.feeDistributor()));

    bytes32 MINTER_ROLE = a.controller().MINTER_ROLE();
    bytes32 MANAGER_ROLE = a.controller().MANAGER_ROLE();
    bytes32 DEFAULT_ADMIN_ROLE = 0x0000000000000000000000000000000000000000000000000000000000000000;
    a.controller().grantRole(MANAGER_ROLE, address(this));
    a.controller().grantRole(MINTER_ROLE, address(core));
    a.controller().grantRole(MINTER_ROLE, address(feeDistributor));

    oldCore.refresh();
    if (oldCore.availableIncome() > 0) {
      oldFeeDistributor.release();
    }

    a.controller().revokeRole(MINTER_ROLE, address(a.core()));
    a.controller().revokeRole(MINTER_ROLE, address(a.feeDistributor()));

    oldCore.upgrade(payable(address(core)));

    a.setVaultsCore(core);
    a.setConfigProvider(config);
    a.setLiquidationManager(liquidationManager);
    a.setFeeDistributor(feeDistributor);
    a.setPriceFeed(priceFeed);

    priceFeed.setEurOracle(address(oldPriceFeed.eurOracle()));

    uint256 numCollateralConfigs = oldConfig.numCollateralConfigs();
    for (uint256 i = 1; i <= numCollateralConfigs; i++) {
      IConfigProviderV1.CollateralConfig memory collateralConfig = oldConfig.collateralConfigs(i);

      config.setCollateralConfig(
        collateralConfig.collateralType,
        collateralConfig.debtLimit,
        collateralConfig.minCollateralRatio,
        collateralConfig.minCollateralRatio,
        collateralConfig.borrowRate,
        collateralConfig.originationFee,
        LIQUIDATION_BONUS,
        0
      );

      priceFeed.setAssetOracle(
        collateralConfig.collateralType,
        address(oldPriceFeed.assetOracles(collateralConfig.collateralType))
      );
    }

    coreState.syncStateFromV1(oldCore);
    core.acceptUpgrade(payable(address(oldCore)));
    core.setDebtNotifier(debtNotifier);
    debtNotifier.a().setDebtNotifier(debtNotifier);

    address[] memory payees = new address[](2);
    payees[0] = bpool;
    payees[1] = address(core);
    uint256[] memory shares = new uint256[](2);
    shares[0] = uint256(90);
    shares[1] = uint256(10);
    feeDistributor.changePayees(payees, shares);

    a.controller().revokeRole(MANAGER_ROLE, address(this));
    a.controller().revokeRole(DEFAULT_ADMIN_ROLE, address(this));
  }
}
