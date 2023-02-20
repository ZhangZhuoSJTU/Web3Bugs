// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.12;

import "../../interfaces/IQuantConfig.sol";
import "../../interfaces/IProviderOracleManager.sol";

/// @title Oracle manager for holding asset addresses and their oracle addresses for a single provider
/// @author Rolla
/// @notice Once an oracle is added for an asset it can't be changed!
abstract contract ProviderOracleManager is IProviderOracleManager {
    /// @inheritdoc IProviderOracleManager
    IQuantConfig public override config;

    /// @inheritdoc IProviderOracleManager
    mapping(address => address) public override assetOracles;

    /// @inheritdoc IProviderOracleManager
    address[] public override assets;

    constructor(address _config) {
        config = IQuantConfig(_config);
    }

    /// @inheritdoc IProviderOracleManager
    function addAssetOracle(address _asset, address _oracle) external override {
        require(
            config.hasRole(
                config.quantRoles("ORACLE_MANAGER_ROLE"),
                msg.sender
            ),
            "ProviderOracleManager: Only an oracle admin can add an oracle"
        );
        require(
            assetOracles[_asset] == address(0),
            "ProviderOracleManager: Oracle already set for asset"
        );
        assets.push(_asset);
        assetOracles[_asset] = _oracle;

        emit OracleAdded(_asset, _oracle);
    }

    /// @inheritdoc IProviderOracleManager
    function setExpiryPriceInRegistry(
        address _asset,
        uint256 _expiryTimestamp,
        bytes memory _calldata
    ) external virtual override;

    /// @inheritdoc IProviderOracleManager
    function getAssetsLength() external view override returns (uint256) {
        return assets.length;
    }

    /// @inheritdoc IProviderOracleManager
    function getCurrentPrice(address _asset)
        external
        view
        virtual
        override
        returns (uint256);

    function isValidOption(
        address _underlyingAsset,
        uint256 _expiryTime,
        uint256 _strikePrice
    ) public view virtual override returns (bool);

    /// @inheritdoc IProviderOracleManager
    function getAssetOracle(address _asset)
        public
        view
        override
        returns (address)
    {
        address assetOracle = assetOracles[_asset];
        require(
            assetOracles[_asset] != address(0),
            "ProviderOracleManager: Oracle doesn't exist for that asset"
        );
        return assetOracle;
    }
}
