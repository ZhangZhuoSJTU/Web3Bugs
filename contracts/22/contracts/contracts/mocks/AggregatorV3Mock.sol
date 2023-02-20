// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.3;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

/*
 * AggregatorV3Mock is an implementation of a chainlink oracle that allows prices
 * to be set arbitrarily for testing.
 */
contract AggregatorV3Mock is AggregatorV3Interface, Initializable {
  // Admin contracts.
  address public admin;
  uint8 public override decimals;
  uint256 public override version;

  string public override description = "This is a mock chainlink oracle";

  struct RoundData {
    uint80 answeredInRound;
    int256 answer;
    uint256 setAt;
  }
  mapping(uint80 => RoundData) public roundData;
  uint80 currentRoundId;

  ////////////////////////////////////
  /////////// MODIFIERS //////////////
  ////////////////////////////////////

  modifier adminOnly() {
    require(msg.sender == admin, "Not admin");
    _;
  }

  ////////////////////////////////////
  ///// CONTRACT SET-UP //////////////
  ////////////////////////////////////

  function setup(
    address _admin,
    int256 _price,
    uint8 _decimals
  ) public initializer {
    admin = _admin;
    decimals = (_decimals != 0) ? _decimals : 18;
    version = 1;
    currentRoundId = 1;
    roundData[currentRoundId] = RoundData(currentRoundId, _price, block.timestamp);
  }

  ////////////////////////////////////
  ///// IMPLEMENTATION ///////////////
  ////////////////////////////////////

  /*
   * Sets the mock rate for the oracle.
   */
  function setPrice(int256 _price) public {
    currentRoundId = currentRoundId + 1;
    roundData[currentRoundId] = RoundData(currentRoundId, _price, block.timestamp);
  }

  function getRoundData(uint80 _roundId)
    external
    view
    override
    returns (
      uint80 roundId,
      int256 answer,
      uint256 startedAt,
      uint256 updatedAt,
      uint80 answeredInRound
    )
  {
    RoundData storage round = roundData[_roundId];
    return (_roundId, round.answer, round.setAt, round.setAt, 1);
  }

  function latestRoundData()
    external
    view
    override
    returns (
      uint80 roundId,
      int256 answer,
      uint256 startedAt,
      uint256 updatedAt,
      uint80 answeredInRound
    )
  {
    RoundData storage round = roundData[currentRoundId];
    return (currentRoundId, round.answer, round.setAt, round.setAt, 1);
  }
}
