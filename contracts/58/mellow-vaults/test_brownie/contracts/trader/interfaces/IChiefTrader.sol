// SPDX-License-Identifier: BSL-1.1
pragma solidity =0.8.9;

import "../../interfaces/IProtocolGovernance.sol";

interface IChiefTrader {
    /// @notice ProtocolGovernance
    /// @return the address of the protocol governance contract
    function protocolGovernance() external view returns (address);

    /// @notice Count of traders
    function tradersCount() external view returns (uint256);

    /// @notice Get the address of the trader at index
    /// @param _index The index of the trader
    function getTrader(uint256 _index) external view returns (address);

    /// @notice Get all registered traders
    function traders() external view returns (address[] memory);

    /// @notice Add new trader
    /// @param traderAddress the address of the trader
    function addTrader(address traderAddress) external;
}
