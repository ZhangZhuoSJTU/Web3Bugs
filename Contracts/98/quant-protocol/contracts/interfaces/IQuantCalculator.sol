// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

/// @title For calculating collateral requirements and payouts for options and spreads
/// @author Rolla
interface IQuantCalculator {
    /// @notice Calculates the amount of collateral that can be claimed back post-settlement
    /// from a CollateralToken
    /// @param _collateralTokenId the id of the collateral token that is being claimed
    /// @param _amount the amount of the collateral token being claimed. passing 0 claims the
    /// users whole collateral token balance (does a balance lookup)
    /// @param _msgSender the address of the claiming account
    /// @return returnableCollateral the amount of collateral that will be returned from the claim
    /// @return collateralAsset the address of the asset that will be returned from the claim
    /// @return amountToClaim the amount of collateral tokens claimed. can only different to _amount
    /// when the _amount passed was 0 and the user had a collateral token balance > 0
    function calculateClaimableCollateral(
        uint256 _collateralTokenId,
        uint256 _amount,
        address _msgSender
    )
        external
        view
        returns (
            uint256 returnableCollateral,
            address collateralAsset,
            uint256 amountToClaim
        );

    /// @notice Calculates the collateral required to mint an option or a spread
    /// @param _qTokenToMint the desired qToken
    /// @param _qTokenForCollateral for spreads, this is the address of the qtoken to be used as collateral.
    /// for options, no collateral is provided so the zero address should be passed.
    /// @param _amount the amount of options/spread to mint
    /// @return collateral the address of the collateral token required
    /// @return collateralAmount the amount of collateral that is required to mint the option/spread
    function getCollateralRequirement(
        address _qTokenToMint,
        address _qTokenForCollateral,
        uint256 _amount
    ) external view returns (address collateral, uint256 collateralAmount);

    /// @notice Calculates exercisable amount of an option post-expiry
    /// @param _qToken address of the qToken being exercised
    /// @param _amount the amount of the qToken being exercised
    /// @return isSettled true if there is a settlement price for this option
    /// and it can be exercised. false if there is no settlement price for this
    /// option meaning it can't be exercised. if this value is false, payoutToken
    /// will return the zero address and payout amount will be 0.
    /// @return payoutToken the token that will be received from exercise. this will
    /// return the zero address if the option is unsettled (can't exercise unsettled option)
    /// @return payoutAmount the amount of payoutToken that will be received from exercising.
    /// zero if the option is unsettled (can't exercise unsettled option)
    function getExercisePayout(address _qToken, uint256 _amount)
        external
        view
        returns (
            bool isSettled,
            address payoutToken,
            uint256 payoutAmount
        );

    /// @notice Calculates the amount that will be received from neutralizing an option or spread.
    /// Neutralizing is the opposite action to mint - you give collateral token and qToken and receive
    /// back collateral required to mint. Thus, the calculation is the same as getting the collateral
    /// requirement with the only difference being rounding.
    /// For neutralizing a spread, not only will the collateral provided be returned (if any), but also
    /// the qToken that was provided as collateral when minting the spread will also be returned.
    /// @param _qTokenShort the desired qToken
    /// @param _qTokenLong for spreads, this is the address of the qtoken to be used as collateral.
    /// for options, no collateral is provided so the zero address should be passed.
    /// @param _amountToNeutralize the amount of options/spread being neutralized
    /// @return collateralType the token that will be returned from neutralizing. this is the same
    /// as the token that was provided when minting since this method is returning that collateral
    /// back.
    /// @return collateralOwed the amount of collateral that will be returned from neutralizing.
    /// given the same parameters used for minting this will return the same amount of collateral
    /// in all cases except when there is rounding involved. in those cases, the difference will be
    /// 1 unit of collateral less for the neutralize than the mint.
    function getNeutralizationPayout(
        address _qTokenShort,
        address _qTokenLong,
        uint256 _amountToNeutralize
    ) external view returns (address collateralType, uint256 collateralOwed);

    /// @notice The amount of decimals for Quant options
    // solhint-disable-next-line func-name-mixedcase
    function OPTIONS_DECIMALS() external view returns (uint8);

    /// @notice The amount of decimals for the strike asset used in the Quant Protocol
    function strikeAssetDecimals() external view returns (uint8);

    /// @notice The address of the factory contract that creates Quant options
    function optionsFactory() external view returns (address);
}
