// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.12;

import "./interfaces/IQuantCalculator.sol";
import "./interfaces/IOptionsFactory.sol";
import "./interfaces/IQToken.sol";
import "./interfaces/IPriceRegistry.sol";
import "./libraries/FundsCalculator.sol";
import "./libraries/OptionsUtils.sol";
import "./libraries/QuantMath.sol";

/// @title For calculating collateral requirements and payouts for options and spreads
/// @author Rolla
/// @dev Uses fixed point arithmetic from the QuantMath library.
contract QuantCalculator is IQuantCalculator {
    using QuantMath for uint256;
    using QuantMath for int256;
    using QuantMath for QuantMath.FixedPointInt;

    /// @inheritdoc IQuantCalculator
    uint8 public constant override OPTIONS_DECIMALS = 18;

    /// @inheritdoc IQuantCalculator
    uint8 public immutable override strikeAssetDecimals;

    /// @inheritdoc IQuantCalculator
    address public immutable override optionsFactory;

    /// @notice Checks that the QToken was created through the configured OptionsFactory
    modifier validQToken(address _qToken) {
        require(
            IOptionsFactory(optionsFactory).isQToken(_qToken),
            "QuantCalculator: Invalid QToken address"
        );

        _;
    }

    /// @notice Checks that the QToken used as collateral for a spread is either the zero address
    /// or a QToken created through the configured OptionsFactory
    modifier validQTokenAsCollateral(address _qTokenAsCollateral) {
        if (_qTokenAsCollateral != address(0)) {
            // it could be the zero address for the qTokenAsCollateral for non-spreads
            require(
                IOptionsFactory(optionsFactory).isQToken(_qTokenAsCollateral),
                "QuantCalculator: Invalid QToken address"
            );
        }

        _;
    }

    /// @param _strikeAssetDecimals the number of decimals used to denominate strike prices
    /// @param _optionsFactory the address of the OptionsFactory contract
    constructor(uint8 _strikeAssetDecimals, address _optionsFactory) {
        strikeAssetDecimals = _strikeAssetDecimals;
        optionsFactory = _optionsFactory;
    }

    /// @inheritdoc IQuantCalculator
    function calculateClaimableCollateral(
        uint256 _collateralTokenId,
        uint256 _amount,
        address _msgSender
    )
        external
        view
        override
        returns (
            uint256 returnableCollateral,
            address collateralAsset,
            uint256 amountToClaim
        )
    {
        ICollateralToken collateralToken = IOptionsFactory(optionsFactory)
            .collateralToken();

        (address _qTokenShort, address qTokenAsCollateral) = collateralToken
            .idToInfo(_collateralTokenId);

        require(
            _qTokenShort != address(0),
            "Can not claim collateral from non-existing option"
        );

        IQToken qTokenShort = IQToken(_qTokenShort);

        require(
            block.timestamp > qTokenShort.expiryTime(),
            "Can not claim collateral from options before their expiry"
        );
        require(
            qTokenShort.getOptionPriceStatus() == PriceStatus.SETTLED,
            "Can not claim collateral before option is settled"
        );

        amountToClaim = _amount == 0
            ? collateralToken.balanceOf(_msgSender, _collateralTokenId)
            : _amount;

        IQuantConfig quantConfig = IOptionsFactory(optionsFactory)
            .quantConfig();

        IPriceRegistry priceRegistry = IPriceRegistry(
            quantConfig.protocolAddresses(ProtocolValue.encode("priceRegistry"))
        );

        IPriceRegistry.PriceWithDecimals memory expiryPrice = priceRegistry
            .getSettlementPriceWithDecimals(
                qTokenShort.oracle(),
                qTokenShort.underlyingAsset(),
                qTokenShort.expiryTime()
            );

        address qTokenLong;
        QuantMath.FixedPointInt memory payoutFromLong;

        if (qTokenAsCollateral != address(0)) {
            qTokenLong = qTokenAsCollateral;

            (, payoutFromLong) = FundsCalculator.getPayout(
                qTokenLong,
                amountToClaim,
                OPTIONS_DECIMALS,
                strikeAssetDecimals,
                expiryPrice
            );
        } else {
            qTokenLong = address(0);
            payoutFromLong = int256(0).fromUnscaledInt();
        }

        uint8 payoutDecimals = OptionsUtils.getPayoutDecimals(
            strikeAssetDecimals,
            qTokenShort,
            quantConfig
        );

        QuantMath.FixedPointInt memory collateralRequirement;
        (collateralAsset, collateralRequirement) = FundsCalculator
            .getCollateralRequirement(
                _qTokenShort,
                qTokenLong,
                amountToClaim,
                OPTIONS_DECIMALS,
                payoutDecimals,
                strikeAssetDecimals
            );

        (, QuantMath.FixedPointInt memory payoutFromShort) = FundsCalculator
            .getPayout(
                _qTokenShort,
                amountToClaim,
                OPTIONS_DECIMALS,
                strikeAssetDecimals,
                expiryPrice
            );

        returnableCollateral = payoutFromLong
            .add(collateralRequirement)
            .sub(payoutFromShort)
            .toScaledUint(payoutDecimals, true);
    }

    /// @inheritdoc IQuantCalculator
    function getNeutralizationPayout(
        address _qTokenShort,
        address _qTokenLong,
        uint256 _amountToNeutralize
    )
        external
        view
        override
        returns (address collateralType, uint256 collateralOwed)
    {
        uint8 payoutDecimals = OptionsUtils.getPayoutDecimals(
            strikeAssetDecimals,
            IQToken(_qTokenShort),
            IOptionsFactory(optionsFactory).quantConfig()
        );

        QuantMath.FixedPointInt memory collateralOwedFP;
        (collateralType, collateralOwedFP) = FundsCalculator
            .getCollateralRequirement(
                _qTokenShort,
                _qTokenLong,
                _amountToNeutralize,
                OPTIONS_DECIMALS,
                payoutDecimals,
                strikeAssetDecimals
            );

        collateralOwed = collateralOwedFP.toScaledUint(payoutDecimals, true);
    }

    /// @inheritdoc IQuantCalculator
    function getCollateralRequirement(
        address _qTokenToMint,
        address _qTokenForCollateral,
        uint256 _amount
    )
        external
        view
        override
        validQToken(_qTokenToMint)
        validQTokenAsCollateral(_qTokenForCollateral)
        returns (address collateral, uint256 collateralAmount)
    {
        QuantMath.FixedPointInt memory collateralAmountFP;
        uint8 payoutDecimals = OptionsUtils.getPayoutDecimals(
            strikeAssetDecimals,
            IQToken(_qTokenToMint),
            IOptionsFactory(optionsFactory).quantConfig()
        );

        (collateral, collateralAmountFP) = FundsCalculator
            .getCollateralRequirement(
                _qTokenToMint,
                _qTokenForCollateral,
                _amount,
                OPTIONS_DECIMALS,
                payoutDecimals,
                strikeAssetDecimals
            );

        collateralAmount = collateralAmountFP.toScaledUint(
            payoutDecimals,
            false
        );
    }

    /// @inheritdoc IQuantCalculator
    function getExercisePayout(address _qToken, uint256 _amount)
        external
        view
        override
        validQToken(_qToken)
        returns (
            bool isSettled,
            address payoutToken,
            uint256 payoutAmount
        )
    {
        IQToken qToken = IQToken(_qToken);
        isSettled = qToken.getOptionPriceStatus() == PriceStatus.SETTLED;
        if (!isSettled) {
            return (false, address(0), 0);
        } else {
            isSettled = true;
        }

        QuantMath.FixedPointInt memory payout;

        IQuantConfig quantConfig = IOptionsFactory(optionsFactory)
            .quantConfig();

        IPriceRegistry priceRegistry = IPriceRegistry(
            quantConfig.protocolAddresses(ProtocolValue.encode("priceRegistry"))
        );

        uint8 payoutDecimals = OptionsUtils.getPayoutDecimals(
            strikeAssetDecimals,
            qToken,
            quantConfig
        );

        address underlyingAsset = qToken.underlyingAsset();

        IPriceRegistry.PriceWithDecimals memory expiryPrice = priceRegistry
            .getSettlementPriceWithDecimals(
                qToken.oracle(),
                underlyingAsset,
                qToken.expiryTime()
            );

        (payoutToken, payout) = FundsCalculator.getPayout(
            _qToken,
            _amount,
            OPTIONS_DECIMALS,
            strikeAssetDecimals,
            expiryPrice
        );

        payoutAmount = payout.toScaledUint(payoutDecimals, true);
    }
}
