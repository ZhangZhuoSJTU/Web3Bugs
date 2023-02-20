// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.1;

import "../../utils/access/AccessControl.sol";
import "../../interfaces/vault/IOracle.sol";
import "../../math/CastBytes32Bytes6.sol";


/**
 * @title CompositeMultiOracle
 */
contract CompositeMultiOracle is IOracle, AccessControl {
    using CastBytes32Bytes6 for bytes32;

    uint8 public constant override decimals = 18;   // All prices are converted to 18 decimals

    event SourceSet(bytes6 indexed baseId, bytes6 indexed quoteId, address indexed source);
    event PathSet(bytes6 indexed baseId, bytes6 indexed quoteId, bytes6[] indexed path);

    struct Source {
        address source;
        uint8 decimals;
    }

    mapping(bytes6 => mapping(bytes6 => Source)) public sources;
    mapping(bytes6 => mapping(bytes6 => bytes6[])) public paths;

    /**
     * @notice Set or reset an oracle source
     */
    function setSource(bytes6 base, bytes6 quote, address source) external auth {
        _setSource(base, quote, source);
    }

    /**
     * @notice Set or reset a number of oracle sources
     */
    function setSources(bytes6[] memory bases, bytes6[] memory quotes, address[] memory sources_) external auth {
        require(
            bases.length == quotes.length && 
            bases.length == sources_.length,
            "Mismatched inputs"
        );
        for (uint256 i = 0; i < bases.length; i++) {
            _setSource(bases[i], quotes[i], sources_[i]);
        }
    }

    /**
     * @notice Set or reset an price path
     */
    function setPath(bytes6 base, bytes6 quote, bytes6[] memory path) external auth {
        _setPath(base, quote, path);
    }

    /**
     * @notice Set or reset a number of price paths
     */
    function setPaths(bytes6[] memory bases, bytes6[] memory quotes, bytes6[][] memory paths_) external auth {
        require(
            bases.length == quotes.length && 
            bases.length == paths_.length,
            "Mismatched inputs"
        );
        for (uint256 i = 0; i < bases.length; i++) {
            _setPath(bases[i], quotes[i], paths_[i]);
        }
    }

    /**
     * @notice Retrieve the value of the amount at the latest oracle price.
     * @return value
     */
    function peek(bytes32 base, bytes32 quote, uint256 amount)
        external view virtual override
        returns (uint256 value, uint256 updateTime)
    {
        uint256 price = 1e18;
        bytes6 base_ = base.b6();
        bytes6 quote_ = quote.b6();
        bytes6[] memory path = paths[base_][quote_];
        for (uint256 p = 0; p < path.length; p++) {
            (price, updateTime) = _peek(base_, path[p], price, updateTime);
            base_ = path[p];
        }
        (price, updateTime) = _peek(base_, quote_, price, updateTime);
        value = price * amount / 1e18;
    }

    /**
     * @notice Retrieve the value of the amount at the latest oracle price.. Same as `peek` for this oracle.
     * @return value
     */
    function get(bytes32 base, bytes32 quote, uint256 amount)
        external virtual override
        returns (uint256 value, uint256 updateTime)
    {
        uint256 price = 1e18;
        bytes6 base_ = base.b6();
        bytes6 quote_ = quote.b6();
        bytes6[] memory path = paths[base_][quote_];
        for (uint256 p = 0; p < path.length; p++) {
            (price, updateTime) = _get(base_, path[p], price, updateTime);
            base_ = path[p];
        }
        (price, updateTime) = _get(base_, quote_, price, updateTime);
        value = price * amount / 1e18;
    }

    function _peek(bytes6 base, bytes6 quote, uint256 priceIn, uint256 updateTimeIn)
        private view returns (uint priceOut, uint updateTimeOut)
    {
        Source memory source = sources[base][quote];
        require (source.source != address(0), "Source not found");
        (priceOut, updateTimeOut) = IOracle(source.source).peek(base, quote, 10 ** source.decimals);   // Get price for one unit
        priceOut = priceIn * priceOut / (10 ** source.decimals);                                       // Fixed point according to decimals
        updateTimeOut = (updateTimeOut < updateTimeIn) ? updateTimeOut : updateTimeIn;                 // Take the oldest update time
    }

    function _get(bytes6 base, bytes6 quote, uint256 priceIn, uint256 updateTimeIn)
        private returns (uint priceOut, uint updateTimeOut)
    {
        Source memory source = sources[base][quote];
        require (source.source != address(0), "Source not found");
        (priceOut, updateTimeOut) = IOracle(source.source).get(base, quote, 10 ** source.decimals);    // Get price for one unit
        priceOut = priceIn * priceOut / (10 ** source.decimals);                                       // Fixed point according to decimals
        updateTimeOut = (updateTimeOut < updateTimeIn) ? updateTimeOut : updateTimeIn;                 // Take the oldest update time
    }

    function _setSource(bytes6 base, bytes6 quote, address source) internal {
        uint8 decimals_ = IOracle(source).decimals();
        require (decimals_ <= 18, "Unsupported decimals");
        sources[base][quote] = Source({
            source: source,
            decimals: decimals_
        });
        emit SourceSet(base, quote, source);
    }

    function _setPath(bytes6 base, bytes6 quote, bytes6[] memory path) internal {
        bytes6 base_ = base;
        for (uint256 p = 0; p < path.length; p++) {
            require (sources[base_][path[p]].source != address(0), "Source not found");
            base_ = path[p];
        }
        paths[base][quote] = path;
        emit PathSet(base, quote, path);
    }
}
