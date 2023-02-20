// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "../../utils/access/AccessControl.sol";
import "../../interfaces/vault/IOracle.sol";
import "../../math/CastBytes32Bytes6.sol";
import "./CTokenInterface.sol";


contract CompoundMultiOracle is IOracle, AccessControl {
    using CastBytes32Bytes6 for bytes32;

    event SourceSet(bytes6 indexed baseId, bytes6 indexed kind, address indexed source);

    uint public constant SCALE_FACTOR = 1; // I think we don't need scaling for rate and chi oracles

    mapping(bytes6 => mapping(bytes6 => address)) public sources;

    /**
     * @notice Set or reset one source
     */
    function setSource(bytes6 base, bytes6 kind, address source) public auth {
        sources[base][kind] = source;
        emit SourceSet(base, kind, source);
    }

    /**
     * @notice Set or reset an oracle source
     */
    function setSources(bytes6[] memory bases, bytes6[] memory kinds, address[] memory sources_) public auth {
        require(bases.length == kinds.length && kinds.length == sources_.length, "Mismatched inputs");
        for (uint256 i = 0; i < bases.length; i++)
            setSource(bases[i], kinds[i], sources_[i]);
    }

    /**
     * @notice Retrieve the latest price of a given source.
     * @return price
     */
    function _peek(bytes6 base, bytes6 kind) private view returns (uint price, uint updateTime) {
        uint256 rawPrice;
        address source = sources[base][kind];
        require (source != address(0), "Source not found");

        if (kind == "rate") rawPrice = CTokenInterface(source).borrowIndex();
        else if (kind == "chi") rawPrice = CTokenInterface(source).exchangeRateStored();
        else revert("Unknown oracle type");

        require(rawPrice > 0, "Compound price is zero");

        price = rawPrice * SCALE_FACTOR;
        updateTime = block.timestamp;
    }

    /**
     * @notice Retrieve the value of the amount at the latest oracle price.
     * @return value
     */
    function peek(bytes32 base, bytes32 kind, uint256 amount) public virtual override view returns (uint256 value, uint256 updateTime) {
        uint256 price;
        (price, updateTime) = _peek(base.b6(), kind.b6());
        value = price * amount / 1e18;
    }

    /**
     * @notice Retrieve the value of the amount at the latest oracle price. Same as `peek` for this oracle.
     * @return value
     */
    function get(bytes32 base, bytes32 kind, uint256 amount) public virtual override view returns (uint256 value, uint256 updateTime) {
        uint256 price;
        (price, updateTime) = _peek(base.b6(), kind.b6());
        value = price * amount / 1e18;
    }
}