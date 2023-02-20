// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.12;

import "@openzeppelin/contracts-upgradeable/utils/cryptography/draft-EIP712Upgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "../interfaces/IEIP712MetaTransaction.sol";
import "../interfaces/IController.sol";
import "../libraries/Actions.sol";
import {ActionArgs} from "../libraries/Actions.sol";

/// @title Contract to be inherited by contracts that want to support meta transactions.
/// @author Rolla
contract EIP712MetaTransaction is EIP712Upgradeable {
    using ECDSA for bytes32;

    struct MetaAction {
        uint256 nonce;
        uint256 deadline;
        address from;
        ActionArgs[] actions;
    }

    bytes32 private constant _META_ACTION_TYPEHASH =
        keccak256(
            // solhint-disable-next-line max-line-length
            "MetaAction(uint256 nonce,uint256 deadline,address from,ActionArgs[] actions)ActionArgs(uint8 actionType,address qToken,address secondaryAddress,address receiver,uint256 amount,uint256 collateralTokenId,bytes data)"
        );
    bytes32 private constant _ACTION_TYPEHASH =
        keccak256(
            // solhint-disable-next-line max-line-length
            "ActionArgs(uint8 actionType,address qToken,address secondaryAddress,address receiver,uint256 amount,uint256 collateralTokenId,bytes data)"
        );

    mapping(address => uint256) private _nonces;

    /// @notice user readable name of signing domain for EIP712 (the protocol name)
    string public name;

    /// @notice the current major version of the signing domain for EIP712
    string public version;

    /// @notice emitted when a meta transaction is executed
    event MetaTransactionExecuted(
        address indexed userAddress,
        address payable indexed relayerAddress,
        uint256 nonce
    );

    /// @notice Given an encoded action and a signature, executes the action on behalf of the signer.
    /// @param metaAction The encoded action to be executed.
    /// @param r The r-value of the signature.
    /// @param s The s-value of the signature.
    /// @param v The v-value of the signature.
    /// @return The returned data from the low-level call.
    function executeMetaTransaction(
        MetaAction memory metaAction,
        bytes32 r,
        bytes32 s,
        uint8 v
    ) external payable returns (bytes memory) {
        require(
            _verify(metaAction.from, metaAction, r, s, v),
            "signer and signature don't match"
        );

        uint256 currentNonce = _nonces[metaAction.from];

        // intentionally allow this to overflow to save gas,
        // and it's impossible for someone to do 2 ^ 256 - 1 meta txs
        unchecked {
            _nonces[metaAction.from] = currentNonce + 1;
        }

        // Append the metaAction.from at the end so that it can be extracted later
        // from the calling context (see _msgSender() below)
        (bool success, bytes memory returnData) = address(this).call(
            abi.encodePacked(
                abi.encodeWithSelector(
                    IController(address(this)).operate.selector,
                    metaAction.actions
                ),
                metaAction.from
            )
        );

        require(success, "unsuccessful function call");
        emit MetaTransactionExecuted(
            metaAction.from,
            payable(msg.sender),
            currentNonce
        );
        return returnData;
    }

    /// @notice Returns the current nonce for a user.
    /// @param user the address of the user to get the nonce for.
    /// @return nonce the current nonce for the user.
    function getNonce(address user) external view returns (uint256 nonce) {
        nonce = _nonces[user];
    }

    /// @notice initialize method for EIP712Upgradeable
    /// @dev called once after initial deployment and every upgrade.
    /// @param _name the user readable name of the signing domain for EIP712
    /// @param _version the current major version of the signing domain for EIP712
    function initializeEIP712(string memory _name, string memory _version)
        public
        initializer
    {
        name = _name;
        version = _version;

        __EIP712_init(_name, _version);
    }

    /// @notice Returns the address of the signer when called from this contract,
    /// otherwise returns the msg.sender
    /// @return sender the address of the signer or msg.sender
    function _msgSender() internal view returns (address sender) {
        if (msg.sender == address(this)) {
            bytes memory array = msg.data;
            uint256 index = msg.data.length;
            assembly {
                // Load the 32 bytes word from memory with the address on the lower 20 bytes, and mask those.
                sender := and(
                    mload(add(array, index)),
                    0xffffffffffffffffffffffffffffffffffffffff
                )
            }
        } else {
            sender = msg.sender;
        }
        return sender;
    }

    /// @notice Verifies that the signature is valid for a given user and action.
    /// @param user the address to check as the signer.
    /// @param metaAction the action struct to check.
    /// @param r the r-value of the signature.
    /// @param s the s-value of the signature.
    /// @param v the v-value of the signature.
    function _verify(
        address user,
        MetaAction memory metaAction,
        bytes32 r,
        bytes32 s,
        uint8 v
    ) internal view returns (bool) {
        require(metaAction.nonce == _nonces[user], "invalid nonce");

        require(metaAction.deadline >= block.timestamp, "expired deadline");

        address signer = _hashTypedDataV4(_hashMetaAction(metaAction)).recover(
            v,
            r,
            s
        );

        return signer == user;
    }

    /// @notice Hashes a given ActionArgs struct to be used with EIP712.
    /// @param action the ActionArgs struct to hash.
    /// @return the hash of the ActionArgs struct.
    function _hashAction(ActionArgs memory action)
        private
        pure
        returns (bytes32)
    {
        return
            keccak256(
                abi.encode(
                    _ACTION_TYPEHASH,
                    action.actionType,
                    action.qToken,
                    action.secondaryAddress,
                    action.receiver,
                    action.amount,
                    action.collateralTokenId,
                    keccak256(action.data)
                )
            );
    }

    /// @notice Hashes an array of ActionArgs structs to be used with EIP712.
    /// @param actions the array of ActionArgs structs to hash.
    /// @return the array of hashes for the ActionArgs structs.
    function _hashActions(ActionArgs[] memory actions)
        private
        pure
        returns (bytes32[] memory)
    {
        bytes32[] memory hashedActions = new bytes32[](actions.length);
        uint256 length = actions.length;
        for (uint256 i = 0; i < length; ) {
            hashedActions[i] = _hashAction(actions[i]);
            unchecked {
                ++i;
            }
        }
        return hashedActions;
    }

    /// @notice Hashes a MetaAction struct to be used with EIP712.
    /// @param metaAction the MetaAction struct to hash.
    /// @return the hash of the MetaAction struct.
    function _hashMetaAction(MetaAction memory metaAction)
        private
        pure
        returns (bytes32)
    {
        return
            keccak256(
                abi.encode(
                    _META_ACTION_TYPEHASH,
                    metaAction.nonce,
                    metaAction.deadline,
                    metaAction.from,
                    keccak256(
                        abi.encodePacked(_hashActions(metaAction.actions))
                    )
                )
            );
    }
}
