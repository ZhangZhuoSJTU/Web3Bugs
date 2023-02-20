// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.0;

import './interfaces/IERC20.sol';
import './interfaces/IUniswapV3Pool.sol';
import './interfaces/IUniswapV3Factory.sol';
import './interfaces/ILinkOracle.sol';
import './interfaces/IUniswapPriceConverter.sol';
import './external/Ownable.sol';

contract UniswapV3Oracle is Ownable {

  IUniswapV3Factory public constant uniFactory    = IUniswapV3Factory(0x1F98431c8aD98523631AE4a59f267346ea31F984);
  ILinkOracle       public constant wethOracle    = ILinkOracle(0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419);
  address           public constant WETH          = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
  uint24            public constant WETH_POOL_FEE = 3000;

  struct Pool {
    address pairToken;
    uint24  poolFee;
  }

  uint32 public twapPeriod;
  uint   public minObservations;

  IUniswapPriceConverter public uniPriceConverter;

  mapping(address => Pool) public pools;

  event PoolAdded(address indexed token);
  event PoolRemoved(address indexed token);

  constructor(
    IUniswapPriceConverter _uniPriceConverter,
    uint32       _twapPeriod,
    uint         _minObservations
  ) {
    uniPriceConverter = _uniPriceConverter;
    twapPeriod        = _twapPeriod;
    minObservations   = _minObservations;
  }

  function addPool(
    address _token,
    address _pairToken,
    uint24  _poolFee
  ) external onlyOwner {

    _validatePool(_token, _pairToken, _poolFee);

    pools[_token] = Pool({
      pairToken: _pairToken,
      poolFee: _poolFee
    });

    emit PoolAdded(_token);
  }

  function removePool(address _token) external onlyOwner {
    pools[_token] = Pool(address(0), 0);
    emit PoolRemoved(_token);
  }

  function setUniPriceConverter(IUniswapPriceConverter _value) external onlyOwner {
    uniPriceConverter = _value;
  }

  function setTwapPeriod(uint32 _value) external onlyOwner {
    twapPeriod = _value;
  }

  function setMinObservations(uint _value) external onlyOwner {
    minObservations = _value;
  }

  function tokenPrice(address _token) external view returns(uint) {
    require(pools[_token].pairToken != address(0), "UniswapV3Oracle: token not supported");
    _validatePool(_token, pools[_token].pairToken, pools[_token].poolFee);

    uint ethValue = uniPriceConverter.assetToAssetThruRoute(
      _token,
      10 ** IERC20(_token).decimals(),
      WETH,
      twapPeriod,
      pools[_token].pairToken,
      [pools[_token].poolFee, WETH_POOL_FEE]
    );

    return ethValue * ethPrice() / 1e18;
  }

  function ethPrice() public view returns(uint) {
    return wethOracle.latestAnswer() * 1e10;
  }

  function isPoolValid(address _token, address _pairToken, uint24 _poolFee) public view returns(bool) {
    address poolAddress = uniFactory.getPool(_token, _pairToken, _poolFee);
    if (poolAddress == address(0)) { return false; }

    (, , , , uint observationSlots , ,) = IUniswapV3Pool(poolAddress).slot0();
    return observationSlots >= minObservations;
  }

  function tokenSupported(address _token) external view returns(bool) {
    return pools[_token].pairToken != address(0);
  }

  function _validatePool(address _token, address _pairToken, uint24 _poolFee) internal view {
    require(isPoolValid(_token, _pairToken, _poolFee), "UniswapV3Oracle: invalid pool");
  }
}
