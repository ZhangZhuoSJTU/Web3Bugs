// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.9;

import "../../libraries/DecimalScale.sol";

interface IChainlinkOracle {
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );

    function decimals() external view returns (uint8);
}

/**
 * Wrapper used for converting a Chainlink ETH Oracle to a USD Oracle.
 */
contract ChainlinkUsdWrapper is IChainlinkOracle {
    using DecimalScale for uint256;

    IChainlinkOracle private immutable _ethOracle =
        IChainlinkOracle(0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419);
    IChainlinkOracle private immutable _oracle;
    uint8 private immutable _decimals;

    constructor(address oracle_) {
        _oracle = IChainlinkOracle(oracle_);
        _decimals = IChainlinkOracle(oracle_).decimals();
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
        (
            uint80 roundId_,
            int256 answer_,
            uint256 startedAt_,
            uint256 updatedAt_,
            uint80 answeredInRound_
        ) = _oracle.latestRoundData();
        return (roundId_, (answer_ * _ethPrice()) / 1e8, startedAt_, updatedAt_, answeredInRound_);
    }

    function decimals() external view override returns (uint8) {
        return _decimals;
    }

    function _ethPrice() private view returns (int256) {
        (, int256 answer, , , ) = _ethOracle.latestRoundData();
        return answer;
    }
}
