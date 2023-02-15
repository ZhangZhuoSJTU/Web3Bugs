// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "../chainlink/AggregatorV3Interface.sol";
import "../interfaces/IGUniPool.sol";
import "../libraries/MathPow.sol";

contract GUniLPOracle is AggregatorV3Interface {
  using SafeMath for uint256;

  string public override description;
  uint256 public override version = 3;
  uint8 public override decimals;

  IGUniPool public immutable pool;
  AggregatorV3Interface public immutable oracleA;
  AggregatorV3Interface public immutable oracleB;

  uint256 private immutable _tokenDecimalsUnitA;
  uint256 private immutable _tokenDecimalsOffsetA;
  uint256 private immutable _tokenDecimalsUnitB;
  uint256 private immutable _tokenDecimalsOffsetB;

  constructor(
    uint8 _decimals,
    string memory _description,
    IGUniPool _pool,
    AggregatorV3Interface _oracleA,
    AggregatorV3Interface _oracleB
  ) public {
    require(address(_pool) != address(0), "C000");
    require(address(_oracleA) != address(0), "C000");
    require(address(_oracleB) != address(0), "C000");

    decimals = _decimals;
    description = _description;
    pool = _pool;
    oracleA = _oracleA;
    oracleB = _oracleB;

    uint256 decimalsA = ERC20(_pool.token0()).decimals();
    _tokenDecimalsUnitA = 10**decimalsA;
    _tokenDecimalsOffsetA = 10**(18 - decimalsA);

    uint256 decimalsB = ERC20(_pool.token1()).decimals();
    _tokenDecimalsUnitB = 10**decimalsB;
    _tokenDecimalsOffsetB = 10**(18 - decimalsB);
  }

  function getRoundData(uint80 _roundId)
    public
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
    // Skip the implementation since it is not used by price feed
  }

  /**
   * @notice get data about the latest round. Consumers are encouraged to check
   * that they're receiving fresh data by inspecting the updatedAt and
   * answeredInRound return values.
   * Note that different underlying implementations of AggregatorV3Interface
   * have slightly different semantics for some of the return values. Consumers
   * should determine what implementations they expect to receive
   * data from and validate that they can properly handle return data from all
   * of them.
   * @return roundId is the round ID from the aggregator for which the data was
   * retrieved combined with an phase to ensure that round IDs get larger as
   * time moves forward.
   * @return answer is the answer for the given round
   * @return startedAt is the timestamp when the round was started.
   * (Only some AggregatorV3Interface implementations return meaningful values)
   * @return updatedAt is the timestamp when the round last was updated (i.e.
   * answer was last computed)
   * @return answeredInRound is the round ID of the round in which the answer
   * was computed.
   * (Only some AggregatorV3Interface implementations return meaningful values)
   * @dev Note that answer and updatedAt may change between queries.
   */
  function latestRoundData()
    public
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
    (, int256 answerA, , uint256 assetUpdatedAtA, ) = oracleA.latestRoundData();
    (, int256 answerB, , uint256 assetUpdatedAtB, ) = oracleB.latestRoundData();
    uint256 priceA = uint256(answerA);
    uint256 priceB = uint256(answerB);
    uint160 sqrtPriceX96 = uint160(
      MathPow.sqrt((priceA.mul(_tokenDecimalsUnitB).mul(1 << 96)) / (priceB.mul(_tokenDecimalsUnitA))) << 48
    );

    (uint256 rA, uint256 rB) = pool.getUnderlyingBalancesAtPrice(sqrtPriceX96);
    require(rA > 0 || rB > 0, "C100");
    uint256 totalSupply = pool.totalSupply();
    require(totalSupply >= 1e9, "C101");

    answer = int256(
      priceA.mul(rA.mul(_tokenDecimalsOffsetA)).add(priceB.mul(rB.mul(_tokenDecimalsOffsetB))).div(totalSupply)
    );
    updatedAt = assetUpdatedAtA;

    // use ealier time for updateAt
    if (assetUpdatedAtA > assetUpdatedAtB) {
      updatedAt = assetUpdatedAtB;
    }
  }
}
