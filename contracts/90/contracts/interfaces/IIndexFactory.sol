// SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity >=0.8.7;

/// @title Index factory interface
/// @notice Contains logic for initial fee management for indexes which will be created by this factory
interface IIndexFactory {
    struct NameDetails {
        string name;
        string symbol;
    }

    /// @notice Index registry address
    /// @return Returns index registry address
    function registry() external view returns (address);

    /// @notice vTokenFactory address
    /// @return Returns vTokenFactory address
    function vTokenFactory() external view returns (address);

    /// @notice Reweighting logic address
    /// @return Returns reweighting logic address
    function reweightingLogic() external view returns (address);
}
