// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {Errors} from '../libraries/helpers/Errors.sol';
import {VersionedInitializable} from '../../protocol/libraries/sturdy-upgradeability/VersionedInitializable.sol';
import {ILendingPoolAddressesProvider} from '../../interfaces/ILendingPoolAddressesProvider.sol';
import {ILendingPool} from '../../interfaces/ILendingPool.sol';
import {IPriceOracleGetter} from '../../interfaces/IPriceOracleGetter.sol';
import {ISwapRouter} from '../../interfaces/ISwapRouter.sol';
import {IERC20} from '../../dependencies/openzeppelin/contracts/IERC20.sol';
import {IERC20Detailed} from '../../dependencies/openzeppelin/contracts/IERC20Detailed.sol';
import {Ownable} from '../../dependencies/openzeppelin/contracts/Ownable.sol';
import {PercentageMath} from '../libraries/math/PercentageMath.sol';
import {SafeMath} from '../../dependencies/openzeppelin/contracts/SafeMath.sol';
import {TransferHelper} from '../libraries/helpers/TransferHelper.sol';
import {UniswapAdapter} from '../libraries/swap/UniswapAdapter.sol';
import {CurveswapAdapter} from '../libraries/swap/CurveswapAdapter.sol';

/**
 * @title YieldManager
 * @notice yield distributor by swapping from assets to stable coin
 * @author Sturdy
 **/

contract YieldManager is VersionedInitializable, Ownable {
  using SafeMath for uint256;
  using PercentageMath for uint256;

  struct AssetYield {
    address asset;
    uint256 amount;
  }

  // the list of the available reserves, structured as a mapping for gas savings reasons
  mapping(uint256 => address) internal _assetsList;
  uint256 internal _assetsCount;

  ILendingPoolAddressesProvider internal _addressesProvider;

  uint256 public constant VAULT_REVISION = 0x1;

  address public _exchangeToken;

  // tokenIn -> tokenOut -> Curve Pool Address
  mapping(address => mapping(address => address)) internal _curvePools;

  uint256 public constant UNISWAP_FEE = 10000; // 1%
  uint256 public constant SLIPPAGE = 500; // 5%

  modifier onlyAdmin() {
    require(_addressesProvider.getPoolAdmin() == msg.sender, Errors.CALLER_NOT_POOL_ADMIN);
    _;
  }

  /**
   * @dev Function is invoked by the proxy contract when the Vault contract is deployed.
   * @param _provider The address of the provider
   **/
  function initialize(ILendingPoolAddressesProvider _provider) public initializer {
    _addressesProvider = _provider;
  }

  function setExchangeToken(address _token) external onlyAdmin {
    require(_token != address(0), Errors.VT_INVALID_CONFIGURATION);
    _exchangeToken = _token;
  }

  function getRevision() internal pure override returns (uint256) {
    return VAULT_REVISION;
  }

  function registerAsset(address _asset) external onlyAdmin {
    _assetsList[_assetsCount] = _asset;
    _assetsCount = _assetsCount + 1;
  }

  function getAssetCount() external view returns (uint256) {
    return _assetsCount;
  }

  function getAssetInfo(uint256 _index) external view returns (address) {
    return _assetsList[_index];
  }

  /**
   * @dev Function to set Curve Pool address for the swap
   * @param _tokenIn The address of token being exchanged
   * @param _tokenOut The address of token being received
   * @param _pool The address of the Curve pool to use for the swap
   */
  function setCurvePool(
    address _tokenIn,
    address _tokenOut,
    address _pool
  ) external onlyAdmin {
    require(_pool != address(0), Errors.VT_INVALID_CONFIGURATION);
    _curvePools[_tokenIn][_tokenOut] = _pool;
  }

  /**
   * @dev Function to get Curve Pool address for the swap
   * @param _tokenIn The address of token being sent
   * @param _tokenOut The address of token being received
   */
  function getCurvePool(address _tokenIn, address _tokenOut) external view returns (address) {
    return _curvePools[_tokenIn][_tokenOut];
  }

  /**
   * @dev Distribute the yield of assets to suppliers.
   *      1. convert asset to exchange token(for now it's USDC) via Uniswap
   *      2. convert exchange token to other stables via Curve
   *      3. deposit to pool for suppliers
   * @param _offset assets array's start offset.
   * @param _count assets array's count when perform distribution.
   **/
  function distributeYield(uint256 _offset, uint256 _count) external onlyAdmin {
    // 1. convert from asset to exchange token via uniswap
    for (uint256 i = 0; i < _count; i++) {
      address asset = _assetsList[_offset + i];
      require(asset != address(0), Errors.UL_INVALID_INDEX);
      uint256 _amount = IERC20Detailed(asset).balanceOf(address(this));
      _convertAssetToExchangeToken(asset, _amount);
    }
    uint256 exchangedAmount = IERC20Detailed(_exchangeToken).balanceOf(address(this));

    // 2. convert from exchange token to other stable assets via curve swap
    AssetYield[] memory assetYields = _getAssetYields(exchangedAmount);
    for (uint256 i = 0; i < assetYields.length; i++) {
      if (assetYields[i].amount > 0) {
        uint256 _amount = _convertToStableCoin(assetYields[i].asset, assetYields[i].amount);
        // 3. deposit Yield to pool for suppliers
        _depositYield(assetYields[i].asset, _amount);
      }
    }
  }

  /**
   * @dev Get the list of asset and asset's yield amount
   **/
  function _getAssetYields(uint256 _totalYieldAmount) internal view returns (AssetYield[] memory) {
    // Get total borrowing asset volume and volumes and assets
    (
      uint256 totalVolume,
      uint256[] memory volumes,
      address[] memory assets,
      uint256 length
    ) = ILendingPool(_addressesProvider.getLendingPool()).getBorrowingAssetAndVolumes();

    if (totalVolume == 0) return new AssetYield[](0);

    AssetYield[] memory assetYields = new AssetYield[](length);
    uint256 extraYieldAmount = _totalYieldAmount;

    for (uint256 i = 0; i < length; i++) {
      assetYields[i].asset = assets[i];
      if (i != length - 1) {
        // Distribute yieldAmount based on percent of asset volume
        assetYields[i].amount = _totalYieldAmount.percentMul(
          volumes[i].mul(PercentageMath.PERCENTAGE_FACTOR).div(totalVolume)
        );
        extraYieldAmount = extraYieldAmount.sub(assetYields[i].amount);
      } else {
        // without calculation, set remained extra amount
        assetYields[i].amount = extraYieldAmount;
      }
    }

    return assetYields;
  }

  /**
   * @dev Convert asset to exchange token via Uniswap
   * @param asset The address of asset being exchanged
   * @param amount The amount of asset being exchanged
   */
  function _convertAssetToExchangeToken(address asset, uint256 amount) internal {
    UniswapAdapter.swapExactTokensForTokens(
      _addressesProvider,
      asset,
      _exchangeToken,
      amount,
      UNISWAP_FEE,
      SLIPPAGE
    );
  }

  /**
   * @dev The function to convert from exchange token to stable coin via Curve
   * @param _tokenOut The address of stable coin
   * @param _amount The amount of exchange token being sent
   * @return receivedAmount The amount of stable coin converted
   */
  function _convertToStableCoin(address _tokenOut, uint256 _amount)
    internal
    returns (uint256 receivedAmount)
  {
    if (_tokenOut == _exchangeToken) {
      return _amount;
    }
    address _pool = _curvePools[_exchangeToken][_tokenOut];
    require(_pool != address(0), Errors.VT_INVALID_CONFIGURATION);
    receivedAmount = CurveswapAdapter.swapExactTokensForTokens(
      _addressesProvider,
      _pool,
      _exchangeToken,
      _tokenOut,
      _amount,
      SLIPPAGE
    );
  }

  /**
   * @dev The function to deposit yield to pool for suppliers
   * @param _asset The address of yield asset
   * @param _amount The mount of asset
   */
  function _depositYield(address _asset, uint256 _amount) internal {
    address _lendingPool = _addressesProvider.getLendingPool();
    IERC20(_asset).approve(_lendingPool, _amount);
    ILendingPool(_lendingPool).depositYield(_asset, _amount);
  }
}
