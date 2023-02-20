// SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity >=0.8.7;

/// @title Index layout interface
/// @notice Contains storage layout of index
interface IIndexLayout {
    /// @notice Index factory address
    /// @return Returns index factory address
    function factory() external view returns (address);

    /// @notice vTokenFactory address
    /// @return Returns vTokenFactory address
    function vTokenFactory() external view returns (address);

    /// @notice Registry address
    /// @return Returns registry address
    function registry() external view returns (address);
}
