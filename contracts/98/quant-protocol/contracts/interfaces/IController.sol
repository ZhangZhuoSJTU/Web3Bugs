// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "../libraries/Actions.sol";

interface IController {
    /// @notice emitted after a new position is created
    /// @param mintedTo address that received both QTokens and CollateralTokens
    /// @param minter address that provided collateral and created the position
    /// @param qToken address of the QToken minted
    /// @param optionsAmount amount of options minted
    /// @param collateralAsset asset provided as collateral to create the position
    /// @param collateralAmount amount of collateral provided
    event OptionsPositionMinted(
        address indexed mintedTo,
        address indexed minter,
        address indexed qToken,
        uint256 optionsAmount,
        address collateralAsset,
        uint256 collateralAmount
    );

    /// @notice emitted after a spread position is created
    /// @param account address that created the spread position, receiving both QTokens and CollateralTokens
    /// @param qTokenToMint QToken of the option the position is going long on
    /// @param qTokenForCollateral QToken of the option the position is shorting
    /// @param optionsAmount amount of qTokenToMint options minted
    /// @param collateralAsset asset provided as collateral to create the position (if debit spread)
    /// @param collateralAmount amount of collateral provided (if debit spread)
    event SpreadMinted(
        address indexed account,
        address indexed qTokenToMint,
        address indexed qTokenForCollateral,
        uint256 optionsAmount,
        address collateralAsset,
        uint256 collateralAmount
    );

    /// @notice emitted after a QToken is used to close a long position after expiry
    /// @param account address that used the QToken to exercise the position
    /// @param qToken address of the QToken representing the long position
    /// @param amountExercised amount of options exercised
    /// @param payout amount received from exercising the options
    /// @param payoutAsset asset received after exercising the options
    event OptionsExercised(
        address indexed account,
        address indexed qToken,
        uint256 amountExercised,
        uint256 payout,
        address payoutAsset
    );

    /// @notice emitted after both QTokens and CollateralTokens are used to claim the initial collateral
    /// that was used to create the position
    /// @param account address that used the QTokens and CollateralTokens to claim the collateral
    /// @param qToken address of the QToken representing the long position
    /// @param amountNeutralized amount of options that were used to claim the collateral
    /// @param collateralReclaimed amount of collateral returned
    /// @param collateralAsset asset returned after claiming the collateral
    /// @param longTokenReturned QToken returned if neutralizing a spread position
    event NeutralizePosition(
        address indexed account,
        address qToken,
        uint256 amountNeutralized,
        uint256 collateralReclaimed,
        address collateralAsset,
        address longTokenReturned
    );

    /// @notice emitted after a CollateralToken is used to close a short position after expiry
    /// @param account address that used the CollateralToken to close the position
    /// @param collateralTokenId ERC1155 id of the CollateralToken representing the short position
    /// @param amountClaimed amount of CollateralToken used to close the position
    /// @param collateralReturned amount returned of the asset used to mint the option
    /// @param collateralAsset asset returned after claiming the collateral, i.e. the same used when minting the option
    event CollateralClaimed(
        address indexed account,
        uint256 indexed collateralTokenId,
        uint256 amountClaimed,
        uint256 collateralReturned,
        address collateralAsset
    );

    /// @notice The main entry point in the Quant Protocol. This function takes an array of actions
    /// and executes them in order. Actions are passed encoded as ActionArgs structs, and then for each
    /// different action, the relevant arguments are parsed and passed to the respective internal function
    /// @dev For documentation of each individual action, see the corresponding internal function in Controller.sol
    /// @param _actions array of ActionArgs structs, each representing an action to be executed
    /// @return boolean indicating whether the actions were successfully executed
    function operate(ActionArgs[] memory _actions) external returns (bool);

    /// @notice Upgradable proxy initialization function called during deployment and upgrades
    function initialize(
        string memory,
        string memory,
        address,
        address
    ) external;

    /// @notice Address of the OptionsFactory contract
    function optionsFactory() external view returns (address);

    /// @notice Address of th OperateProxy contract deployed through the initialize function
    function operateProxy() external view returns (address);

    /// @notice Address of the QuantCalculator being used
    function quantCalculator() external view returns (address);
}
