// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;
import "../../interfaces/vault/IOracle.sol";


/// @dev An oracle that allows to set the spot price to anyone. It also allows to record spot values and return the accrual between a recorded and current spots.
contract OracleMock is IOracle {

    address public immutable source;

    uint256 public spot;
    uint256 public updated;

    constructor() {
        source = address(this);
    }

    /// @dev Return the value of the amount at the spot price.
    function peek(bytes32, bytes32, uint256 amount) external view virtual override returns (uint256, uint256) {
        return (spot * amount / 1e18, updated);
    }

    /// @dev Return the value of the amount at the spot price.
    function get(bytes32, bytes32, uint256 amount) external virtual override returns (uint256, uint256) {
        updated = block.timestamp;
        return (spot * amount / 1e18, updated = block.timestamp);
    }

    /// @dev Set the spot price with 18 decimals. Overriding contracts with different formats must convert from 18 decimals.
    function set(uint256 spot_) external virtual {
        updated = block.timestamp;
        spot = spot_;
    }
}