// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.12;

/// @title Library for QuantConfig's protocol values
/// @author Rolla
library ProtocolValue {
    enum Type {
        Address,
        Uint256,
        Bool,
        Role
    }

    /// @notice Gets the bytes32 encoded representation of a protocol value name
    /// @param _protocolValue the name of the protocol value
    /// @return the encoded bytes32 representation of the protocol value name
    function encode(string memory _protocolValue)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(_protocolValue));
    }
}
