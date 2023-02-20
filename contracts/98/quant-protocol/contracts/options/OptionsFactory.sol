// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.12;

import "../libraries/OptionsUtils.sol";
import "../interfaces/IOptionsFactory.sol";
import "../interfaces/IQuantConfig.sol";
import "../interfaces/IProviderOracleManager.sol";
import "../interfaces/IOracleRegistry.sol";
import "../interfaces/IAssetsRegistry.sol";
import "../interfaces/ICollateralToken.sol";

/// @title Factory contract for Quant options
/// @author Rolla
/// @notice Creates tokens for long (QToken) and short (CollateralToken) positions
/// @dev This contract follows the factory design pattern
contract OptionsFactory is IOptionsFactory {
    /// @inheritdoc IOptionsFactory
    address[] public override qTokens;

    /// @inheritdoc IOptionsFactory
    address public override strikeAsset;

    IQuantConfig public override quantConfig;

    ICollateralToken public override collateralToken;

    mapping(uint256 => address) private _collateralTokenIdToQTokenAddress;

    /// @inheritdoc IOptionsFactory
    mapping(address => uint256)
        public
        override qTokenAddressToCollateralTokenId;

    /// @notice Initializes a new options factory
    /// @param _strikeAsset address of the asset used to denominate strike prices
    /// for options created through this factory
    /// @param _quantConfig the address of the Quant system configuration contract
    /// @param _collateralToken address of the CollateralToken contract
    constructor(
        address _strikeAsset,
        address _quantConfig,
        address _collateralToken
    ) {
        require(
            _strikeAsset != address(0),
            "OptionsFactory: invalid strike asset address"
        );
        require(
            _quantConfig != address(0),
            "OptionsFactory: invalid QuantConfig address"
        );
        require(
            _collateralToken != address(0),
            "OptionsFactory: invalid CollateralToken address"
        );

        strikeAsset = _strikeAsset;
        quantConfig = IQuantConfig(_quantConfig);
        collateralToken = ICollateralToken(_collateralToken);
    }

    /// @inheritdoc IOptionsFactory
    function createOption(
        address _underlyingAsset,
        address _oracle,
        uint256 _strikePrice,
        uint256 _expiryTime,
        bool _isCall
    )
        external
        override
        returns (address newQToken, uint256 newCollateralTokenId)
    {
        OptionsUtils.validateOptionParameters(
            _underlyingAsset,
            _oracle,
            _expiryTime,
            address(quantConfig),
            _strikePrice
        );

        newCollateralTokenId = OptionsUtils.getTargetCollateralTokenId(
            collateralToken,
            address(quantConfig),
            _underlyingAsset,
            strikeAsset,
            _oracle,
            address(0),
            _strikePrice,
            _expiryTime,
            _isCall
        );

        require(
            _collateralTokenIdToQTokenAddress[newCollateralTokenId] ==
                address(0),
            "option already created"
        );

        newQToken = address(
            new QToken{salt: OptionsUtils.SALT}(
                address(quantConfig),
                _underlyingAsset,
                strikeAsset,
                _oracle,
                _strikePrice,
                _expiryTime,
                _isCall
            )
        );

        _collateralTokenIdToQTokenAddress[newCollateralTokenId] = newQToken;
        qTokens.push(newQToken);

        qTokenAddressToCollateralTokenId[newQToken] = newCollateralTokenId;

        emit OptionCreated(
            newQToken,
            msg.sender,
            _underlyingAsset,
            _oracle,
            _strikePrice,
            _expiryTime,
            newCollateralTokenId,
            qTokens.length,
            _isCall
        );

        collateralToken.createCollateralToken(newQToken, address(0));
    }

    /// @inheritdoc IOptionsFactory
    function getTargetCollateralTokenId(
        address _underlyingAsset,
        address _oracle,
        address _qTokenAsCollateral,
        uint256 _strikePrice,
        uint256 _expiryTime,
        bool _isCall
    ) external view override returns (uint256) {
        return
            OptionsUtils.getTargetCollateralTokenId(
                collateralToken,
                address(quantConfig),
                _underlyingAsset,
                strikeAsset,
                _oracle,
                _qTokenAsCollateral,
                _strikePrice,
                _expiryTime,
                _isCall
            );
    }

    /// @inheritdoc IOptionsFactory
    function getTargetQTokenAddress(
        address _underlyingAsset,
        address _oracle,
        uint256 _strikePrice,
        uint256 _expiryTime,
        bool _isCall
    ) external view override returns (address) {
        return
            OptionsUtils.getTargetQTokenAddress(
                address(quantConfig),
                _underlyingAsset,
                strikeAsset,
                _oracle,
                _strikePrice,
                _expiryTime,
                _isCall
            );
    }

    /// @inheritdoc IOptionsFactory
    function getCollateralToken(
        address _underlyingAsset,
        address _oracle,
        address _qTokenAsCollateral,
        uint256 _strikePrice,
        uint256 _expiryTime,
        bool _isCall
    ) external view override returns (uint256) {
        address qToken = getQToken(
            _underlyingAsset,
            _oracle,
            _strikePrice,
            _expiryTime,
            _isCall
        );

        uint256 id = collateralToken.getCollateralTokenId(
            qToken,
            _qTokenAsCollateral
        );

        (address storedQToken, ) = collateralToken.idToInfo(id);
        return storedQToken != address(0) ? id : 0;
    }

    /// @inheritdoc IOptionsFactory
    function getOptionsLength() external view override returns (uint256) {
        return qTokens.length;
    }

    /// @inheritdoc IOptionsFactory
    function isQToken(address _qToken) external view override returns (bool) {
        return qTokenAddressToCollateralTokenId[_qToken] != 0;
    }

    /// @inheritdoc IOptionsFactory
    function getQToken(
        address _underlyingAsset,
        address _oracle,
        uint256 _strikePrice,
        uint256 _expiryTime,
        bool _isCall
    ) public view override returns (address) {
        uint256 collateralTokenId = OptionsUtils.getTargetCollateralTokenId(
            collateralToken,
            address(quantConfig),
            _underlyingAsset,
            strikeAsset,
            _oracle,
            address(0),
            _strikePrice,
            _expiryTime,
            _isCall
        );

        return _collateralTokenIdToQTokenAddress[collateralTokenId];
    }
}
