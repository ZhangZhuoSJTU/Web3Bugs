// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.7;

import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IAccountAccessController.sol";

contract AccountAccessController is Ownable, IAccountAccessController {
    bytes32 private _root;
    uint16 internal _allowedAccountsIndex;
    uint16 internal _blockedAccountsIndex;
    mapping(uint16 => mapping(address => bool)) private _allowedAccounts;
    mapping(uint16 => mapping(address => bool)) private _blockedAccounts;

    constructor() {}

    function setRoot(bytes32 _newRoot) external override onlyOwner {
        _setRoot(_newRoot);
    }

    function clearAllowedAccounts() external override onlyOwner {
        _clearAllowedAccounts();
    }

    function setRootAndClearAllowedAccounts(bytes32 _newRoot)
        external
        override
        onlyOwner
    {
        _setRoot(_newRoot);
        _clearAllowedAccounts();
    }

    function clearBlockedAccounts() external override onlyOwner {
        _blockedAccountsIndex++;
        emit BlockedAccountsCleared(_blockedAccountsIndex);
    }

    function allowAccounts(address[] calldata _accounts)
        external
        override
        onlyOwner
    {
        for (uint256 _i = 0; _i < _accounts.length; _i++) {
            _allowedAccounts[_allowedAccountsIndex][_accounts[_i]] = true;
            emit AccountAllowed(_accounts[_i]);
        }
    }

    function blockAccounts(address[] calldata _accounts)
        external
        override
        onlyOwner
    {
        for (uint256 _i = 0; _i < _accounts.length; _i++) {
            _blockedAccounts[_blockedAccountsIndex][_accounts[_i]] = true;
            emit AccountBlocked(_accounts[_i]);
        }
    }

    function allowSelf(bytes32[] calldata _proof) external override {
        require(
            _allowedAccounts[_allowedAccountsIndex][msg.sender] == false,
            "Account already registered"
        );
        bytes32 _leaf = keccak256(abi.encodePacked(msg.sender));

        require(MerkleProof.verify(_proof, _root, _leaf), "Invalid proof");
        _allowedAccounts[_allowedAccountsIndex][msg.sender] = true;
        emit AccountAllowed(msg.sender);
    }

    function getRoot() external view override returns (bytes32) {
        return _root;
    }

    function isAccountAllowed(address _account)
        external
        view
        override
        returns (bool)
    {
        return _allowedAccounts[_allowedAccountsIndex][_account];
    }

    function isAccountBlocked(address _account)
        external
        view
        override
        returns (bool)
    {
        return _blockedAccounts[_blockedAccountsIndex][_account];
    }

    function _setRoot(bytes32 _newRoot) internal {
        _root = _newRoot;
        emit RootChanged(_root);
    }

    function _clearAllowedAccounts() internal {
        _allowedAccountsIndex++;
        emit AllowedAccountsCleared(_allowedAccountsIndex);
    }
}
