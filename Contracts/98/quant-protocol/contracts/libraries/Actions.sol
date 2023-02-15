// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.12;

enum ActionType {
    MintOption,
    MintSpread,
    Exercise,
    ClaimCollateral,
    Neutralize,
    QTokenPermit,
    CollateralTokenApproval,
    Call
}

struct ActionArgs {
    ActionType actionType; //type of action to perform
    address qToken; //qToken to exercise or mint
    address secondaryAddress; //secondary address depending on the action type
    address receiver; //receiving address of minting or function call
    uint256 amount; //amount of qTokens or collateral tokens
    uint256 collateralTokenId; //collateral token id for claiming collateral and neutralizing positions
    bytes data; //extra data for function calls
}

/// @title Library to parse arguments for actions to be executed by the Controller
/// @author Rolla
library Actions {
    function parseMintOptionArgs(ActionArgs memory _args)
        internal
        pure
        returns (
            address to,
            address qToken,
            uint256 amount
        )
    {
        require(_args.amount != 0, "Actions: cannot mint 0 options");

        to = _args.receiver;
        qToken = _args.qToken;
        amount = _args.amount;
    }

    function parseMintSpreadArgs(ActionArgs memory _args)
        internal
        pure
        returns (
            address qTokenToMint,
            address qTokenForCollateral,
            uint256 amount
        )
    {
        require(
            _args.amount != 0,
            "Actions: cannot mint 0 options from spreads"
        );

        qTokenToMint = _args.qToken;
        qTokenForCollateral = _args.secondaryAddress;
        amount = _args.amount;
    }

    function parseExerciseArgs(ActionArgs memory _args)
        internal
        pure
        returns (address qToken, uint256 amount)
    {
        qToken = _args.qToken;
        amount = _args.amount;
    }

    function parseClaimCollateralArgs(ActionArgs memory _args)
        internal
        pure
        returns (uint256 collateralTokenId, uint256 amount)
    {
        collateralTokenId = _args.collateralTokenId;
        amount = _args.amount;
    }

    function parseNeutralizeArgs(ActionArgs memory _args)
        internal
        pure
        returns (uint256 collateralTokenId, uint256 amount)
    {
        collateralTokenId = _args.collateralTokenId;
        amount = _args.amount;
    }

    function parseQTokenPermitArgs(ActionArgs memory _args)
        internal
        pure
        returns (
            address qToken,
            address owner,
            address spender,
            uint256 value,
            uint256 deadline,
            uint8 v,
            bytes32 r,
            bytes32 s
        )
    {
        (v, r, s) = abi.decode(_args.data, (uint8, bytes32, bytes32));

        qToken = _args.qToken;
        owner = _args.secondaryAddress;
        spender = _args.receiver;
        value = _args.amount;
        deadline = _args.collateralTokenId;
    }

    function parseCollateralTokenApprovalArgs(ActionArgs memory _args)
        internal
        pure
        returns (
            address owner,
            address operator,
            bool approved,
            uint256 nonce,
            uint256 deadline,
            uint8 v,
            bytes32 r,
            bytes32 s
        )
    {
        (approved, v, r, s) = abi.decode(
            _args.data,
            (bool, uint8, bytes32, bytes32)
        );

        owner = _args.secondaryAddress;
        operator = _args.receiver;
        nonce = _args.amount;
        deadline = _args.collateralTokenId;
    }

    function parseCallArgs(ActionArgs memory _args)
        internal
        pure
        returns (address callee, bytes memory data)
    {
        require(
            _args.receiver != address(0),
            "Actions: cannot make calls to the zero address"
        );

        callee = _args.receiver;
        data = _args.data;
    }
}
