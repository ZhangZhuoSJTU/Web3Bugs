// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

interface IAssetsRegistry {
    /// @notice emitted when a new asset is added to the registry
    /// @param underlying address of the asset
    /// @param name name of the asset
    /// @param symbol symbol of the asset
    /// @param decimals the amount of decimals the asset has
    event AssetAdded(
        address indexed underlying,
        string name,
        string symbol,
        uint8 decimals
    );

    /// @notice Add a new asset to the registry
    /// @dev It will revert when trying to add an asset with the same address twice
    /// @dev Can only be called by addresses with the ASSETS_REGISTRY_MANAGER_ROLE role
    /// @param _underlying address of the asset
    /// @param _name name of the asset
    /// @param _symbol symbol of the asset
    /// @param _decimals the amount of decimals the asset has
    function addAsset(
        address _underlying,
        string calldata _name,
        string calldata _symbol,
        uint8 _decimals
    ) external;

    /// @notice Add a new asset to the registry, calling the optional ERC20 methods
    /// to get its name, symbol and decimals
    /// @param _underlying address of the asset
    function addAssetWithOptionalERC20Methods(address _underlying) external;

    /// @notice Returns the name, symbol and decimals of an asset that's already in the registry
    /// @dev Will return empty strings and zero for non-existent assets
    /// @return name asset's name
    /// @return symbol asset's symbol
    /// @return decimals asset's decimals
    function assetProperties(address asset)
        external
        view
        returns (
            string memory name,
            string memory symbol,
            uint8 decimals
        );

    /// @notice Returns the address of the asset at the given index
    /// @param index index of the asset in the registry
    /// @return asset address of the asset at the given index
    function registeredAssets(uint256 index)
        external
        view
        returns (address asset);

    /// @notice Returns the number of assets in the registry
    /// @return length number of assets in the registry
    function getAssetsLength() external view returns (uint256 length);
}
