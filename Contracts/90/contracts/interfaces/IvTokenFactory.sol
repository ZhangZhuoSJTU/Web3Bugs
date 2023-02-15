// SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity >=0.8.7;

/// @title vToken factory interface
/// @notice Contains vToken creation logic
interface IvTokenFactory {
    /// @notice Creates or returns address of previously created vToken for the given asset
    /// @param _asset Asset to create or return vToken for
    function createOrReturnVTokenOf(address _asset) external returns (address);

    /// @notice Returns vToken for the given asset
    /// @param _asset Asset to retrieve vToken for
    /// @return vToken for the given asset
    function vTokenOf(address _asset) external view returns (address);
}
