// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {GeneralVault} from '../GeneralVault.sol';
import {IERC20} from '../../../dependencies/openzeppelin/contracts/IERC20.sol';
import {IWETH} from '../../../misc/interfaces/IWETH.sol';
import {Errors} from '../../libraries/helpers/Errors.sol';
import {TransferHelper} from '../../libraries/helpers/TransferHelper.sol';
import {SafeERC20} from '../../../dependencies/openzeppelin/contracts/SafeERC20.sol';
import {CurveswapAdapter} from '../../libraries/swap/CurveswapAdapter.sol';

/**
 * @title LidoVault
 * @notice stETH/ETH Vault by using Lido, Uniswap, Curve
 * @author Sturdy
 **/
contract LidoVault is GeneralVault {
  using SafeERC20 for IERC20;

  /**
   * @dev Receive Ether
   */
  receive() external payable {}

  /**
   * @dev Grab excess stETH which was from rebasing on Lido
   *  And convert stETH -> ETH -> asset, deposit to pool
   */
  function processYield() external override onlyAdmin {
    // Get yield from lendingPool
    address LIDO = _addressesProvider.getAddress('LIDO');
    uint256 yieldStETH = _getYield(LIDO);

    // move yield to treasury
    if (_vaultFee > 0) {
      uint256 treasuryStETH = _processTreasury(yieldStETH);
      yieldStETH = yieldStETH.sub(treasuryStETH);
    }

    // Exchange stETH -> ETH via Curve
    uint256 receivedETHAmount = CurveswapAdapter.swapExactTokensForTokens(
      _addressesProvider,
      _addressesProvider.getAddress('STETH_ETH_POOL'),
      LIDO,
      ETH,
      yieldStETH,
      200
    );

    // ETH -> WETH
    address weth = _addressesProvider.getAddress('WETH');
    IWETH(weth).deposit{value: receivedETHAmount}();

    // transfer WETH to yieldManager
    address yieldManager = _addressesProvider.getAddress('YIELD_MANAGER');
    TransferHelper.safeTransfer(weth, yieldManager, receivedETHAmount);

    emit ProcessYield(_addressesProvider.getAddress('WETH'), receivedETHAmount);
  }

  /**
   * @dev Get yield amount based on strategy
   */
  function getYieldAmount() external view returns (uint256) {
    return _getYieldAmount(_addressesProvider.getAddress('LIDO'));
  }

  /**
   * @dev Get price per share based on yield strategy
   */
  function pricePerShare() external view override returns (uint256) {
    return 1e18;
  }

  /**
   * @dev Deposit to yield pool based on strategy and receive stAsset
   */
  function _depositToYieldPool(address _asset, uint256 _amount)
    internal
    override
    returns (address, uint256)
  {
    address LIDO = _addressesProvider.getAddress('LIDO');
    uint256 assetAmount = _amount;
    if (_asset == address(0)) {
      // Case of ETH deposit from user, user has to send ETH
      require(msg.value > 0, Errors.VT_COLLATERAL_DEPOSIT_REQUIRE_ETH);

      // Deposit ETH to Lido and receive stETH
      (bool sent, bytes memory data) = LIDO.call{value: msg.value}('');
      require(sent, Errors.VT_COLLATERAL_DEPOSIT_INVALID);

      assetAmount = msg.value;
    } else {
      // Case of stETH deposit from user, receive stETH from user
      require(_asset == LIDO, Errors.VT_COLLATERAL_DEPOSIT_INVALID);
      IERC20(LIDO).safeTransferFrom(msg.sender, address(this), _amount);
    }

    // Make lendingPool to transfer required amount
    IERC20(LIDO).safeApprove(address(_addressesProvider.getLendingPool()), assetAmount);
    return (LIDO, assetAmount);
  }

  /**
   * @dev Get Withdrawal amount of stAsset based on strategy
   */
  function _getWithdrawalAmount(address _asset, uint256 _amount)
    internal
    view
    override
    returns (address, uint256)
  {
    // In this vault, return same amount of asset.
    return (_addressesProvider.getAddress('LIDO'), _amount);
  }

  /**
   * @dev Withdraw from yield pool based on strategy with stAsset and deliver asset
   */
  function _withdrawFromYieldPool(
    address _asset,
    uint256 _amount,
    address _to
  ) internal override returns (uint256) {
    address LIDO = _addressesProvider.getAddress('LIDO');
    if (_asset == address(0)) {
      // Case of ETH withdraw request from user, so exchange stETH -> ETH via curve
      uint256 receivedETHAmount = CurveswapAdapter.swapExactTokensForTokens(
        _addressesProvider,
        _addressesProvider.getAddress('STETH_ETH_POOL'),
        LIDO,
        ETH,
        _amount,
        200
      );

      // send ETH to user
      (bool sent, bytes memory data) = address(_to).call{value: receivedETHAmount}('');
      return receivedETHAmount;
      require(sent, Errors.VT_COLLATERAL_WITHDRAW_INVALID);
    } else {
      // Case of stETH withdraw request from user, so directly send
      require(_asset == LIDO, Errors.VT_COLLATERAL_WITHDRAW_INVALID);
      IERC20(LIDO).safeTransfer(_to, _amount);
    }
    return _amount;
  }

  /**
   * @dev Move some yield to treasury
   */
  function _processTreasury(uint256 _yieldAmount) internal returns (uint256) {
    uint256 treasuryAmount = _yieldAmount.percentMul(_vaultFee);
    IERC20(_addressesProvider.getAddress('LIDO')).safeTransfer(_treasuryAddress, treasuryAmount);
    return treasuryAmount;
  }
}
