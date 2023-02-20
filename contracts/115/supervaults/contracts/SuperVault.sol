// SPDX-License-Identifier: MIT

pragma experimental ABIEncoderV2;
pragma solidity 0.8.10;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import { IPool } from "@aave/core-v3/contracts/interfaces/IPool.sol";

import "./interfaces/IAddressProvider.sol";
import "./interfaces/IGovernanceAddressProvider.sol";
import "./interfaces/IVaultsCore.sol";
import "./interfaces/IGenericMiner.sol";
import "./interfaces/IDexAddressProvider.sol";

/// @title A parallel protocol vault with added functionality
/// @notice You can use this for collateral rebalancing
/// @dev This contract should be cloned and initialized with a SuperVaultFactory contract
contract SuperVault is AccessControl, Initializable {
  enum Operation {
    LEVERAGE,
    REBALANCE,
    EMPTY
  }

  struct AggregatorRequest {
    uint256 parToSell;
    bytes dexTxData;
    uint dexIndex;
  }

  IAddressProvider public a;
  IGovernanceAddressProvider public ga;
  IPool public lendingPool;
  IDexAddressProvider internal _dexAP;

  modifier onlyOwner() {
    require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "SV001");
    _;
  }

  ///@notice Initializes the Supervault contract
  ///@dev This replaces the constructor function as in the factory design pattern
  ///@param _a The address of the protocol's AddressProvider
  ///@param _ga The address of the protocol's GovernanceAddressProvider
  ///@param _lendingPool The address of the lendingPool from where flashLoans are taken
  ///@param _owner The owner of this SuperVault contract
  function initialize(
    IAddressProvider _a,
    IGovernanceAddressProvider _ga,
    IPool _lendingPool,
    address _owner,
    IDexAddressProvider dexAP
  ) external initializer {
    require(address(_a) != address(0));
    require(address(_ga) != address(0));
    require(address(_lendingPool) != address(0));
    require(address(dexAP) != address(0));

    a = _a;
    ga = _ga;
    lendingPool = _lendingPool;
    _dexAP = dexAP;

    _setupRole(DEFAULT_ADMIN_ROLE, _owner);
  }

  ///@notice Routes a call from a flashloan pool to a leverage or rebalance operation
  ///@dev This Integrates with AAVE V2 flashLoans
  ///@dev This function is called by the lendingPool during execution of the leverage function
  ///@param assets An address array with one element corresponding to the address of the leveraged or rebalanced asset
  ///@param amounts A uint array with one element corresponding to the amount of the leveraged or rebalanced asset
  ///@param premiums A uint array with one element corresponding to the flashLoan fees
  ///@param params Bytes sent by the leverage or rebalance function that contains information on the aggregator swap
  function executeOperation(
    address[] calldata assets,
    uint256[] calldata amounts,
    uint256[] calldata premiums,
    address,
    bytes calldata params
  ) external returns (bool) {
    require(msg.sender == address(lendingPool), "SV002");
    (Operation operation, bytes memory operationParams) = abi.decode(params, (Operation, bytes));
    IERC20 asset = IERC20(assets[0]);
    uint256 flashloanRepayAmount = amounts[0] + premiums[0];
    if (operation == Operation.LEVERAGE) {
      leverageOperation(asset, flashloanRepayAmount, operationParams);
    }
    if (operation == Operation.REBALANCE) {
      rebalanceOperation(asset, amounts[0], flashloanRepayAmount, operationParams);
    }
    if (operation == Operation.EMPTY) {
      emptyVaultOperation(asset, amounts[0], flashloanRepayAmount, operationParams);
    }

    asset.approve(address(lendingPool), flashloanRepayAmount);
    return true;
  }

  ///@notice Used by executeOperation to call an aggregator to swap and deposit the swapped asset into a vault
  function leverageOperation(
    IERC20 token,
    uint256 flashloanRepayAmount,
    bytes memory params
  ) internal {
    leverageSwap(params, token);

    require(token.balanceOf(address(this)) >= flashloanRepayAmount, "SV101");
    a.core().deposit(address(token), token.balanceOf(address(this)) - flashloanRepayAmount);
  }

  ///@notice Leverage an asset using a flashloan to balance collateral
  ///@dev This uses an AAVE V2 flashLoan that will call executeOperation
  ///@param asset The address of the asset to leverage
  ///@param depositAmount The initial starting amount, e.g. 1 ETH
  ///@param borrowAmount The amount to be borrowed, e.g. 2 ETH, bringing the total to 3 ETH
  ///@param parToSell The amount of PAR we'll borrow so we can repay the leverage
  ///@param dexTxData Bytes that will be passed to executeOperation that encodes args for the aggregator Swap
  ///@param dexIndex DexAddressProvider index of the aggregator to be used for selling PAR, either OneInch or Paraswap
  function leverage(
    address asset,
    uint256 depositAmount, //
    uint256 borrowAmount, //
    uint256 parToSell, //
    bytes calldata dexTxData,
    uint dexIndex 
  ) external onlyOwner {
    IERC20(asset).transferFrom(msg.sender, address(this), depositAmount);
    bytes memory leverageParams = abi.encode(parToSell, dexTxData, dexIndex);
    bytes memory params = abi.encode(Operation.LEVERAGE, leverageParams);
    takeFlashLoan(asset, borrowAmount, params);
    checkAndSendMIMO();
  }

  ///@notice Used by executeOperation to flashloan an asset, call an aggregator to swap for toAsset, and then rebalance the vault
  function rebalanceOperation(
    IERC20 fromCollateral,
    uint256 amount,
    uint256 flashloanRepayAmount,
    bytes memory params
  ) internal {
    (uint256 vaultId, address toCollateral, uint256 parAmount, bytes memory dexTxData, uint dexIndex) = abi
      .decode(params, (uint256, address, uint256, bytes, uint ));
    aggregatorSwap(dexIndex, fromCollateral, amount, dexTxData);

    uint256 depositAmount = IERC20(toCollateral).balanceOf(address(this));

    IERC20(toCollateral).approve(address(a.core()), depositAmount);

    a.core().depositAndBorrow(toCollateral, depositAmount, parAmount);
    a.core().repay(vaultId, parAmount);

    a.core().withdraw(vaultId, flashloanRepayAmount);

    require(fromCollateral.balanceOf(address(this)) >= flashloanRepayAmount, "SV101");
  }

  ///@notice Uses a flashloan to exchange one collateral type for another, e.g. to hold less volatile collateral
  ///@notice Both collateral vaults must have been created by this contract using the depositToVault or depositAndBorrowFromVault functions
  ///@dev This uses an AAVE V2 flashLoan that will call executeOperation
  ///@param vaultId The Id of the vault to reduce the collateral of
  ///@param toCollateral Address of the collateral to rebalance to
  ///@param fromCollateral Address of the starting collateral that will be reduced
  ///@param fromCollateralAmount Amount of starting collateral to deleverage
  ///@param parAmount Amount of par that will be deposited to exchange for
  ///@param dexTxData Bytes that will be passed to executeOperation that encodes args for the aggregator Swap
  ///@param dexIndex DexAddressProvider index representing the aggregator to be used for selling PAR, either OneInch or Paraswap
  function rebalance(
    uint256 vaultId, // vaultId to deleverage
    address toCollateral,
    address fromCollateral, // save some gas by just passing in collateral type instead of querying VaultsDataProvider for it
    uint256 fromCollateralAmount, // amount of collateral to reduce in main vault and borrow from Aave first
    uint256 parAmount, // amount of PAR to repay and deleverage
    bytes calldata dexTxData,
    uint dexIndex 
  ) external onlyOwner {
    bytes memory rebalanceParams = abi.encode(vaultId, toCollateral, parAmount, dexTxData, dexIndex);
    bytes memory params = abi.encode(Operation.REBALANCE, rebalanceParams);

    takeFlashLoan(fromCollateral, fromCollateralAmount, params);
    checkAndSendMIMO();
  }

  ///@notice Used by executeOperation to repay all debt for a vault, withdraw collateral from the vault, and send the collateral back to the user
  ///@notice There will likely be some leftover par after repaying the loan; that will also be sent back to the user
  function emptyVaultOperation(
    IERC20 vaultCollateral,
    uint256 amount,
    uint256 flashloanRepayAmount,
    bytes memory params
  ) internal {
    // Use par to repay debt
    (uint256 vaultId, bytes memory dexTxData, uint dexIndex) = abi.decode(params, (uint256, bytes, uint));

    aggregatorSwap(dexIndex, vaultCollateral, amount, dexTxData); // swap assets for par to repay back loan

    IERC20 par = IERC20(a.stablex());
    par.approve(address(a.core()), par.balanceOf(address(this)));

    // Repay the par debt
    a.core().repayAll(vaultId);
    uint256 vaultBalance = a.vaultsData().vaultCollateralBalance(vaultId);
    // Withdraw all collateral
    a.core().withdraw(vaultId, vaultBalance);

    require(vaultCollateral.balanceOf(address(this)) >= flashloanRepayAmount, "SV101");
  }

  ///@notice Uses a flashloan to repay all debts for a vault and send all collateral in the vault to the owner
  ///@notice This vault must have been created by this contract
  ///@dev This uses an AAVE V2 flashLoan that will call executeOperation
  ///@param vaultId The Id of the vault to empty
  ///@param collateralType Address of the collateral of the vault
  ///@param repayAmount Amount of par that needs to be repaid before all collateral can be withdrawn
  ///@param dexTxData Bytes that contain the low-level call to swap the vault asset for par to repay the vault loan
  ///@param dexIndex Index to use for swapping the vault collateral for par
  function emptyVault(
    uint256 vaultId,
    address collateralType,
    uint256 repayAmount, // Amount, in collateral type, needed to borrow to repay current vault debt
    bytes calldata dexTxData,
    uint dexIndex 
  ) external onlyOwner {
    // Flashloan collateral and swap for par to repay any outstanding vault debt
    bytes memory emptyVaultParams = abi.encode(vaultId, dexTxData, dexIndex);
    bytes memory params = abi.encode(Operation.EMPTY, emptyVaultParams);
    takeFlashLoan(collateralType, repayAmount, params);

    checkAndSendMIMO();

    // Send remaining par, mimo, and collateral back to the owner
    require(IERC20(a.stablex()).transfer(msg.sender, IERC20(a.stablex()).balanceOf(address(this))));
    checkAndSendMIMO();

    IERC20 collateral = IERC20(collateralType);
    collateral.transfer(msg.sender, collateral.balanceOf(address(this)));
  }

  ///@notice Withdraw collateral from a vault
  ///@notice Vault must have been created through leverage, depositToVault, or depositAndBorrowFromVault from this contract
  ///@param vaultId The ID of the vault to withdraw from
  ///@param amount The amount of collateral to withdraw
  function withdrawFromVault(uint256 vaultId, uint256 amount) external onlyOwner {
    a.core().withdraw(vaultId, amount);
    IERC20 asset = IERC20(a.vaultsData().vaultCollateralType(vaultId));
    require(asset.transfer(msg.sender, amount));
  }

  ///@notice Borrow PAR from a vault
  ///@param vaultId The ID of the vault to borrow from
  ///@param amount The amount of PAR to borrow
  function borrowFromVault(uint256 vaultId, uint256 amount) external onlyOwner {
    a.core().borrow(vaultId, amount);
    require(IERC20(a.stablex()).transfer(msg.sender, IERC20(a.stablex()).balanceOf(address(this))));
    checkAndSendMIMO();
  }

  ///@notice Withdraw all of one type of collateral from this contract
  ///@notice Can only be used on vaults which have been created by this contract
  ///@param asset The address of the collateral type
  function withdrawAsset(address asset) external onlyOwner {
    IERC20 token = IERC20(asset);
    require(token.transfer(msg.sender, token.balanceOf(address(this))));
  }

  ///@notice Deposit collateral into a vault
  ///@notice Requires approval of asset for amount before calling
  ///@param asset Address of the collateral type
  ///@param amount Amount to deposit
  function depositToVault(address asset, uint256 amount) external {
    IERC20 token = IERC20(asset);
    token.approve(address(a.core()), amount);
    token.transferFrom(msg.sender, address(this), amount);
    a.core().deposit(asset, amount);
  }

  ///@notice Deposit collateral into a vault and borrow PAR
  ///@notice Requires approval of asset for amount before calling
  ///@param asset Address of the collateral type
  ///@param depositAmount Amount to deposit
  ///@param borrowAmount Amount of PAR to borrow after depositing
  function depositAndBorrowFromVault(
    address asset,
    uint256 depositAmount,
    uint256 borrowAmount
  ) external onlyOwner {
    IERC20 token = IERC20(asset);
    token.approve(address(a.core()), depositAmount);
    token.transferFrom(msg.sender, address(this), depositAmount);
    a.core().depositAndBorrow(asset, depositAmount, borrowAmount);
    require(IERC20(a.stablex()).transfer(msg.sender, IERC20(a.stablex()).balanceOf(address(this)))); //par
    checkAndSendMIMO();
  }

  ///@notice Release MIMO from a MIMO miner to the owner
  ///@param minerAddress The address of the MIMO miner
  function releaseMIMO(address minerAddress) external payable onlyOwner {
    IGenericMiner miner = IGenericMiner(minerAddress);
    miner.releaseMIMO(address(this));
    checkAndSendMIMO();
  }

  ///@notice Wrap ETH and deposit WETH as collateral into a vault
  function depositETHToVault() external payable {
    a.core().depositETH{ value: msg.value }();
  }

  ///@notice Wrap ETH and deposit WETH as collateral into a vault, then borrow PAR from vault
  ///@param borrowAmount The amount of PAR to borrow after depositing ETH
  function depositETHAndBorrowFromVault(uint256 borrowAmount) external payable onlyOwner {
    a.core().depositETHAndBorrow{ value: msg.value }(borrowAmount);
    require(IERC20(a.stablex()).transfer(msg.sender, IERC20(a.stablex()).balanceOf(address(this)))); //par
    checkAndSendMIMO();
  }

  ///@notice Helper function to call an aggregator to swap PAR for a leveraged asset
  ///@dev This helper function is used to limit the number of local variables in the leverageOperation function
  ///@param params The params passed from the leverageOperation function for the aggregator call
  ///@param token The leveraged asset to swap PAR for
  function leverageSwap(bytes memory params, IERC20 token) internal {
    (uint256 parToSell, bytes memory dexTxData, uint dexIndex) = abi.decode(
      params,
      (uint256, bytes, uint )
    );
    token.approve(address(a.core()), 2**256 - 1);
    a.core().depositAndBorrow(address(token), token.balanceOf(address(this)), parToSell);
    IERC20 par = IERC20(a.stablex());
    aggregatorSwap(dexIndex, par, parToSell, dexTxData);
  }

  ///@notice Helper function to approve and swap an asset using an aggregator
  ///@param dexIndex The DexAddressProvider index of aggregator to use to swap
  ///@param token The starting token to swap for another asset
  ///@param amount The amount of starting token to swap for
  ///@param dexTxData The low-level data to call the aggregator with
  function aggregatorSwap(
    uint256 dexIndex,
    IERC20 token,
    uint256 amount,
    bytes memory dexTxData
  ) internal {
    (address proxy, address router) = _dexAP.dexMapping(dexIndex);
    require(proxy != address(0) && router != address(0), "SV201"); 
    token.approve(proxy, amount);
    router.call(dexTxData);
  }

  ///@notice Helper function to format arguments to take a flashloan
  ///@dev The flashloan call will call the executeOperation function on this contract
  ///@param asset The address of the asset to loan
  ///@param amount The amount to borrow
  ///@param params The params that will be sent to executeOperation after the asset is borrowed
  function takeFlashLoan(
    address asset,
    uint256 amount,
    bytes memory params
  ) internal {
    uint8 referralCode;
    address[] memory assets = new address[](1);
    uint256[] memory amounts = new uint256[](1);
    uint256[] memory modes = new uint256[](1);
    (assets[0], amounts[0]) = (asset, amount);
    lendingPool.flashLoan(address(this), assets, amounts, modes, address(this), params, referralCode);
  }

  ///@notice Helper function to transfer all MIMO owned by this contract to the Owner
  function checkAndSendMIMO() internal {
    if (ga.mimo().balanceOf(address(this)) > 0) {
      require(ga.mimo().transfer(msg.sender, ga.mimo().balanceOf(address(this))));
    }
  }
}
