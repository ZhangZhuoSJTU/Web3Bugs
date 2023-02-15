// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "../chainlink/AggregatorV3Interface.sol";
import "../interfaces/IBalancerVault.sol";
import "../interfaces/IBalancerPool.sol";
import "../libraries/BNum.sol";
import "../libraries/MathPow.sol";

contract BalancerV2LPOracle is AggregatorV3Interface, BNum {
  using SafeMath for uint256;

  string public override description;
  uint256 public override version = 3;
  uint8 public override decimals;

  bytes32 public poolId;
  IBalancerVault public vault;
  IBalancerPool public pool;
  AggregatorV3Interface public oracleA;
  AggregatorV3Interface public oracleB;

  constructor(
    uint8 _decimals,
    string memory _description,
    IBalancerVault _vault,
    bytes32 _poolId,
    AggregatorV3Interface _oracleA,
    AggregatorV3Interface _oracleB
  ) public {
    require(address(_vault) != address(0), "C000");
    require(address(_oracleA) != address(0), "C000");
    require(address(_oracleB) != address(0), "C000");

    vault = _vault;
    poolId = _poolId;
    (address _pool, IBalancerVault.PoolSpecialization tokensNum) = vault.getPool(poolId);
    require(tokensNum == IBalancerVault.PoolSpecialization.TWO_TOKEN, "C001");

    decimals = _decimals;
    description = _description;
    pool = IBalancerPool(_pool);
    oracleA = _oracleA;
    oracleB = _oracleB;
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
    (address[] memory tokens, uint256[] memory balances, ) = vault.getPoolTokens(poolId);
    (, int256 answerA, , uint256 assetUpdatedAtA, ) = oracleA.latestRoundData();
    (, int256 answerB, , uint256 assetUpdatedAtB, ) = oracleB.latestRoundData();

    uint256[] memory normalizedWeights = pool.getNormalizedWeights();

    uint256 pxA = uint256(answerA);
    uint256 pxB = uint256(answerB);
    (uint256 fairResA, uint256 fairResB) = _computeFairReserves(
      _getNormalizedBalance(tokens[0], balances[0]),
      _getNormalizedBalance(tokens[1], balances[1]),
      normalizedWeights[0],
      normalizedWeights[1],
      pxA,
      pxB
    );

    answer = int256(fairResA.mul(pxA).add(fairResB.mul(pxB)).div(pool.totalSupply()));
    updatedAt = assetUpdatedAtA;

    // use oldest timestamp for updatedAt
    if (assetUpdatedAtA > assetUpdatedAtB) {
      updatedAt = assetUpdatedAtB;
    }
  }

  function _getNormalizedBalance(address token, uint256 balance) internal view returns (uint256) {
    uint8 decimals = ERC20(token).decimals();
    return balance.mul(MathPow.pow(10, 18 - decimals));
  }

  /// @dev Return fair reserve amounts given spot reserves, weights, and fair prices.
  /// @param resA Reserve of the first asset
  /// @param resB Reserve of the second asset
  /// @param wA Weight of the first asset
  /// @param wB Weight of the second asset
  /// @param pxA Fair price of the first asset
  /// @param pxB Fair price of the second asset
  function _computeFairReserves(
    uint256 resA,
    uint256 resB,
    uint256 wA,
    uint256 wB,
    uint256 pxA,
    uint256 pxB
  ) internal pure returns (uint256 fairResA, uint256 fairResB) {
    // NOTE: wA + wB = 1 (normalize weights)
    // constant product = resA^wA * resB^wB
    // constraints:
    // - fairResA^wA * fairResB^wB = constant product
    // - fairResA * pxA / wA = fairResB * pxB / wB
    // Solving equations:
    // --> fairResA^wA * (fairResA * (pxA * wB) / (wA * pxB))^wB = constant product
    // --> fairResA / r1^wB = constant product
    // --> fairResA = resA^wA * resB^wB * r1^wB
    // --> fairResA = resA * (resB/resA)^wB * r1^wB = resA * (r1/r0)^wB
    uint256 r0 = bdiv(resA, resB);
    uint256 r1 = bdiv(bmul(wA, pxB), bmul(wB, pxA));
    // fairResA = resA * (r1 / r0) ^ wB
    // fairResB = resB * (r0 / r1) ^ wA
    if (r0 > r1) {
      uint256 ratio = bdiv(r1, r0);
      fairResA = bmul(resA, bpow(ratio, wB));
      fairResB = bdiv(resB, bpow(ratio, wA));
    } else {
      uint256 ratio = bdiv(r0, r1);
      fairResA = bdiv(resA, bpow(ratio, wB));
      fairResB = bmul(resB, bpow(ratio, wA));
    }
  }
}
