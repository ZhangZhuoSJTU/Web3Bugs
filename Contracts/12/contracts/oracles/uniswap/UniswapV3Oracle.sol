// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "../../utils/access/AccessControl.sol";
import "../../interfaces/vault/IOracle.sol";
import "../../math/CastBytes32Bytes6.sol";
import "./IUniswapV3PoolImmutables.sol";
// This for the real deal
// import "@uniswap/v3-periphery/contracts/libraries/OracleLibrary.sol";
import "../../mocks/oracles/uniswap/UniswapV3OracleLibraryMock.sol";

/**
 * @title UniswapV3Oracle
 */
contract UniswapV3Oracle is IOracle, AccessControl {
    using CastBytes32Bytes6 for bytes32;

    event SecondsAgoSet(uint32 indexed secondsAgo);
    event SourceSet(bytes6 indexed base, bytes6 indexed quote, address indexed source);

    struct Source {
        address source;
        bool inverse;
    }

    struct SourceData {
        address factory;
        address baseToken;
        address quoteToken;
        uint24 fee;
    }

    uint32 public secondsAgo;
    mapping(bytes6 => mapping(bytes6 => Source)) public sources;
    mapping(address => SourceData) public sourcesData;

    /**
     * @notice Set or reset the number of seconds Uniswap will use for its Time Weighted Average Price computation
     */
    function setSecondsAgo(uint32 secondsAgo_) public auth {
        require(secondsAgo_ != 0, "Uniswap must look into the past.");
        secondsAgo = secondsAgo_;
        emit SecondsAgoSet(secondsAgo_);
    }

    /**
     * @notice Set or reset an oracle source and its inverse
     */
    function setSource(bytes6 base, bytes6 quote, address source) public auth {
        sources[base][quote] = Source(source, false);
        sources[quote][base] = Source(source, true);
        sourcesData[source] = SourceData(
            IUniswapV3PoolImmutables(source).factory(),
            IUniswapV3PoolImmutables(source).token0(),
            IUniswapV3PoolImmutables(source).token1(),
            IUniswapV3PoolImmutables(source).fee()
        );
        emit SourceSet(base, quote, source);
        emit SourceSet(quote, base, source);
    }

    /**
     * @notice Set or reset a number of oracle sources
     */
    function setSources(bytes6[] memory bases, bytes6[] memory quotes, address[] memory sources_) public auth {
        require(bases.length == quotes.length && quotes.length == sources_.length, "Mismatched inputs");
        for (uint256 i = 0; i < bases.length; i++) {
            setSource(bases[i], quotes[i], sources_[i]);
        }
    }

    /**
     * @notice Retrieve the value of the amount at the latest oracle price.
     * @return value
     */
    function _peek(bytes6 base, bytes6 quote, uint256 amount) public virtual view returns (uint256 value, uint256 updateTime) {
        Source memory source = sources[base][quote];
        SourceData memory sourceData;
        require(source.source != address(0), "Source not found");
        sourceData = sourcesData[source.source];
        if (source.inverse) {
            value = UniswapV3OracleLibraryMock.consult(sourceData.factory, sourceData.quoteToken, sourceData.baseToken, sourceData.fee, amount, secondsAgo);
        } else {
            value = UniswapV3OracleLibraryMock.consult(sourceData.factory, sourceData.baseToken, sourceData.quoteToken, sourceData.fee, amount, secondsAgo);
        }
        updateTime = block.timestamp - secondsAgo;
    }

    /**
     * @notice Retrieve the value of the amount at the latest oracle price.
     * @return value
     */
    function peek(bytes32 base, bytes32 quote, uint256 amount) public virtual override view returns (uint256 value, uint256 updateTime) {
        return _peek(base.b6(), quote.b6(), amount);
    }

    /**
     * @notice Retrieve the value of the amount at the latest oracle price. Same as `peek` for this oracle.
     * @return value
     */
    function get(bytes32 base, bytes32 quote, uint256 amount) public virtual override view returns (uint256 value, uint256 updateTime) {
        return _peek(base.b6(), quote.b6(), amount);
    }
}
