// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "../QuantConfig.sol";
import "../utils/EIP712MetaTransaction.sol";
import "../utils/OperateProxy.sol";
import "../interfaces/IQToken.sol";
import "../interfaces/IOracleRegistry.sol";
import "../interfaces/ICollateralToken.sol";
import "../interfaces/IController.sol";
import "../interfaces/IOperateProxy.sol";
import "../interfaces/IQuantCalculator.sol";
import "../interfaces/IOptionsFactory.sol";
import "../libraries/ProtocolValue.sol";
import "../libraries/QuantMath.sol";
import "../libraries/FundsCalculator.sol";
import "../libraries/OptionsUtils.sol";
import "../libraries/Actions.sol";

contract ControllerV2 is
    IController,
    EIP712MetaTransaction,
    ReentrancyGuardUpgradeable
{
    using SafeERC20 for IERC20;
    using QuantMath for QuantMath.FixedPointInt;
    using Actions for ActionArgs;

    address public override optionsFactory;

    address public override operateProxy;

    address public override quantCalculator;

    uint256 public newV2StateVariable;

    function operate(ActionArgs[] memory _actions)
        external
        override
        nonReentrant
        returns (bool)
    {
        for (uint256 i = 0; i < _actions.length; i++) {
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
        }

        return true;
    }

    function setNewV2StateVariable(uint256 _value) external {
        newV2StateVariable = _value;
    }

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
        operateProxy = address(new OperateProxy());
        quantCalculator = _quantCalculator;
    }

    function _mintOptionsPosition(
        address _to,
        address _qToken,
        uint256 _amount
    ) internal returns (uint256) {
        IQToken qToken = IQToken(_qToken);

        (address collateral, uint256 collateralAmount) = IQuantCalculator(
            quantCalculator
        ).getCollateralRequirement(_qToken, address(0), _amount);

        _checkIfUnexpiredQToken(_qToken);

        require(
            IOracleRegistry(
                IOptionsFactory(optionsFactory).quantConfig().protocolAddresses(
                    ProtocolValue.encode("oracleRegistry")
                )
            ).isOracleActive(qToken.oracle()),
            "Controller: Can't mint an options position as the oracle is inactive"
        );

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

        (address collateral, uint256 collateralAmount) = IQuantCalculator(
            quantCalculator
        ).getCollateralRequirement(
                _qTokenToMint,
                _qTokenForCollateral,
                _amount
            );

        _checkIfUnexpiredQToken(_qTokenToMint);
        _checkIfUnexpiredQToken(_qTokenForCollateral);

        qTokenForCollateral.burn(_msgSender(), _amount);

        if (collateralAmount > 0) {
            IERC20(collateral).safeTransferFrom(
                _msgSender(),
                address(this),
                collateralAmount
            );
        }

        ICollateralToken collateralToken = IOptionsFactory(optionsFactory)
            .collateralToken();

        // Check if the corresponding CollateralToken has already been created
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

    function _exercise(address _qToken, uint256 _amount) internal {
        IQToken qToken = IQToken(_qToken);
        require(
            block.timestamp > qToken.expiryTime(),
            "Controller: Can not exercise options before their expiry"
        );

        uint256 amountToExercise = _amount;
        if (amountToExercise == 0) {
            amountToExercise = qToken.balanceOf(_msgSender());
        }

        (
            bool isSettled,
            address payoutToken,
            uint256 exerciseTotal
        ) = IQuantCalculator(quantCalculator).getExercisePayout(
                address(qToken),
                amountToExercise
            );

        require(isSettled, "Controller: Cannot exercise unsettled options");

        qToken.burn(_msgSender(), amountToExercise);

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

    function _claimCollateral(uint256 _collateralTokenId, uint256 _amount)
        internal
    {
        uint256 collateralTokenId = _collateralTokenId;

        (
            uint256 returnableCollateral,
            address collateralAsset,
            uint256 amountToClaim
        ) = IQuantCalculator(quantCalculator).calculateClaimableCollateral(
                collateralTokenId,
                _amount,
                _msgSender()
            );

        IOptionsFactory(optionsFactory).collateralToken().burnCollateralToken(
            _msgSender(),
            collateralTokenId,
            amountToClaim
        );

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

    function _neutralizePosition(uint256 _collateralTokenId, uint256 _amount)
        internal
    {
        (uint256 collateralTokenId, uint256 amount) = (
            _collateralTokenId,
            _amount
        );

        ICollateralToken collateralToken = IOptionsFactory(optionsFactory)
            .collateralToken();
        (address qTokenShort, address qTokenLong) = collateralToken.idToInfo(
            collateralTokenId
        );

        //get the amount of collateral tokens owned
        uint256 collateralTokensOwned = collateralToken.balanceOf(
            _msgSender(),
            collateralTokenId
        );

        //get the amount of qTokens owned
        uint256 qTokensOwned = IQToken(qTokenShort).balanceOf(_msgSender());

        //the amount of position that can be neutralized
        uint256 maxNeutralizable = qTokensOwned < collateralTokensOwned
            ? qTokensOwned
            : collateralTokensOwned;

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

        (address collateralType, uint256 collateralOwed) = IQuantCalculator(
            quantCalculator
        ).getNeutralizationPayout(qTokenShort, qTokenLong, amountToNeutralize);

        IQToken(qTokenShort).burn(_msgSender(), amountToNeutralize);

        collateralToken.burnCollateralToken(
            _msgSender(),
            collateralTokenId,
            amountToNeutralize
        );

        IERC20(collateralType).safeTransfer(_msgSender(), collateralOwed);

        //give the user their long tokens (if any)
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

    function _call(address _callee, bytes memory _data) internal {
        IOperateProxy(operateProxy).callFunction(_callee, _data);
    }

    function _checkIfUnexpiredQToken(address _qToken) internal view {
        require(
            IQToken(_qToken).expiryTime() > block.timestamp,
            "Controller: Cannot mint expired options"
        );
    }
}
