// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.12;

import "@openzeppelin/contracts/utils/Create2.sol";
import "./ProtocolValue.sol";
import "../options/QToken.sol";
import "../interfaces/ICollateralToken.sol";
import "../interfaces/IOracleRegistry.sol";
import "../interfaces/IProviderOracleManager.sol";
import "../interfaces/IQuantConfig.sol";
import "../interfaces/IQToken.sol";
import "../interfaces/IAssetsRegistry.sol";

/// @title Options utilities for Quant's QToken and CollateralToken
/// @author Rolla
/// @dev This library must be deployed and linked while deploying contracts that use it
library OptionsUtils {
    /// @notice constant salt because options will only be deployed with the same parameters once
    bytes32 public constant SALT = bytes32("ROLLA.FINANCE");

    /// @notice get the address at which a new QToken with the given parameters would be deployed
    /// @notice return the exact address the QToken will be deployed at with OpenZeppelin's Create2
    /// library computeAddress function
    /// @param _underlyingAsset asset that the option references
    /// @param _strikeAsset asset that the strike is denominated in
    /// @param _oracle price oracle for the option underlying
    /// @param _strikePrice strike price with as many decimals in the strike asset
    /// @param _expiryTime expiration timestamp as a unix timestamp
    /// @param _isCall true if it's a call option, false if it's a put option
    /// @return the address where a QToken would be deployed
    function getTargetQTokenAddress(
        address _quantConfig,
        address _underlyingAsset,
        address _strikeAsset,
        address _oracle,
        uint256 _strikePrice,
        uint256 _expiryTime,
        bool _isCall
    ) internal view returns (address) {
        bytes32 bytecodeHash = keccak256(
            abi.encodePacked(
                type(QToken).creationCode,
                abi.encode(
                    _quantConfig,
                    _underlyingAsset,
                    _strikeAsset,
                    _oracle,
                    _strikePrice,
                    _expiryTime,
                    _isCall
                )
            )
        );

        return Create2.computeAddress(SALT, bytecodeHash);
    }

    /// @notice get the id that a CollateralToken with the given parameters would have
    /// @param _underlyingAsset asset that the option references
    /// @param _strikeAsset asset that the strike is denominated in
    /// @param _oracle price oracle for the option underlying
    /// @param _strikePrice strike price with as many decimals in the strike asset
    /// @param _expiryTime expiration timestamp as a unix timestamp
    /// @param _qTokenAsCollateral initial spread collateral
    /// @param _isCall true if it's a call option, false if it's a put option
    /// @return the id that a CollateralToken would have
    function getTargetCollateralTokenId(
        ICollateralToken _collateralToken,
        address _quantConfig,
        address _underlyingAsset,
        address _strikeAsset,
        address _oracle,
        address _qTokenAsCollateral,
        uint256 _strikePrice,
        uint256 _expiryTime,
        bool _isCall
    ) internal view returns (uint256) {
        address qToken = getTargetQTokenAddress(
            _quantConfig,
            _underlyingAsset,
            _strikeAsset,
            _oracle,
            _strikePrice,
            _expiryTime,
            _isCall
        );
        return
            _collateralToken.getCollateralTokenId(qToken, _qTokenAsCollateral);
    }

    /// @notice Checks if the given option parameters are valid for creation in the Quant Protocol
    /// @param _underlyingAsset asset that the option is for
    /// @param _oracle price oracle for the option underlying
    /// @param _expiryTime expiration timestamp as a unix timestamp
    /// @param _quantConfig address of the QuantConfig contract
    /// @param _strikePrice strike price with as many decimals in the strike asset
    function validateOptionParameters(
        address _underlyingAsset,
        address _oracle,
        uint256 _expiryTime,
        address _quantConfig,
        uint256 _strikePrice
    ) internal view {
        require(
            _expiryTime > block.timestamp,
            "OptionsFactory: given expiry time is in the past"
        );

        IOracleRegistry oracleRegistry = IOracleRegistry(
            IQuantConfig(_quantConfig).protocolAddresses(
                ProtocolValue.encode("oracleRegistry")
            )
        );

        require(
            oracleRegistry.isOracleRegistered(_oracle),
            "OptionsFactory: Oracle is not registered in OracleRegistry"
        );

        require(
            IProviderOracleManager(_oracle).getAssetOracle(_underlyingAsset) !=
                address(0),
            "OptionsFactory: Asset does not exist in oracle"
        );

        require(
            IProviderOracleManager(_oracle).isValidOption(
                _underlyingAsset,
                _expiryTime,
                _strikePrice
            ),
            "OptionsFactory: Oracle doesn't support the given option"
        );

        require(
            oracleRegistry.isOracleActive(_oracle),
            "OptionsFactory: Oracle is not active in the OracleRegistry"
        );

        require(_strikePrice > 0, "strike can't be 0");

        require(
            isInAssetsRegistry(_underlyingAsset, _quantConfig),
            "underlying not in the registry"
        );
    }

    /// @notice Checks if a given asset is in the AssetsRegistry configured in the QuantConfig
    /// @param _asset address of the asset to check
    /// @param _quantConfig address of the QuantConfig contract
    /// @return whether the asset is in the configured registry
    function isInAssetsRegistry(address _asset, address _quantConfig)
        internal
        view
        returns (bool)
    {
        string memory symbol;
        (, symbol, ) = IAssetsRegistry(
            IQuantConfig(_quantConfig).protocolAddresses(
                ProtocolValue.encode("assetsRegistry")
            )
        ).assetProperties(_asset);

        return bytes(symbol).length != 0;
    }

    /// @notice Gets the amount of decimals for an option exercise payout
    /// @param _strikeAssetDecimals decimals of the strike asset
    /// @param _qToken address of the option's QToken contract
    /// @param _quantConfig address of the QuantConfig contract
    /// @return payoutDecimals amount of decimals for the option exercise payout
    function getPayoutDecimals(
        uint8 _strikeAssetDecimals,
        IQToken _qToken,
        IQuantConfig _quantConfig
    ) internal view returns (uint8 payoutDecimals) {
        IAssetsRegistry assetsRegistry = IAssetsRegistry(
            _quantConfig.protocolAddresses(
                ProtocolValue.encode("assetsRegistry")
            )
        );

        if (_qToken.isCall()) {
            (, , payoutDecimals) = assetsRegistry.assetProperties(
                _qToken.underlyingAsset()
            );
        } else {
            payoutDecimals = _strikeAssetDecimals;
        }
    }

    /// @notice Gets the option details for a given QToken
    /// @param _qToken QToken to get the info for
    /// @return qTokenInfo struct containing all the QToken details
    function getQTokenInfo(address _qToken)
        internal
        view
        returns (IQToken.QTokenInfo memory qTokenInfo)
    {
        IQToken qToken = IQToken(_qToken);

        qTokenInfo = IQToken.QTokenInfo(
            qToken.underlyingAsset(),
            qToken.strikeAsset(),
            qToken.oracle(),
            qToken.strikePrice(),
            qToken.expiryTime(),
            qToken.isCall()
        );
    }
}
