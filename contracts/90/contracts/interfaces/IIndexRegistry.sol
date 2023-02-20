// SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity >=0.8.7;

import "./IIndexFactory.sol";

/// @title Index registry interface
/// @notice Contains core components, addresses and asset market capitalizations
interface IIndexRegistry {
    /// @notice Index logic address
    /// @return Returns index logic address
    function indexLogic() external returns (address);

    /// @notice Registers new index
    /// @param _index Index address
    /// @param _nameDetails Name details (name and symbol) for provided index
    function registerIndex(address _index, IIndexFactory.NameDetails calldata _nameDetails) external;

    /// @notice Maximum assets for an index
    /// @return Returns maximum assets for an index
    function maxComponents() external view returns (uint);

    /// @notice Returns total market capitalization of the given assets
    /// @param _assets Assets array to calculate market capitalization of
    /// @return _marketCaps Corresponding capitalizations of the given asset
    /// @return _totalMarketCap Total market capitalization of the given assets
    function marketCapsOf(address[] calldata _assets)
        external
        view
        returns (uint[] memory _marketCaps, uint _totalMarketCap);

    /// @notice Total market capitalization of all registered assets
    /// @return Returns total market capitalization of all registered assets
    function totalMarketCap() external view returns (uint);

    /// @notice Price oracle address
    /// @return Returns price oracle address
    function priceOracle() external view returns (address);

    /// @notice Orderer address
    /// @return Returns orderer address
    function orderer() external view returns (address);

    /// @notice Fee pool address
    /// @return Returns fee pool address
    function feePool() external view returns (address);
}
