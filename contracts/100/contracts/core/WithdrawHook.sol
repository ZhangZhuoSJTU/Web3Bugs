// SPDX-License-Identifier: UNLICENSED
import "./interfaces/IHook.sol";
import "./interfaces/ICollateralDepositRecord.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

pragma solidity =0.8.7;

contract WithdrawHook is IHook, Ownable {
    address private _vault;
    ICollateralDepositRecord private _depositRecord;

    constructor(address _newDepositRecord) {
        _depositRecord = ICollateralDepositRecord(_newDepositRecord);
    }

    modifier onlyVault() {
        require(msg.sender == _vault, "Caller is not the vault");
        _;
    }

    function hook(
        address _sender,
        uint256 _initialAmount,
        uint256 _finalAmount
    ) external override onlyVault {
        _depositRecord.recordWithdrawal(_sender, _finalAmount);
    }

    function setVault(address _newVault) external override onlyOwner {
        _vault = _newVault;
        emit VaultChanged(_newVault);
    }

    function getVault() external view returns (address) {
        return _vault;
    }

    function getDepositRecord()
        external
        view
        returns (ICollateralDepositRecord)
    {
        return _depositRecord;
    }
}
