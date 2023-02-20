// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.1;

import "../../utils/access/AccessControl.sol";
import "../../interfaces/vault/IOracle.sol";
import "../../constants/Constants.sol";
import "../../math/CastBytes32Bytes6.sol";
import "./CTokenInterface.sol";


contract CTokenMultiOracle is IOracle, AccessControl, Constants {
    using CastBytes32Bytes6 for bytes32;

    uint8 public constant override decimals = 18;   // All prices are converted to 18 decimals

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
    function setSource(bytes6 cTokenId, bytes6 underlying, address cToken) external auth {
        _setSource(cTokenId, underlying, cToken);
    }

    /**
     * @notice Set or reset a number of oracle sources and their inverses
     */
    function setSources(bytes6[] memory cTokenIds, bytes6[] memory underlyings, address[] memory cTokens) external auth {
        require(
            cTokenIds.length == underlyings.length && 
            cTokenIds.length == cTokens.length,
            "Mismatched inputs"
        );
        for (uint256 i = 0; i < cTokenIds.length; i++) {
            _setSource(cTokenIds[i], underlyings[i], cTokens[i]);
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
        uint256 price;
        (price, updateTime) = _peek(base.b6(), quote.b6());
        value = price * amount / 1e18;
    }

    /**
     * @notice Retrieve the value of the amount at the latest oracle price.
     * @return value
     */
    function get(bytes32 base, bytes32 quote, uint256 amount)
        external virtual override
        returns (uint256 value, uint256 updateTime)
    {
        uint256 price;
        (price, updateTime) = _get(base.b6(), quote.b6());
        value = price * amount / 1e18;
    }

    function _peek(bytes6 base, bytes6 quote) private view returns (uint price, uint updateTime) {
        uint256 rawPrice;
        Source memory source = sources[base][quote];
        require (source.source != address(0), "Source not found");

        rawPrice = CTokenInterface(source.source).exchangeRateStored();

        require(rawPrice > 0, "Compound price is zero");

        if (source.inverse == true) {
            price = 10 ** (source.decimals + 18) / uint(rawPrice);
        } else {
            price = uint(rawPrice) * 10 ** (18 - source.decimals);
        }

        updateTime = block.timestamp; // We should get the timestamp
    }

    function _get(bytes6 base, bytes6 quote) private returns (uint price, uint updateTime) {
        uint256 rawPrice;
        Source memory source = sources[base][quote];
        require (source.source != address(0), "Source not found");

        rawPrice = CTokenInterface(source.source).exchangeRateCurrent();

        require(rawPrice > 0, "Compound price is zero");

        if (source.inverse == true) {
            price = 10 ** (source.decimals + 18) / uint(rawPrice);
        } else {
            price = uint(rawPrice) * 10 ** (18 - source.decimals);
        }

        updateTime = block.timestamp; // We should get the timestamp
    }

    function _setSource(bytes6 cTokenId, bytes6 underlying, address source) internal {
        uint8 decimals_ = 18; // Does the borrowing rate have 18 decimals?
        require (decimals_ <= 18, "Unsupported decimals");
        sources[cTokenId][underlying] = Source({
            source: source,
            decimals: decimals_,
            inverse: false
        });
        sources[underlying][cTokenId] = Source({
            source: source,
            decimals: decimals_,
            inverse: true
        });
        emit SourceSet(cTokenId, underlying, source);
        emit SourceSet(underlying, cTokenId, source);
    }
}