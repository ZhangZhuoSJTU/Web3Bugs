// SPDX-License-Identifier: UNLICENSED
import "./interfaces/ICollateralDepositRecord.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

pragma solidity =0.8.7;

contract CollateralDepositRecord is ICollateralDepositRecord, Ownable {
    uint256 private _globalDepositCap;
    uint256 private _globalDepositAmount;
    uint256 private _accountDepositCap;
    mapping(address => uint256) private _accountToNetDeposit;
    mapping(address => bool) private _allowedHooks;

    modifier onlyAllowedHooks() {
        require(_allowedHooks[msg.sender], "Caller not allowed");
        _;
    }

    constructor(uint256 _newGlobalDepositCap, uint256 _newAccountDepositCap) {
        _globalDepositCap = _newGlobalDepositCap;
        _accountDepositCap = _newAccountDepositCap;
    }

    function recordDeposit(address _sender, uint256 _amount)
        external
        override
        onlyAllowedHooks
    {
        require(
            _amount + _globalDepositAmount <= _globalDepositCap,
            "Global deposit cap exceeded"
        );
        require(
            _amount + _accountToNetDeposit[_sender] <= _accountDepositCap,
            "Account deposit cap exceeded"
        );
        _globalDepositAmount += _amount;
        _accountToNetDeposit[_sender] += _amount;
    }

    function recordWithdrawal(address _sender, uint256 _amount)
        external
        override
        onlyAllowedHooks
    {
        if (_globalDepositAmount > _amount) {
            _globalDepositAmount -= _amount;
        } else {
            _globalDepositAmount = 0;
        }
        if (_accountToNetDeposit[_sender] > _amount) {
            _accountToNetDeposit[_sender] -= _amount;
        } else {
            _accountToNetDeposit[_sender] = 0;
        }
    }

    function setGlobalDepositCap(uint256 _newGlobalDepositCap)
        external
        override
        onlyOwner
    {
        _globalDepositCap = _newGlobalDepositCap;
        emit GlobalDepositCapChanged(_globalDepositCap);
    }

    function setAccountDepositCap(uint256 _newAccountDepositCap)
        external
        override
        onlyOwner
    {
        _accountDepositCap = _newAccountDepositCap;
        emit AccountDepositCapChanged(_newAccountDepositCap);
    }

    function setAllowedHook(address _hook, bool _allowed)
        external
        override
        onlyOwner
    {
        _allowedHooks[_hook] = _allowed;
        emit AllowedHooksChanged(_hook, _allowed);
    }

    function getGlobalDepositCap() external view override returns (uint256) {
        return _globalDepositCap;
    }

    function getGlobalDepositAmount()
        external
        view
        override
        returns (uint256)
    {
        return _globalDepositAmount;
    }

    function getAccountDepositCap() external view override returns (uint256) {
        return _accountDepositCap;
    }

    function getNetDeposit(address _account)
        external
        view
        override
        returns (uint256)
    {
        return _accountToNetDeposit[_account];
    }

    function isHookAllowed(address _hook)
        external
        view
        override
        returns (bool)
    {
        return _allowedHooks[_hook];
    }
}
