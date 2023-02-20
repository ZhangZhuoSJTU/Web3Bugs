// SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity >=0.8.7;

/// @title Index logic interface
/// @notice Contains mint and burn logic
interface IIndexLogic {
    /// @notice Index minting
    /// @param _recipient Recipient address
    function mint(address _recipient) external;

    /// @notice Index burning
    /// @param _recipient Recipient address
    function burn(address _recipient) external;
}
