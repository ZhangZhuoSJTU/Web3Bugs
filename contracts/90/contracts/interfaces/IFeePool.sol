// SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity >=0.8.7;

/// @title Fee pool interface
/// @notice Provides methods for fee management
interface IFeePool {
    /// @notice Minting fee in base point format
    /// @return Returns minting fee in base point (BP) format
    function mintingFeeInBPOf(address _index) external view returns (uint16);

    /// @notice Burning fee in base point format
    /// @return Returns burning fee in base point (BP) format
    function burningFeeInBPOf(address _index) external view returns (uint16);

    /// @notice AUM scaled per seconds rate
    /// @return Returns AUM scaled per seconds rate
    function AUMScaledPerSecondsRateOf(address _index) external view returns (uint);
}
