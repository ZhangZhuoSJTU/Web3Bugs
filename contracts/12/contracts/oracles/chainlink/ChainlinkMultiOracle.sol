// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "../../utils/access/AccessControl.sol";
import "../../interfaces/vault/IOracle.sol";
import "../../math/CastBytes32Bytes6.sol";
import "./AggregatorV3Interface.sol";


/**
 * @title ChainlinkMultiOracle
 */
contract ChainlinkMultiOracle is IOracle, AccessControl {
    using CastBytes32Bytes6 for bytes32;

    event SourceSet(bytes6 indexed baseId, bytes6 indexed quoteId, address indexed source);

    struct Source {
        address source;
        uint8 decimals;
        bool inverse;
    }

    mapping(bytes6 => mapping(bytes6 => Source)) public sources;

    /**
     * @notice Set or reset an oracle source and its inverse
     */
    function setSource(bytes6 base, bytes6 quote, address source) public auth {
        uint8 decimals = AggregatorV3Interface(source).decimals();
        require (decimals <= 18, "Unsupported decimals");
        sources[base][quote] = Source({
            source: source,
            decimals: decimals,
            inverse: false
        });
        sources[quote][base] = Source({
            source: source,
            decimals: decimals,
            inverse: true
        });
        emit SourceSet(base, quote, source);
        emit SourceSet(quote, base, source);
    }

    /**
     * @notice Set or reset a number of oracle sources and their inverses
     */
    function setSources(bytes6[] memory bases, bytes6[] memory quotes, address[] memory sources_) public auth {
        require(
            bases.length == quotes.length && 
            bases.length == sources_.length,
            "Mismatched inputs"
        );
        for (uint256 i = 0; i < bases.length; i++) {
            setSource(bases[i], quotes[i], sources_[i]);
        }
    }

    /**
     * @notice Retrieve the latest price of the price oracle.
     * @return price
     */
    function _peek(bytes6 base, bytes6 quote) private view returns (uint price, uint updateTime) {
        int rawPrice;
        uint80 roundId;
        uint80 answeredInRound;
        Source memory source = sources[base][quote];
        require (source.source != address(0), "Source not found");
        (roundId, rawPrice,, updateTime, answeredInRound) = AggregatorV3Interface(source.source).latestRoundData();
        require(rawPrice > 0, "Chainlink price <= 0");
        require(updateTime != 0, "Incomplete round");
        require(answeredInRound >= roundId, "Stale price");
        if (source.inverse == true) {
            price = 10 ** (source.decimals + 18) / uint(rawPrice);
        } else {
            price = uint(rawPrice) * 10 ** (18 - source.decimals);
        }  
    }

    /**
     * @notice Retrieve the value of the amount at the latest oracle price.
     * @return value
     */
    function peek(bytes32 base, bytes32 quote, uint256 amount) public virtual override view returns (uint256 value, uint256 updateTime) {
        uint256 price;
        (price, updateTime) = _peek(base.b6(), quote.b6());
        value = price * amount / 1e18;
    }

    /**
     * @notice Retrieve the value of the amount at the latest oracle price.. Same as `peek` for this oracle.
     * @return value
     */
    function get(bytes32 base, bytes32 quote, uint256 amount) public virtual override view returns (uint256 value, uint256 updateTime) {
        uint256 price;
        (price, updateTime) = _peek(base.b6(), quote.b6());
        value = price * amount / 1e18;
    }
}
