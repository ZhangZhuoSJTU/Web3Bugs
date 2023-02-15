// SPDX-License-Identifier: MIT

pragma solidity 0.8.9;

import { IAxelarGatewayMultisig } from './interfaces/IAxelarGatewayMultisig.sol';

import { ECDSA } from './ECDSA.sol';
import { AxelarGateway } from './AxelarGateway.sol';

contract AxelarGatewayMultisig is IAxelarGatewayMultisig, AxelarGateway {
    error InvalidAddress();
    error InvalidOwners();
    error InvalidOwnerThreshold();
    error DuplicateOwner(address owner);
    error InvalidOperators();
    error InvalidOperatorThreshold();
    error DuplicateOperator(address operator);
    error NotProxy();
    error InvalidChainId();
    error MalformedSigners();
    error InvalidCommands();

    // AUDIT: slot names should be prefixed with some standard string
    // AUDIT: constants should be literal and their derivation should be in comments
    bytes32 internal constant KEY_OWNER_EPOCH = keccak256('owner-epoch');

    bytes32 internal constant PREFIX_OWNER = keccak256('owner');
    bytes32 internal constant PREFIX_OWNER_COUNT = keccak256('owner-count');
    bytes32 internal constant PREFIX_OWNER_THRESHOLD = keccak256('owner-threshold');
    bytes32 internal constant PREFIX_IS_OWNER = keccak256('is-owner');

    bytes32 internal constant KEY_OPERATOR_EPOCH = keccak256('operator-epoch');

    bytes32 internal constant PREFIX_OPERATOR = keccak256('operator');
    bytes32 internal constant PREFIX_OPERATOR_COUNT = keccak256('operator-count');
    bytes32 internal constant PREFIX_OPERATOR_THRESHOLD = keccak256('operator-threshold');
    bytes32 internal constant PREFIX_IS_OPERATOR = keccak256('is-operator');

    constructor(address tokenDeployer) AxelarGateway(tokenDeployer) {}

    function _isSortedAscAndContainsNoDuplicate(address[] memory accounts) internal pure returns (bool) {
        for (uint256 i; i < accounts.length - 1; ++i) {
            if (accounts[i] >= accounts[i + 1]) {
                return false;
            }
        }

        return true;
    }

    /************************\
    |* Owners Functionality *|
    \************************/

    /********************\
    |* Pure Key Getters *|
    \********************/

    function _getOwnerKey(uint256 epoch, uint256 index) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(PREFIX_OWNER, epoch, index));
    }

    function _getOwnerCountKey(uint256 epoch) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(PREFIX_OWNER_COUNT, epoch));
    }

    function _getOwnerThresholdKey(uint256 epoch) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(PREFIX_OWNER_THRESHOLD, epoch));
    }

    function _getIsOwnerKey(uint256 epoch, address account) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(PREFIX_IS_OWNER, epoch, account));
    }

    /***********\
    |* Getters *|
    \***********/

    function _ownerEpoch() internal view returns (uint256) {
        return getUint(KEY_OWNER_EPOCH);
    }

    function _getOwner(uint256 epoch, uint256 index) internal view returns (address) {
        return getAddress(_getOwnerKey(epoch, index));
    }

    function _getOwnerCount(uint256 epoch) internal view returns (uint256) {
        return getUint(_getOwnerCountKey(epoch));
    }

    function _getOwnerThreshold(uint256 epoch) internal view returns (uint256) {
        return getUint(_getOwnerThresholdKey(epoch));
    }

    function _isOwner(uint256 epoch, address account) internal view returns (bool) {
        return getBool(_getIsOwnerKey(epoch, account));
    }

    /// @dev Returns true if a sufficient quantity of `accounts` are owners within the last `OLD_KEY_RETENTION + 1` owner epochs (excluding the current one).
    function _areValidPreviousOwners(address[] memory accounts) internal view returns (bool) {
        uint256 epoch = _ownerEpoch();
        uint256 recentEpochs = OLD_KEY_RETENTION + uint256(1);
        uint256 lowerBoundOwnerEpoch = epoch > recentEpochs ? epoch - recentEpochs : uint256(0);

        --epoch;
        while (epoch > lowerBoundOwnerEpoch) {
            if (_areValidOwnersInEpoch(epoch--, accounts)) return true;
        }

        return false;
    }

    /// @dev Returns true if a sufficient quantity of `accounts` are owners in the `ownerEpoch`.
    function _areValidOwnersInEpoch(uint256 epoch, address[] memory accounts) internal view returns (bool) {
        uint256 threshold = _getOwnerThreshold(epoch);
        uint256 validSignerCount;

        for (uint256 i; i < accounts.length; i++) {
            if (_isOwner(epoch, accounts[i]) && ++validSignerCount >= threshold) return true;
        }

        return false;
    }

    /// @dev Returns the current `ownerEpoch`.
    function ownerEpoch() external view override returns (uint256) {
        return _ownerEpoch();
    }

    /// @dev Returns the threshold for a given `ownerEpoch`.
    function ownerThreshold(uint256 epoch) external view override returns (uint256) {
        return _getOwnerThreshold(epoch);
    }

    /// @dev Returns the array of owners within a given `ownerEpoch`.
    function owners(uint256 epoch) public view override returns (address[] memory results) {
        uint256 ownerCount = _getOwnerCount(epoch);
        results = new address[](ownerCount);

        for (uint256 i; i < ownerCount; i++) {
            results[i] = _getOwner(epoch, i);
        }
    }

    /***********\
    |* Setters *|
    \***********/

    function _setOwnerEpoch(uint256 epoch) internal {
        _setUint(KEY_OWNER_EPOCH, epoch);
    }

    function _setOwner(
        uint256 epoch,
        uint256 index,
        address account
    ) internal {
        if (account == address(0)) revert InvalidAddress();

        _setAddress(_getOwnerKey(epoch, index), account);
    }

    function _setOwnerCount(uint256 epoch, uint256 ownerCount) internal {
        _setUint(_getOwnerCountKey(epoch), ownerCount);
    }

    function _setOwners(
        uint256 epoch,
        address[] memory accounts,
        uint256 threshold
    ) internal {
        uint256 accountLength = accounts.length;

        if (accountLength < threshold) revert InvalidOwners();

        if (threshold == uint256(0)) revert InvalidOwnerThreshold();

        _setOwnerThreshold(epoch, threshold);
        _setOwnerCount(epoch, accountLength);

        for (uint256 i; i < accountLength; i++) {
            address account = accounts[i];

            // Check that the account wasn't already set as an owner for this ownerEpoch.
            if (_isOwner(epoch, account)) revert DuplicateOwner(account);

            // Set this account as the i-th owner in this ownerEpoch (needed to we can get all the owners for `owners`).
            _setOwner(epoch, i, account);
            _setIsOwner(epoch, account, true);
        }
    }

    function _setOwnerThreshold(uint256 epoch, uint256 threshold) internal {
        _setUint(_getOwnerThresholdKey(epoch), threshold);
    }

    function _setIsOwner(
        uint256 epoch,
        address account,
        bool isOwner
    ) internal {
        _setBool(_getIsOwnerKey(epoch, account), isOwner);
    }

    /**************************\
    |* Operator Functionality *|
    \**************************/

    /********************\
    |* Pure Key Getters *|
    \********************/

    function _getOperatorKey(uint256 epoch, uint256 index) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(PREFIX_OPERATOR, epoch, index));
    }

    function _getOperatorCountKey(uint256 epoch) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(PREFIX_OPERATOR_COUNT, epoch));
    }

    function _getOperatorThresholdKey(uint256 epoch) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(PREFIX_OPERATOR_THRESHOLD, epoch));
    }

    function _getIsOperatorKey(uint256 epoch, address account) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(PREFIX_IS_OPERATOR, epoch, account));
    }

    /***********\
    |* Getters *|
    \***********/

    function _operatorEpoch() internal view returns (uint256) {
        return getUint(KEY_OPERATOR_EPOCH);
    }

    function _getOperator(uint256 epoch, uint256 index) internal view returns (address) {
        return getAddress(_getOperatorKey(epoch, index));
    }

    function _getOperatorCount(uint256 epoch) internal view returns (uint256) {
        return getUint(_getOperatorCountKey(epoch));
    }

    function _getOperatorThreshold(uint256 epoch) internal view returns (uint256) {
        return getUint(_getOperatorThresholdKey(epoch));
    }

    function _isOperator(uint256 epoch, address account) internal view returns (bool) {
        return getBool(_getIsOperatorKey(epoch, account));
    }

    /// @dev Returns true if a sufficient quantity of `accounts` are operator in the same `operatorEpoch`, within the last `OLD_KEY_RETENTION + 1` operator epochs.
    function _areValidRecentOperators(address[] memory accounts) internal view returns (bool) {
        uint256 epoch = _operatorEpoch();
        uint256 recentEpochs = OLD_KEY_RETENTION + uint256(1);
        uint256 lowerBoundOperatorEpoch = epoch > recentEpochs ? epoch - recentEpochs : uint256(0);

        while (epoch > lowerBoundOperatorEpoch) {
            if (_areValidOperatorsInEpoch(epoch--, accounts)) return true;
        }

        return false;
    }

    /// @dev Returns true if a sufficient quantity of `accounts` are operator in the `operatorEpoch`.
    function _areValidOperatorsInEpoch(uint256 epoch, address[] memory accounts) internal view returns (bool) {
        uint256 threshold = _getOperatorThreshold(epoch);
        uint256 validSignerCount;

        for (uint256 i; i < accounts.length; i++) {
            if (_isOperator(epoch, accounts[i]) && ++validSignerCount >= threshold) return true;
        }

        return false;
    }

    /// @dev Returns the current `operatorEpoch`.
    function operatorEpoch() external view override returns (uint256) {
        return _operatorEpoch();
    }

    /// @dev Returns the threshold for a given `operatorEpoch`.
    function operatorThreshold(uint256 epoch) external view override returns (uint256) {
        return _getOperatorThreshold(epoch);
    }

    /// @dev Returns the array of operators within a given `operatorEpoch`.
    function operators(uint256 epoch) public view override returns (address[] memory results) {
        uint256 operatorCount = _getOperatorCount(epoch);
        results = new address[](operatorCount);

        for (uint256 i; i < operatorCount; i++) {
            results[i] = _getOperator(epoch, i);
        }
    }

    /***********\
    |* Setters *|
    \***********/

    function _setOperatorEpoch(uint256 epoch) internal {
        _setUint(KEY_OPERATOR_EPOCH, epoch);
    }

    function _setOperator(
        uint256 epoch,
        uint256 index,
        address account
    ) internal {
        _setAddress(_getOperatorKey(epoch, index), account);
    }

    function _setOperatorCount(uint256 epoch, uint256 operatorCount) internal {
        _setUint(_getOperatorCountKey(epoch), operatorCount);
    }

    function _setOperators(
        uint256 epoch,
        address[] memory accounts,
        uint256 threshold
    ) internal {
        uint256 accountLength = accounts.length;

        if (accountLength < threshold) revert InvalidOperators();

        if (threshold == uint256(0)) revert InvalidOperatorThreshold();

        _setOperatorThreshold(epoch, threshold);
        _setOperatorCount(epoch, accountLength);

        for (uint256 i; i < accountLength; i++) {
            address account = accounts[i];

            // Check that the account wasn't already set as an operator for this operatorEpoch.
            if (_isOperator(epoch, account)) revert DuplicateOperator(account);

            if (account == address(0)) revert InvalidAddress();

            // Set this account as the i-th operator in this operatorEpoch (needed to we can get all the operators for `operators`).
            _setOperator(epoch, i, account);
            _setIsOperator(epoch, account, true);
        }
    }

    function _setOperatorThreshold(uint256 epoch, uint256 threshold) internal {
        _setUint(_getOperatorThresholdKey(epoch), threshold);
    }

    function _setIsOperator(
        uint256 epoch,
        address account,
        bool isOperator
    ) internal {
        _setBool(_getIsOperatorKey(epoch, account), isOperator);
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
        (address[] memory newOwners, uint256 newThreshold) = abi.decode(params, (address[], uint256));

        uint256 epoch = _ownerEpoch();

        emit OwnershipTransferred(owners(epoch), _getOwnerThreshold(epoch), newOwners, newThreshold);

        _setOwnerEpoch(++epoch);
        _setOwners(epoch, newOwners, newThreshold);
    }

    function transferOperatorship(bytes calldata params, bytes32) external onlySelf {
        (address[] memory newOperators, uint256 newThreshold) = abi.decode(params, (address[], uint256));

        uint256 epoch = _operatorEpoch();

        emit OperatorshipTransferred(operators(epoch), _getOperatorThreshold(epoch), newOperators, newThreshold);

        _setOperatorEpoch(++epoch);
        _setOperators(epoch, newOperators, newThreshold);
    }

    /**************************\
    |* External Functionality *|
    \**************************/

    function setup(bytes calldata params) external override {
        // Prevent setup from being called on a non-proxy (the implementation).
        if (implementation() == address(0)) revert NotProxy();

        (
            address[] memory adminAddresses,
            uint256 newAdminThreshold,
            address[] memory ownerAddresses,
            uint256 newOwnerThreshold,
            address[] memory operatorAddresses,
            uint256 newOperatorThreshold
        ) = abi.decode(params, (address[], uint256, address[], uint256, address[], uint256));

        uint256 newAdminEpoch = _adminEpoch() + uint256(1);
        _setAdminEpoch(newAdminEpoch);
        _setAdmins(newAdminEpoch, adminAddresses, newAdminThreshold);

        uint256 newOwnerEpoch = _ownerEpoch() + uint256(1);
        _setOwnerEpoch(newOwnerEpoch);
        _setOwners(newOwnerEpoch, ownerAddresses, newOwnerThreshold);

        uint256 newOperatorEpoch = _operatorEpoch() + uint256(1);
        _setOperatorEpoch(newOperatorEpoch);
        _setOperators(newOperatorEpoch, operatorAddresses, newOperatorThreshold);

        emit OwnershipTransferred(new address[](uint256(0)), uint256(0), ownerAddresses, newOwnerThreshold);
        emit OperatorshipTransferred(new address[](uint256(0)), uint256(0), operatorAddresses, newOperatorThreshold);
    }

    function execute(bytes calldata input) external override {
        (bytes memory data, bytes[] memory signatures) = abi.decode(input, (bytes, bytes[]));

        _execute(data, signatures);
    }

    function _execute(bytes memory data, bytes[] memory signatures) internal {
        uint256 signatureCount = signatures.length;

        address[] memory signers = new address[](signatureCount);

        for (uint256 i; i < signatureCount; i++) {
            signers[i] = ECDSA.recover(ECDSA.toEthSignedMessageHash(keccak256(data)), signatures[i]);
        }

        (
            uint256 chainId,
            Role signersRole,
            bytes32[] memory commandIds,
            string[] memory commands,
            bytes[] memory params
        ) = abi.decode(data, (uint256, Role, bytes32[], string[], bytes[]));

        if (chainId != block.chainid) revert InvalidChainId();

        if (!_isSortedAscAndContainsNoDuplicate(signers)) revert MalformedSigners();

        uint256 commandsLength = commandIds.length;

        if (commandsLength != commands.length || commandsLength != params.length) revert InvalidCommands();

        bool areValidCurrentOwners;
        bool areValidRecentOwners;
        bool areValidRecentOperators;

        if (signersRole == Role.Owner) {
            areValidCurrentOwners = _areValidOwnersInEpoch(_ownerEpoch(), signers);
            areValidRecentOwners = areValidCurrentOwners || _areValidPreviousOwners(signers);
        } else if (signersRole == Role.Operator) {
            areValidRecentOperators = _areValidRecentOperators(signers);
        }

        for (uint256 i; i < commandsLength; i++) {
            bytes32 commandId = commandIds[i];

            if (isCommandExecuted(commandId)) continue; /* Ignore if duplicate commandId received */

            bytes4 commandSelector;
            bytes32 commandHash = keccak256(abi.encodePacked(commands[i]));

            if (commandHash == SELECTOR_DEPLOY_TOKEN) {
                if (!areValidRecentOwners) continue;

                commandSelector = AxelarGatewayMultisig.deployToken.selector;
            } else if (commandHash == SELECTOR_MINT_TOKEN) {
                if (!areValidRecentOperators && !areValidRecentOwners) continue;

                commandSelector = AxelarGatewayMultisig.mintToken.selector;
            } else if (commandHash == SELECTOR_APPROVE_CONTRACT_CALL) {
                if (!areValidRecentOperators && !areValidRecentOwners) continue;

                commandSelector = AxelarGatewayMultisig.approveContractCall.selector;
            } else if (commandHash == SELECTOR_APPROVE_CONTRACT_CALL_WITH_MINT) {
                if (!areValidRecentOperators && !areValidRecentOwners) continue;

                commandSelector = AxelarGatewayMultisig.approveContractCallWithMint.selector;
            } else if (commandHash == SELECTOR_BURN_TOKEN) {
                if (!areValidRecentOperators && !areValidRecentOwners) continue;

                commandSelector = AxelarGatewayMultisig.burnToken.selector;
            } else if (commandHash == SELECTOR_TRANSFER_OWNERSHIP) {
                if (!areValidCurrentOwners) continue;

                commandSelector = AxelarGatewayMultisig.transferOwnership.selector;
            } else if (commandHash == SELECTOR_TRANSFER_OPERATORSHIP) {
                if (!areValidCurrentOwners) continue;

                commandSelector = AxelarGatewayMultisig.transferOperatorship.selector;
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
