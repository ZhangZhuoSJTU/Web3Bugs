// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "./QuantConfig.sol";
import "./utils/EIP712MetaTransaction.sol";
import "./utils/OperateProxy.sol";
import "./interfaces/IQToken.sol";
import "./interfaces/IOracleRegistry.sol";
import "./interfaces/ICollateralToken.sol";
import "./interfaces/IController.sol";
import "./interfaces/IOperateProxy.sol";
import "./interfaces/IQuantCalculator.sol";
import "./interfaces/IOptionsFactory.sol";
import "./libraries/ProtocolValue.sol";
import "./libraries/QuantMath.sol";
import "./libraries/OptionsUtils.sol";
import "./libraries/Actions.sol";

/// @title The main entry point in the Quant Protocol
/// @author Rolla
/// @notice Handles minting options and spreads, exercising, claiming collateral and neutralizing positions.
/// @dev This contract has no receive method, and also no way to recover tokens sent to it by accident.
/// Its balance of options or any other tokens are never used in any calculations, so there is no risk if that happens.
/// @dev This contract is an upgradeable proxy, and it supports meta transactions.
/// @dev The Controller holds all the collateral used to mint options. Options need to be created through the
/// OptionsFactory first.
contract Controller is
    IController,
    EIP712MetaTransaction,
    ReentrancyGuardUpgradeable
{
    using SafeERC20 for IERC20;
    using QuantMath for QuantMath.FixedPointInt;
    using Actions for ActionArgs;

    /// @inheritdoc IController
    address public override optionsFactory;

    /// @inheritdoc IController
    address public override operateProxy;

    /// @inheritdoc IController
    address public override quantCalculator;

    /// @inheritdoc IController
    function operate(ActionArgs[] memory _actions)
        external
        override
        nonReentrant
        returns (bool)
    {
        uint256 length = _actions.length;
        for (uint256 i = 0; i < length; ) {
            ActionArgs memory action = _actions[i];

            if (action.actionType == ActionType.MintOption) {
                (address to, address qToken, uint256 amount) = action
                    .parseMintOptionArgs();
                _mintOptionsPosition(to, qToken, amount);
            } else if (action.actionType == ActionType.MintSpread) {
                (
                    address qTokenToMint,
                    address qTokenForCollateral,
                    uint256 amount
                ) = action.parseMintSpreadArgs();
                _mintSpread(qTokenToMint, qTokenForCollateral, amount);
            } else if (action.actionType == ActionType.Exercise) {
                (address qToken, uint256 amount) = action.parseExerciseArgs();
                _exercise(qToken, amount);
            } else if (action.actionType == ActionType.ClaimCollateral) {
                (uint256 collateralTokenId, uint256 amount) = action
                    .parseClaimCollateralArgs();
                _claimCollateral(collateralTokenId, amount);
            } else if (action.actionType == ActionType.Neutralize) {
                (uint256 collateralTokenId, uint256 amount) = action
                    .parseNeutralizeArgs();
                _neutralizePosition(collateralTokenId, amount);
            } else if (action.actionType == ActionType.QTokenPermit) {
                (
                    address qToken,
                    address owner,
                    address spender,
                    uint256 value,
                    uint256 deadline,
                    uint8 v,
                    bytes32 r,
                    bytes32 s
                ) = action.parseQTokenPermitArgs();
                _qTokenPermit(qToken, owner, spender, value, deadline, v, r, s);
            } else if (
                action.actionType == ActionType.CollateralTokenApproval
            ) {
                (
                    address owner,
                    address operator,
                    bool approved,
                    uint256 nonce,
                    uint256 deadline,
                    uint8 v,
                    bytes32 r,
                    bytes32 s
                ) = action.parseCollateralTokenApprovalArgs();
                _collateralTokenApproval(
                    owner,
                    operator,
                    approved,
                    nonce,
                    deadline,
                    v,
                    r,
                    s
                );
            } else {
                require(
                    action.actionType == ActionType.Call,
                    "Controller: Invalid action type"
                );
                (address callee, bytes memory data) = action.parseCallArgs();
                _call(callee, data);
            }

            unchecked {
                ++i;
            }
        }

        return true;
    }

    // @inheritdoc IController
    function initialize(
        string memory _name,
        string memory _version,
        address _optionsFactory,
        address _quantCalculator
    ) public override initializer {
        require(
            _optionsFactory != address(0),
            "Controller: invalid OptionsFactory address"
        );
        require(
            _quantCalculator != address(0),
            "Controller: invalid QuantCalculator address"
        );

        __ReentrancyGuard_init();
        EIP712MetaTransaction.initializeEIP712(_name, _version);
        optionsFactory = _optionsFactory;

        /// @dev Unless this line is removed, a new OperateProxy will be created
        /// during each upgrade. So make sure any application that requires approving
        /// the OperateProxy to spend funds is aware of this.
        operateProxy = address(new OperateProxy());

        quantCalculator = _quantCalculator;
    }

    /// @notice Mints options for a given QToken, which must have been previously created in
    /// the configured OptionsFactory.
    /// @dev The caller (or signer in case of meta transactions) must first approve the Controller
    /// to spend the collateral asset, and then this function can be called, pulling the collateral
    /// from the caller/signer and minting QTokens and CollateralTokens to the given `to` address.
    /// Note that QTokens represent a long position, giving holders the ability to exercise options
    /// after expiry, while CollateralTokens represent a short position, giving holders the ability
    /// to claim the collateral after expiry.
    /// @param _to The address to which the QTokens and CollateralTokens will be minted.
    /// @param _qToken The QToken that represents the long position for the option to be minted.
    /// @param _amount The amount of options to be minted.
    function _mintOptionsPosition(
        address _to,
        address _qToken,
        uint256 _amount
    ) internal returns (uint256) {
        IQToken qToken = IQToken(_qToken);

        // get the collateral required to mint the specified amount of options
        // the zero address is passed as the second argument as it's only used
        // for spreads
        (address collateral, uint256 collateralAmount) = IQuantCalculator(
            quantCalculator
        ).getCollateralRequirement(_qToken, address(0), _amount);

        _checkIfUnexpiredQToken(_qToken);

        // check if the oracle set during the option's creation through the OptionsFactory
        // is an active oracle in the OracleRegistry
        require(
            IOracleRegistry(
                IOptionsFactory(optionsFactory).quantConfig().protocolAddresses(
                    ProtocolValue.encode("oracleRegistry")
                )
            ).isOracleActive(qToken.oracle()),
            "Controller: Can't mint an options position as the oracle is inactive"
        );

        // pull the required collateral from the caller/signer
        IERC20(collateral).safeTransferFrom(
            _msgSender(),
            address(this),
            collateralAmount
        );

        ICollateralToken collateralToken = IOptionsFactory(optionsFactory)
            .collateralToken();

        // Mint the options to the sender's address
        qToken.mint(_to, _amount);
        uint256 collateralTokenId = collateralToken.getCollateralTokenId(
            _qToken,
            address(0)
        );

        // There's no need to check if the collateralTokenId exists before minting because if the QToken is valid,
        // then it's guaranteed that the respective CollateralToken has already also been created by the OptionsFactory
        collateralToken.mintCollateralToken(_to, collateralTokenId, _amount);

        emit OptionsPositionMinted(
            _to,
            _msgSender(),
            _qToken,
            _amount,
            collateral,
            collateralAmount
        );

        return collateralTokenId;
    }

    /// @notice Creates a spread position from an option to long and another option to short.
    /// @dev The caller (or signer in case of meta transactions) must first approve the Controller
    /// to spend the collateral asset in cases of a debit spread.
    /// @param _qTokenToMint The QToken for the option to be long.
    /// @param _qTokenForCollateral The QToken for the option to be short.
    /// @param _amount The amount of long options to be minted.
    function _mintSpread(
        address _qTokenToMint,
        address _qTokenForCollateral,
        uint256 _amount
    ) internal returns (uint256) {
        require(
            _qTokenToMint != _qTokenForCollateral,
            "Controller: Can only create a spread with different tokens"
        );

        IQToken qTokenToMint = IQToken(_qTokenToMint);
        IQToken qTokenForCollateral = IQToken(_qTokenForCollateral);

        // Calculate the extra collateral required to create the spread.
        // A positive value for debit spreads and zero for credit spreads.
        (address collateral, uint256 collateralAmount) = IQuantCalculator(
            quantCalculator
        ).getCollateralRequirement(
                _qTokenToMint,
                _qTokenForCollateral,
                _amount
            );

        _checkIfUnexpiredQToken(_qTokenToMint);
        _checkIfUnexpiredQToken(_qTokenForCollateral);

        // Burn the QToken being shorted
        qTokenForCollateral.burn(_msgSender(), _amount);

        // Transfer in any collateral required for the spread
        if (collateralAmount > 0) {
            IERC20(collateral).safeTransferFrom(
                _msgSender(),
                address(this),
                collateralAmount
            );
        }

        ICollateralToken collateralToken = IOptionsFactory(optionsFactory)
            .collateralToken();

        // Check if the CollateralToken representing this specific spread has already been created
        // Create it if it hasn't
        uint256 collateralTokenId = collateralToken.getCollateralTokenId(
            _qTokenToMint,
            _qTokenForCollateral
        );
        (, address qTokenAsCollateral) = collateralToken.idToInfo(
            collateralTokenId
        );
        if (qTokenAsCollateral == address(0)) {
            require(
                collateralTokenId ==
                    collateralToken.createCollateralToken(
                        _qTokenToMint,
                        _qTokenForCollateral
                    ),
                "Controller: failed creating the collateral token to represent the spread"
            );
        }

        // Mint the tokens for the new spread position
        collateralToken.mintCollateralToken(
            _msgSender(),
            collateralTokenId,
            _amount
        );
        qTokenToMint.mint(_msgSender(), _amount);

        emit SpreadMinted(
            _msgSender(),
            _qTokenToMint,
            _qTokenForCollateral,
            _amount,
            collateral,
            collateralAmount
        );

        return collateralTokenId;
    }

    /// @notice Closes a long position after the option's expiry.
    /// @dev Pass an `_amount` of 0 to close the entire position.
    /// @param _qToken The QToken representing the long position to be closed.
    /// @param _amount The amount of options to exercise.
    function _exercise(address _qToken, uint256 _amount) internal {
        IQToken qToken = IQToken(_qToken);
        require(
            block.timestamp > qToken.expiryTime(),
            "Controller: Can not exercise options before their expiry"
        );

        uint256 amountToExercise = _amount;
        // if the amount is 0, the entire position will be exercised
        if (amountToExercise == 0) {
            amountToExercise = qToken.balanceOf(_msgSender());
        }

        // Use the QuantCalculator to check how much the sender/signer is due.
        // Will only be a positive value for options that expired In The Money.
        (
            bool isSettled,
            address payoutToken,
            uint256 exerciseTotal
        ) = IQuantCalculator(quantCalculator).getExercisePayout(
                address(qToken),
                amountToExercise
            );

        require(isSettled, "Controller: Cannot exercise unsettled options");

        // Burn the long tokens
        qToken.burn(_msgSender(), amountToExercise);

        // Transfer any profit due after expiration
        if (exerciseTotal > 0) {
            IERC20(payoutToken).safeTransfer(_msgSender(), exerciseTotal);
        }

        emit OptionsExercised(
            _msgSender(),
            address(qToken),
            amountToExercise,
            exerciseTotal,
            payoutToken
        );
    }

    /// @notice Closes a short position after the option's expiry.
    /// @param _collateralTokenId ERC1155 token id representing the short position to be closed.
    /// @param _amount The size of the position to close.
    function _claimCollateral(uint256 _collateralTokenId, uint256 _amount)
        internal
    {
        uint256 collateralTokenId = _collateralTokenId;

        // Use the QuantCalculator to check how much collateral the sender/signer is due.
        (
            uint256 returnableCollateral,
            address collateralAsset,
            uint256 amountToClaim
        ) = IQuantCalculator(quantCalculator).calculateClaimableCollateral(
                collateralTokenId,
                _amount,
                _msgSender()
            );

        // Burn the short tokens
        IOptionsFactory(optionsFactory).collateralToken().burnCollateralToken(
            _msgSender(),
            collateralTokenId,
            amountToClaim
        );

        // Transfer any collateral due after expiration
        if (returnableCollateral > 0) {
            IERC20(collateralAsset).safeTransfer(
                _msgSender(),
                returnableCollateral
            );
        }

        emit CollateralClaimed(
            _msgSender(),
            collateralTokenId,
            amountToClaim,
            returnableCollateral,
            collateralAsset
        );
    }

    /// @notice Closes a neutral position, claiming all the collateral required to create it.
    /// @dev Unlike `_exercise` and `_claimCollateral`, this function does not require the option to be expired.
    /// @param _collateralTokenId ERC1155 token id representing the position to be closed.
    /// @param _amount The size of the position to close.
    function _neutralizePosition(uint256 _collateralTokenId, uint256 _amount)
        internal
    {
        /// @dev Put these values in the stack to save gas from having to read
        /// from calldata
        (uint256 collateralTokenId, uint256 amount) = (
            _collateralTokenId,
            _amount
        );

        ICollateralToken collateralToken = IOptionsFactory(optionsFactory)
            .collateralToken();
        (address qTokenShort, address qTokenLong) = collateralToken.idToInfo(
            collateralTokenId
        );

        //get the amount of CollateralTokens owned
        uint256 collateralTokensOwned = collateralToken.balanceOf(
            _msgSender(),
            collateralTokenId
        );

        //get the amount of QTokens owned
        uint256 qTokensOwned = IQToken(qTokenShort).balanceOf(_msgSender());

        // the size of the position that can be neutralized
        uint256 maxNeutralizable = qTokensOwned < collateralTokensOwned
            ? qTokensOwned
            : collateralTokensOwned;

        // make sure that the amount passed is not greater than the amount that can be neutralized
        uint256 amountToNeutralize;
        if (amount != 0) {
            require(
                amount <= maxNeutralizable,
                "Controller: Tried to neutralize more than balance"
            );
            amountToNeutralize = amount;
        } else {
            amountToNeutralize = maxNeutralizable;
        }

        // use the QuantCalculator to check how much collateral the sender/signer is due
        // for closing the neutral position
        (address collateralType, uint256 collateralOwed) = IQuantCalculator(
            quantCalculator
        ).getNeutralizationPayout(qTokenShort, qTokenLong, amountToNeutralize);

        // burn the short tokens
        IQToken(qTokenShort).burn(_msgSender(), amountToNeutralize);

        // burn the long tokens
        collateralToken.burnCollateralToken(
            _msgSender(),
            collateralTokenId,
            amountToNeutralize
        );

        // tranfer the collateral owed
        IERC20(collateralType).safeTransfer(_msgSender(), collateralOwed);

        //give the user their long tokens (if any, in case of CollateralTokens representing a spread)
        if (qTokenLong != address(0)) {
            IQToken(qTokenLong).mint(_msgSender(), amountToNeutralize);
        }

        emit NeutralizePosition(
            _msgSender(),
            qTokenShort,
            amountToNeutralize,
            collateralOwed,
            collateralType,
            qTokenLong
        );
    }

    /// @notice Allows a QToken owner to approve a spender to transfer a specified amount of tokens on their behalf.
    /// @param _qToken The QToken to be approved.
    /// @param _spender The address of the spender.
    /// @param _value The amount of tokens to be approved for spending.
    /// @param _deadline Timestamp at which the permit signature expires.
    /// @param _v The signature's v value.
    /// @param _r The signature's r value.
    /// @param _s The signature's s value.
    function _qTokenPermit(
        address _qToken,
        address _owner,
        address _spender,
        uint256 _value,
        uint256 _deadline,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
    ) internal {
        IQToken(_qToken).permit(
            _owner,
            _spender,
            _value,
            _deadline,
            _v,
            _r,
            _s
        );
    }

    /// @notice Allows a CollateralToken owner to either approve an operator address
    /// to spend all of their tokens on their behalf, or to remove a prior approval.
    /// @param _owner The address of the owner of the CollateralToken.
    /// @param _operator The address of the operator to be approved or removed.
    /// @param _approved Whether the operator is being approved or removed.
    /// @param _nonce The nonce for the approval through a meta transaction.
    /// @param _deadline Timestamp at which the approval signature expires.
    /// @param _v The signature's v value.
    /// @param _r The signature's r value.
    /// @param _s The signature's s value.
    function _collateralTokenApproval(
        address _owner,
        address _operator,
        bool _approved,
        uint256 _nonce,
        uint256 _deadline,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
    ) internal {
        IOptionsFactory(optionsFactory).collateralToken().metaSetApprovalForAll(
                _owner,
                _operator,
                _approved,
                _nonce,
                _deadline,
                _v,
                _r,
                _s
            );
    }

    /// @notice Allows a sender/signer to make external calls to any other contract.
    /// @dev A separate OperateProxy contract is used to make the external calls so
    /// that the Controller, which holds funds and has special privileges in the Quant
    /// Protocol, is never the `msg.sender` in any of those external calls.
    /// @param _callee The address of the contract to be called.
    /// @param _data The calldata to be sent to the contract.
    function _call(address _callee, bytes memory _data) internal {
        IOperateProxy(operateProxy).callFunction(_callee, _data);
    }

    /// @notice Checks if the given QToken has not expired yet, reverting otherwise
    /// @param _qToken The address of the QToken to check.
    function _checkIfUnexpiredQToken(address _qToken) internal view {
        require(
            IQToken(_qToken).expiryTime() > block.timestamp,
            "Controller: Cannot mint expired options"
        );
    }
}
