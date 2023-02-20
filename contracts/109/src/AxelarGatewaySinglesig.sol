// SPDX-License-Identifier: MIT

pragma solidity 0.8.9;

import { IAxelarGatewaySinglesig } from './interfaces/IAxelarGatewaySinglesig.sol';

import { ECDSA } from './ECDSA.sol';
import { AxelarGateway } from './AxelarGateway.sol';

contract AxelarGatewaySinglesig is IAxelarGatewaySinglesig, AxelarGateway {
    error InvalidAddress();
    error NotProxy();
    error InvalidChainId();
    error InvalidCommands();

    bytes32 internal constant KEY_OWNER_EPOCH = keccak256('owner-epoch');

    bytes32 internal constant PREFIX_OWNER = keccak256('owner');

    bytes32 internal constant KEY_OPERATOR_EPOCH = keccak256('operator-epoch');

    bytes32 internal constant PREFIX_OPERATOR = keccak256('operator');

    constructor(address tokenDeployer) AxelarGateway(tokenDeployer) {}

    /********************\
    |* Pure Key Getters *|
    \********************/

    function _getOwnerKey(uint256 ownerEpoch) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(PREFIX_OWNER, ownerEpoch));
    }

    function _getOperatorKey(uint256 operatorEpoch) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(PREFIX_OPERATOR, operatorEpoch));
    }

    /***********\
    |* Getters *|
    \***********/

    function _ownerEpoch() internal view returns (uint256) {
        return getUint(KEY_OWNER_EPOCH);
    }

    function _getOwner(uint256 ownerEpoch) internal view returns (address) {
        return getAddress(_getOwnerKey(ownerEpoch));
    }

    /// @dev Returns true if a `account` is owner within the last `OLD_KEY_RETENTION + 1` owner epochs (excluding the current one).
    function _isValidPreviousOwner(address account) internal view returns (bool) {
        uint256 ownerEpoch = _ownerEpoch();
        uint256 recentEpochs = OLD_KEY_RETENTION + uint256(1);
        uint256 lowerBoundOwnerEpoch = ownerEpoch > recentEpochs ? ownerEpoch - recentEpochs : uint256(0);

        --ownerEpoch;
        while (ownerEpoch > lowerBoundOwnerEpoch) {
            if (account == _getOwner(ownerEpoch--)) return true;
        }

        return false;
    }

    function owner() public view override returns (address) {
        return _getOwner(_ownerEpoch());
    }

    function _operatorEpoch() internal view returns (uint256) {
        return getUint(KEY_OPERATOR_EPOCH);
    }

    function _getOperator(uint256 operatorEpoch) internal view returns (address) {
        return getAddress(_getOperatorKey(operatorEpoch));
    }

    /// @dev Returns true if a `account` is operator within the last `OLD_KEY_RETENTION + 1` operator epochs.
    function _isValidRecentOperator(address account) internal view returns (bool) {
        uint256 operatorEpoch = _operatorEpoch();
        uint256 recentEpochs = OLD_KEY_RETENTION + uint256(1);
        uint256 lowerBoundOperatorEpoch = operatorEpoch > recentEpochs ? operatorEpoch - recentEpochs : uint256(0);

        while (operatorEpoch > lowerBoundOperatorEpoch) {
            if (account == _getOperator(operatorEpoch--)) return true;
        }

        return false;
    }

    function operator() public view override returns (address) {
        return _getOperator(_operatorEpoch());
    }

    /***********\
    |* Setters *|
    \***********/

    function _setOwnerEpoch(uint256 ownerEpoch) internal {
        _setUint(KEY_OWNER_EPOCH, ownerEpoch);
    }

    function _setOwner(uint256 ownerEpoch, address account) internal {
        _setAddress(_getOwnerKey(ownerEpoch), account);
    }

    function _setOperatorEpoch(uint256 operatorEpoch) internal {
        _setUint(KEY_OPERATOR_EPOCH, operatorEpoch);
    }

    function _setOperator(uint256 operatorEpoch, address account) internal {
        _setAddress(_getOperatorKey(operatorEpoch), account);
    }

    /**********************\
    |* Self Functionality *|
    \**********************/

    function deployToken(bytes calldata params, bytes32) external onlySelf {
        (string memory name, string memory symbol, uint8 decimals, uint256 cap, address tokenAddr) = abi.decode(
            params,
            (string, string, uint8, uint256, address)
        );

        _deployToken(name, symbol, decimals, cap, tokenAddr);
    }

    function mintToken(bytes calldata params, bytes32) external onlySelf {
        (string memory symbol, address account, uint256 amount) = abi.decode(params, (string, address, uint256));

        _mintToken(symbol, account, amount);
    }

    function burnToken(bytes calldata params, bytes32) external onlySelf {
        (string memory symbol, bytes32 salt) = abi.decode(params, (string, bytes32));

        _burnToken(symbol, salt);
    }

    function approveContractCall(bytes calldata params, bytes32 commandId) external onlySelf {
        (
            string memory sourceChain,
            string memory sourceAddress,
            address contractAddress,
            bytes32 payloadHash,
            bytes32 sourceTxHash,
            uint256 sourceEventIndex
        ) = abi.decode(params, (string, string, address, bytes32, bytes32, uint256));

        _approveContractCall(
            commandId,
            sourceChain,
            sourceAddress,
            contractAddress,
            payloadHash,
            sourceTxHash,
            sourceEventIndex
        );
    }

    function approveContractCallWithMint(bytes calldata params, bytes32 commandId) external onlySelf {
        (
            string memory sourceChain,
            string memory sourceAddress,
            address contractAddress,
            bytes32 payloadHash,
            string memory symbol,
            uint256 amount,
            bytes32 sourceTxHash,
            uint256 sourceEventIndex
        ) = abi.decode(params, (string, string, address, bytes32, string, uint256, bytes32, uint256));

        _approveContractCallWithMint(
            commandId,
            sourceChain,
            sourceAddress,
            contractAddress,
            payloadHash,
            symbol,
            amount,
            sourceTxHash,
            sourceEventIndex
        );
    }

    function transferOwnership(bytes calldata params, bytes32) external onlySelf {
        address newOwner = abi.decode(params, (address));
        uint256 ownerEpoch = _ownerEpoch();

        if (newOwner == address(0)) revert InvalidAddress();

        emit OwnershipTransferred(_getOwner(ownerEpoch), newOwner);

        _setOwnerEpoch(++ownerEpoch);
        _setOwner(ownerEpoch, newOwner);
    }

    function transferOperatorship(bytes calldata params, bytes32) external onlySelf {
        address newOperator = abi.decode(params, (address));

        if (newOperator == address(0)) revert InvalidAddress();

        emit OperatorshipTransferred(operator(), newOperator);

        uint256 operatorEpoch = _operatorEpoch();
        _setOperatorEpoch(++operatorEpoch);
        _setOperator(operatorEpoch, newOperator);
    }

    /**************************\
    |* External Functionality *|
    \**************************/

    function setup(bytes calldata params) external override {
        // Prevent setup from being called on a non-proxy (the implementation).
        if (implementation() == address(0)) revert NotProxy();

        (address[] memory adminAddresses, uint256 adminThreshold, address ownerAddress, address operatorAddress) = abi
            .decode(params, (address[], uint256, address, address));

        uint256 adminEpoch = _adminEpoch() + uint256(1);
        _setAdminEpoch(adminEpoch);
        _setAdmins(adminEpoch, adminAddresses, adminThreshold);

        uint256 ownerEpoch = _ownerEpoch() + uint256(1);
        _setOwnerEpoch(ownerEpoch);
        _setOwner(ownerEpoch, ownerAddress);

        uint256 operatorEpoch = _operatorEpoch() + uint256(1);
        _setOperatorEpoch(operatorEpoch);
        _setOperator(operatorEpoch, operatorAddress);

        emit OwnershipTransferred(address(0), ownerAddress);
        emit OperatorshipTransferred(address(0), operatorAddress);
    }

    function execute(bytes calldata input) external override {
        (bytes memory data, bytes memory signature) = abi.decode(input, (bytes, bytes));

        _execute(data, signature);
    }

    function _execute(bytes memory data, bytes memory sig) internal {
        address signer = ECDSA.recover(ECDSA.toEthSignedMessageHash(keccak256(data)), sig);

        (
            uint256 chainId,
            Role signerRole,
            bytes32[] memory commandIds,
            string[] memory commands,
            bytes[] memory params
        ) = abi.decode(data, (uint256, Role, bytes32[], string[], bytes[]));

        if (chainId != block.chainid) revert InvalidChainId();

        uint256 commandsLength = commandIds.length;

        if (commandsLength != commands.length || commandsLength != params.length) revert InvalidCommands();

        bool isCurrentOwner;
        bool isValidRecentOwner;
        bool isValidRecentOperator;

        if (signerRole == Role.Owner) {
            isCurrentOwner = signer == owner();
            isValidRecentOwner = isCurrentOwner || _isValidPreviousOwner(signer);
        } else if (signerRole == Role.Operator) {
            isValidRecentOperator = _isValidRecentOperator(signer);
        }

        for (uint256 i; i < commandsLength; i++) {
            bytes32 commandId = commandIds[i];

            if (isCommandExecuted(commandId)) continue; /* Ignore if duplicate commandId received */

            bytes4 commandSelector;
            bytes32 commandHash = keccak256(abi.encodePacked(commands[i]));

            if (commandHash == SELECTOR_DEPLOY_TOKEN) {
                if (!isValidRecentOwner) continue;

                commandSelector = AxelarGatewaySinglesig.deployToken.selector;
            } else if (commandHash == SELECTOR_MINT_TOKEN) {
                if (!isValidRecentOperator && !isValidRecentOwner) continue;

                commandSelector = AxelarGatewaySinglesig.mintToken.selector;
            } else if (commandHash == SELECTOR_APPROVE_CONTRACT_CALL) {
                if (!isValidRecentOperator && !isValidRecentOwner) continue;

                commandSelector = AxelarGatewaySinglesig.approveContractCall.selector;
            } else if (commandHash == SELECTOR_APPROVE_CONTRACT_CALL_WITH_MINT) {
                if (!isValidRecentOperator && !isValidRecentOwner) continue;

                commandSelector = AxelarGatewaySinglesig.approveContractCallWithMint.selector;
            } else if (commandHash == SELECTOR_BURN_TOKEN) {
                if (!isValidRecentOperator && !isValidRecentOwner) continue;

                commandSelector = AxelarGatewaySinglesig.burnToken.selector;
            } else if (commandHash == SELECTOR_TRANSFER_OWNERSHIP) {
                if (!isCurrentOwner) continue;

                commandSelector = AxelarGatewaySinglesig.transferOwnership.selector;
            } else if (commandHash == SELECTOR_TRANSFER_OPERATORSHIP) {
                if (!isCurrentOwner) continue;

                commandSelector = AxelarGatewaySinglesig.transferOperatorship.selector;
            } else {
                continue; /* Ignore if unknown command received */
            }

            // Prevent a re-entrancy from executing this command before it can be marked as successful.
            _setCommandExecuted(commandId, true);
            (bool success, ) = address(this).call(abi.encodeWithSelector(commandSelector, params[i], commandId));
            _setCommandExecuted(commandId, success);

            if (success) {
                emit Executed(commandId);
            }
        }
    }
}
