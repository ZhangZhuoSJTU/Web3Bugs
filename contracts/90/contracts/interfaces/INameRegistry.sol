// SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity >=0.8.7;

/// @title Name registry interface
/// @notice Providing information about index names and symbols
interface INameRegistry {
    /// @notice Returns name of the given index
    /// @param _index Index address
    /// @return Index name
    function nameOfIndex(address _index) external view returns (string memory);

    /// @notice Returns symbol of the given index
    /// @param _index Index address
    /// @return Index symbol
    function symbolOfIndex(address _index) external view returns (string memory);
}
