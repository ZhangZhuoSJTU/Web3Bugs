// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.12;

import "./QuantMath.sol";
import "../options/QToken.sol";
import "../interfaces/IPriceRegistry.sol";

/// @title For calculating collateral requirements and payouts for options and spreads
/// in a fixed point format
/// @author Rolla
library FundsCalculator {
    using QuantMath for uint256;
    using QuantMath for int256;
    using QuantMath for QuantMath.FixedPointInt;

    struct OptionPayoutInput {
        QuantMath.FixedPointInt strikePrice;
        QuantMath.FixedPointInt expiryPrice;
        QuantMath.FixedPointInt amount;
    }

    /// @notice Calculates payout of an option post-expiry from a qToken address
    /// @param _qToken the address of the qToken (option) which is being exercised
    /// @param _amount the amount of the qToken which is being exercised
    /// @param _optionsDecimals option decimals constant. qTokens have 18 decimals
    /// @param _strikeAssetDecimals the amount of decimals the strike asset has
    /// @param _expiryPrice the expiry price of the option with the amount of decimals
    /// @return payoutToken the address of the payout token
    /// @return payoutAmount the amount to be payed out as a fixed point type
    function getPayout(
        address _qToken,
        uint256 _amount,
        uint8 _optionsDecimals,
        uint8 _strikeAssetDecimals,
        IPriceRegistry.PriceWithDecimals memory _expiryPrice
    )
        internal
        view
        returns (
            address payoutToken,
            QuantMath.FixedPointInt memory payoutAmount
        )
    {
        QToken qToken = QToken(_qToken);
        bool isCall = qToken.isCall();

        payoutToken = isCall ? qToken.underlyingAsset() : qToken.strikeAsset();

        payoutAmount = getPayoutAmount(
            isCall,
            qToken.strikePrice(),
            _amount,
            _optionsDecimals,
            _strikeAssetDecimals,
            _expiryPrice
        );
    }

    /// @notice Calculates the collateral required to mint an option or a spread
    /// @param _qTokenToMint the desired qToken
    /// @param _qTokenForCollateral for spreads, this is the address of the qtoken to be used as collateral.
    /// for options, no collateral is provided so the zero address should be passed.
    /// @param _optionsAmount the amount of options/spread to mint
    /// @param _optionsDecimals option decimals constant. qTokens have 18 decimals
    /// @param _underlyingDecimals the amount of decimals the underlying asset has
    /// @param _strikeAssetDecimals the amount of decimals the strike asset has
    /// @return collateral the address of the collateral token required
    /// @return collateralAmount the collateral amount required as a fixed point type
    function getCollateralRequirement(
        address _qTokenToMint,
        address _qTokenForCollateral,
        uint256 _optionsAmount,
        uint8 _optionsDecimals,
        uint8 _underlyingDecimals,
        uint8 _strikeAssetDecimals
    )
        internal
        view
        returns (
            address collateral,
            QuantMath.FixedPointInt memory collateralAmount
        )
    {
        QToken qTokenToMint = QToken(_qTokenToMint);
        uint256 qTokenToMintStrikePrice = qTokenToMint.strikePrice();

        uint256 qTokenForCollateralStrikePrice;

        // check if we're getting the collateral requirement for a spread
        if (_qTokenForCollateral != address(0)) {
            QToken qTokenForCollateral = QToken(_qTokenForCollateral);
            qTokenForCollateralStrikePrice = qTokenForCollateral.strikePrice();

            // Check that expiries match
            require(
                qTokenToMint.expiryTime() == qTokenForCollateral.expiryTime(),
                "Controller: Can't create spreads from options with different expiries"
            );

            // Check that the underlyings match
            require(
                qTokenToMint.underlyingAsset() ==
                    qTokenForCollateral.underlyingAsset(),
                "Controller: Can't create spreads from options with different underlying assets"
            );

            // Check that the option types match
            require(
                qTokenToMint.isCall() == qTokenForCollateral.isCall(),
                "Controller: Can't create spreads from options with different types"
            );

            // Check that the options have a matching oracle
            require(
                qTokenToMint.oracle() == qTokenForCollateral.oracle(),
                "Controller: Can't create spreads from options with different oracles"
            );
        } else {
            // we're not getting the collateral requirement for a spread
            qTokenForCollateralStrikePrice = 0;
        }

        collateralAmount = getOptionCollateralRequirement(
            qTokenToMintStrikePrice,
            qTokenForCollateralStrikePrice,
            _optionsAmount,
            qTokenToMint.isCall(),
            _optionsDecimals,
            _underlyingDecimals,
            _strikeAssetDecimals
        );

        collateral = qTokenToMint.isCall()
            ? qTokenToMint.underlyingAsset()
            : qTokenToMint.strikeAsset();
    }

    /// @notice Calculates payout of an option post-expiry from qToken attributes
    /// @param _isCall true if the option is a call, false for a put
    /// @param _strikePrice the strike price of the option
    /// @param _amount the amount of options being exercised
    /// @param _optionsDecimals option decimals constant. qTokens have 18 decimals
    /// @param _strikeAssetDecimals the amount of decimals the strike asset has
    /// @param _expiryPrice the expiry price of the option with the amount of decimals
    /// @return payoutAmount the amount to be payed out as a fixed point type
    function getPayoutAmount(
        bool _isCall,
        uint256 _strikePrice,
        uint256 _amount,
        uint8 _optionsDecimals,
        uint8 _strikeAssetDecimals,
        IPriceRegistry.PriceWithDecimals memory _expiryPrice
    ) internal pure returns (QuantMath.FixedPointInt memory payoutAmount) {
        FundsCalculator.OptionPayoutInput memory payoutInput = FundsCalculator
            .OptionPayoutInput(
                _strikePrice.fromScaledUint(_strikeAssetDecimals),
                _expiryPrice.price.fromScaledUint(_expiryPrice.decimals),
                _amount.fromScaledUint(_optionsDecimals)
            );

        if (_isCall) {
            payoutAmount = getPayoutForCall(payoutInput);
        } else {
            payoutAmount = getPayoutForPut(payoutInput);
        }
    }

    /// @notice Calculates payout of a call given option payout inputs of strike, expiry and amount
    /// @param payoutInput strike, expiry and amount as fixed points
    /// @return payoutAmount the amount to be payed out as a fixed point type
    function getPayoutForCall(
        FundsCalculator.OptionPayoutInput memory payoutInput
    ) internal pure returns (QuantMath.FixedPointInt memory payoutAmount) {
        payoutAmount = payoutInput.expiryPrice.isGreaterThan(
            payoutInput.strikePrice
        )
            ? payoutInput
                .expiryPrice
                .sub(payoutInput.strikePrice)
                .mul(payoutInput.amount)
                .div(payoutInput.expiryPrice)
            : int256(0).fromUnscaledInt();
    }

    /// @notice Calculates payout of a put given option payout inputs of strike, expiry and amount
    /// @param payoutInput strike, expiry and amount as fixed points
    /// @return payoutAmount the amount to be payed out as a fixed point type
    function getPayoutForPut(
        FundsCalculator.OptionPayoutInput memory payoutInput
    ) internal pure returns (QuantMath.FixedPointInt memory payoutAmount) {
        payoutAmount = payoutInput.strikePrice.isGreaterThan(
            payoutInput.expiryPrice
        )
            ? (payoutInput.strikePrice.sub(payoutInput.expiryPrice)).mul(
                payoutInput.amount
            )
            : int256(0).fromUnscaledInt();
    }

    /// @notice Calculates the collateral required to mint an option or spread
    /// @param _qTokenToMintStrikePrice the strike price of the qToken being minted 
    /// @param _qTokenForCollateralStrikePrice the strike price of the qToken being used as
    /// collateral in the case of a spread
    /// @param _optionsAmount the amount of options/spread being minted
    /// @param _qTokenToMintIsCall whether or not the token to mint is a call. if a spread,
    /// the qToken as collateral is implicitly also a call. and for minting a put, the 
    /// qToken as collateral is implicitly also a put
    /// @param _optionsDecimals option decimals constant. qTokens have 18 decimals
    /// @param _underlyingDecimals the amount of decimals the underlying asset has
    /// @param _strikeAssetDecimals the amount of decimals the strike asset has
    /// @return collateralAmount the collateral amount required as a fixed point type    
    function getOptionCollateralRequirement(
        uint256 _qTokenToMintStrikePrice,
        uint256 _qTokenForCollateralStrikePrice,
        uint256 _optionsAmount,
        bool _qTokenToMintIsCall,
        uint8 _optionsDecimals,
        uint8 _underlyingDecimals,
        uint8 _strikeAssetDecimals
    ) internal pure returns (QuantMath.FixedPointInt memory collateralAmount) {
        QuantMath.FixedPointInt memory collateralPerOption;
        if (_qTokenToMintIsCall) {
            collateralPerOption = getCallCollateralRequirement(
                _qTokenToMintStrikePrice,
                _qTokenForCollateralStrikePrice,
                _underlyingDecimals,
                _strikeAssetDecimals
            );
        } else {
            collateralPerOption = getPutCollateralRequirement(
                _qTokenToMintStrikePrice,
                _qTokenForCollateralStrikePrice,
                _strikeAssetDecimals
            );
        }

        collateralAmount = _optionsAmount.fromScaledUint(_optionsDecimals).mul(
            collateralPerOption
        );
    }

    /// @notice Calculates the collateral required to mint a single PUT option or PUT spread
    /// @param _qTokenToMintStrikePrice the strike price of the PUT qToken being minted 
    /// @param _qTokenForCollateralStrikePrice the strike price of the PUT qToken being used as
    /// collateral in the case of a spread
    /// @param _strikeAssetDecimals the amount of decimals the strike asset has
    /// @return collateralPerOption the collateral amount required per option as a fixed point type
    function getPutCollateralRequirement(
        uint256 _qTokenToMintStrikePrice,
        uint256 _qTokenForCollateralStrikePrice,
        uint8 _strikeAssetDecimals
    )
        internal
        pure
        returns (QuantMath.FixedPointInt memory collateralPerOption)
    {
        QuantMath.FixedPointInt
            memory mintStrikePrice = _qTokenToMintStrikePrice.fromScaledUint(
                _strikeAssetDecimals
            );
        QuantMath.FixedPointInt
            memory collateralStrikePrice = _qTokenForCollateralStrikePrice
                .fromScaledUint(_strikeAssetDecimals);

        // Initially (non-spread) required collateral is the long strike price
        collateralPerOption = mintStrikePrice;

        if (_qTokenForCollateralStrikePrice > 0) {
            collateralPerOption = mintStrikePrice.isGreaterThan(
                collateralStrikePrice
            )
                ? mintStrikePrice.sub(collateralStrikePrice) // Put Credit Spread
                : int256(0).fromUnscaledInt(); // Put Debit Spread
        }
    }

    /// @notice Calculates the collateral required to mint a single CALL option or CALL spread
    /// @param _qTokenToMintStrikePrice the strike price of the CALL qToken being minted 
    /// @param _qTokenForCollateralStrikePrice the strike price of the CALL qToken being
    /// used as collateral in the case of a spread
    /// @param _underlyingDecimals the amount of decimals the underlying asset has
    /// @param _strikeAssetDecimals the amount of decimals the strike asset has
    /// @return collateralPerOption the collateral amount required per option as a fixed point type
    function getCallCollateralRequirement(
        uint256 _qTokenToMintStrikePrice,
        uint256 _qTokenForCollateralStrikePrice,
        uint8 _underlyingDecimals,
        uint8 _strikeAssetDecimals
    )
        internal
        pure
        returns (QuantMath.FixedPointInt memory collateralPerOption)
    {
        QuantMath.FixedPointInt
            memory mintStrikePrice = _qTokenToMintStrikePrice.fromScaledUint(
                _strikeAssetDecimals
            );
        QuantMath.FixedPointInt
            memory collateralStrikePrice = _qTokenForCollateralStrikePrice
                .fromScaledUint(_strikeAssetDecimals);

        // Initially (non-spread) required collateral is the long strike price
        collateralPerOption = (10**_underlyingDecimals).fromScaledUint(
            _underlyingDecimals
        );

        if (_qTokenForCollateralStrikePrice > 0) {
            collateralPerOption = mintStrikePrice.isGreaterThanOrEqual(
                collateralStrikePrice
            )
                ? int256(0).fromUnscaledInt() // Call Debit Spread
                : (collateralStrikePrice.sub(mintStrikePrice)).div(
                    collateralStrikePrice
                ); // Call Credit Spread
        }
    }
}
