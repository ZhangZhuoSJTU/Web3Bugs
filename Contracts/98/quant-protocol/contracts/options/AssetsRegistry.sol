// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.12;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../interfaces/IQuantConfig.sol";
import "../interfaces/IAssetsRegistry.sol";

/// @title For managing assets supported as underlying for options in the Quant Protocol
/// @author Rolla
contract AssetsRegistry is IAssetsRegistry {
    struct AssetProperties {
        string name;
        string symbol;
        uint8 decimals;
    }

    IQuantConfig private _quantConfig;

    /// @inheritdoc IAssetsRegistry
    mapping(address => AssetProperties) public override assetProperties;

    /// @inheritdoc IAssetsRegistry
    address[] public override registeredAssets;

    /// @dev Checks that the `msg.sender` has permission to add assets to the registry.
    /// @dev Also checks that the asset had not been added before.
    modifier validAsset(address _underlying) {
        require(
            _quantConfig.hasRole(
                _quantConfig.quantRoles("ASSETS_REGISTRY_MANAGER_ROLE"),
                msg.sender
            ),
            "AssetsRegistry: only asset registry managers can add assets"
        );

        require(
            bytes(assetProperties[_underlying].symbol).length == 0,
            "AssetsRegistry: asset already added"
        );

        _;
    }

    /// @param quantConfig_ address of the Quant central configuration contract
    constructor(address quantConfig_) {
        require(
            quantConfig_ != address(0),
            "AssetsRegistry: invalid QuantConfig address"
        );

        _quantConfig = IQuantConfig(quantConfig_);
    }

    /// @inheritdoc IAssetsRegistry
    function addAsset(
        address _underlying,
        string calldata _name,
        string calldata _symbol,
        uint8 _decimals
    ) external override validAsset(_underlying) {
        assetProperties[_underlying] = AssetProperties(
            _name,
            _symbol,
            _decimals
        );

        registeredAssets.push(_underlying);

        emit AssetAdded(_underlying, _name, _symbol, _decimals);
    }

    /// @inheritdoc IAssetsRegistry
    function addAssetWithOptionalERC20Methods(address _underlying)
        external
        override
        validAsset(_underlying)
    {
        string memory name = ERC20(_underlying).name();
        require(bytes(name).length > 0, "AssetsRegistry: invalid empty name");

        string memory symbol = ERC20(_underlying).symbol();
        require(
            bytes(symbol).length > 0,
            "AssetsRegistry: invalid empty symbol"
        );

        uint8 decimals = ERC20(_underlying).decimals();
        require(decimals > 0, "AssetsRegistry: invalid zero decimals");

        assetProperties[_underlying] = AssetProperties(name, symbol, decimals);

        registeredAssets.push(_underlying);

        emit AssetAdded(_underlying, name, symbol, decimals);
    }

    /// @inheritdoc IAssetsRegistry
    function getAssetsLength() external view override returns (uint256) {
        return registeredAssets.length;
    }
}
