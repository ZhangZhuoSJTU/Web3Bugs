// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.3;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

import "../interfaces/IOracleManager.sol";

/**
  Contract that estimates ETH / BTC dominance,
  expressed as (eth market cap) / (btc market cap)
  Estimates BTC & ETH supply. In the future
  look towards using oracles for it. 
*/
contract OracleManagerFlippening_V0 is IOracleManager {
  address public admin; // This will likely be the Gnosis safe

  int256 public ethDominance;

  uint256 public ethSupply; // 18 decimals
  uint256 public btcSupply; // 8 decimals

  uint256 public btcBlocksPerDay;
  uint256 public ethBlocksPerDay;

  uint256 public btcBlockReward; // 8 decimals
  uint256 public ethBlockReward; // 18 decimals

  uint256 public ethUnclesPerDay;

  // Eth has a variable uncle reward:
  //       - https://github.com/ethereum/EIPs/blob/master/EIPS/eip-1234.md,
  // Source here says it's roughly 75%:
  //       - https://docs.ethhub.io/ethereum-basics/monetary-policy/
  // Might be worth also looking into just taking it as the mean of the possibilities
  //         = sum from 1 to 7 of (8 - sumIndex) * blockReward / 8 / 7

  uint256 public ethUncleReward; // 18 decimals

  uint256 public ethNephewReward; // 18 decimals. currently = blockReward / 32

  uint256 lastUpdated;

  // Oracle addresses
  AggregatorV3Interface public btcOracle;
  AggregatorV3Interface public ethOracle;

  ////////////////////////////////////
  /////////// MODIFIERS //////////////
  ////////////////////////////////////

  modifier adminOnly() {
    require(msg.sender == admin);
    _;
  }

  ////////////////////////////////////
  ///// CONTRACT SET-UP //////////////
  ////////////////////////////////////

  constructor(
    address _admin,
    address _btcOracle,
    address _ethOracle,
    uint256 _ethSupply,
    uint256 _btcSupply,
    uint256 _btcBlocksPerDay,
    uint256 _ethBlocksPerDay,
    uint256 _ethUnclesPerDay,
    uint256 _btcBlockReward,
    uint256 _ethBlockReward,
    uint256 _ethUncleReward,
    uint256 _ethNephewReward
  ) {
    admin = _admin;

    btcOracle = AggregatorV3Interface(_btcOracle);
    ethOracle = AggregatorV3Interface(_ethOracle);

    ethSupply = _ethSupply;
    btcSupply = _btcSupply;

    btcBlocksPerDay = _btcBlocksPerDay;

    ethBlocksPerDay = _ethBlocksPerDay;
    ethUnclesPerDay = _ethUnclesPerDay;

    btcBlockReward = _btcBlockReward;

    ethBlockReward = _ethBlockReward;
    ethUncleReward = _ethUncleReward;
    ethNephewReward = _ethNephewReward;

    lastUpdated = block.timestamp;

    _updatePrice();
  }

  ////////////////////////////////////
  /// MULTISIG ADMIN FUNCTIONS ///////
  ////////////////////////////////////

  function changeAdmin(address _admin) external adminOnly {
    admin = _admin;
  }

  function changeEthSupply(uint256 supply) external adminOnly {
    ethSupply = supply;
  }

  function changeBtcSupply(uint256 supply) external adminOnly {
    btcSupply = supply;
  }

  function changeBtcBlocksPerDay(uint256 blocks) external adminOnly {
    btcBlocksPerDay = blocks;
  }

  function changeEthBlocksPerDay(uint256 blocks) external adminOnly {
    ethBlocksPerDay = blocks;
  }

  function changeEthUnclesPerDay(uint256 uncles) external adminOnly {
    ethUnclesPerDay = uncles;
  }

  function changeBtcBlockReward(uint256 reward) external adminOnly {
    btcBlockReward = reward;
  }

  function changeEthBlockReward(uint256 reward) external adminOnly {
    ethBlockReward = reward;
  }

  function changeEthUncleReward(uint256 reward) external adminOnly {
    ethUncleReward = reward;
  }

  function changeEthNephewReward(uint256 reward) external adminOnly {
    ethNephewReward = reward;
  }

  ////////////////////////////////////
  ///// IMPLEMENTATION ///////////////
  ////////////////////////////////////

  function _getBtcSupply() internal view returns (uint256) {
    return btcSupply + (((block.timestamp - lastUpdated) * btcBlocksPerDay * btcBlockReward) / (1 days));
  }

  function _getEthSupply() internal view returns (uint256) {
    return
      ethSupply +
      (((block.timestamp - lastUpdated) *
        (ethBlocksPerDay * ethBlockReward + ethUnclesPerDay * (ethNephewReward + ethUncleReward))) / 1 days);
  }

  function _updatePrice() private returns (int256) {
    (, int256 _ethPrice, , , ) = ethOracle.latestRoundData();
    (, int256 _btcPrice, , , ) = btcOracle.latestRoundData();
    ethSupply = _getEthSupply();
    btcSupply = _getBtcSupply();

    lastUpdated = block.timestamp;

    // ethSupply * ethPrice = 26 decimals
    // btcSupply * btcPrice = 16 decimals

    // 1e20 as 18 decimals but as %
    ethDominance = int256((uint256(_ethPrice) * ethSupply * 1e20) / (uint256(_btcPrice) * btcSupply * 1e10));

    return ethDominance;
  }

  function updatePrice() external override returns (int256) {
    return _updatePrice();
  }

  function getLatestPrice() external view override returns (int256) {
    return ethDominance;
  }
}
