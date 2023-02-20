// SPDX-License-Identifier: UNLICENSED
import "./interfaces/IHook.sol";
import "./interfaces/IAccountAccessController.sol";
import "./interfaces/ICollateralDepositRecord.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

pragma solidity =0.8.7;

contract DepositHook is IHook, Ownable {
    address private _vault;
    IAccountAccessController private _accountAccessController;
    ICollateralDepositRecord private _depositRecord;

    constructor(address _newAccessController, address _newDepositRecord) {
        _accountAccessController = IAccountAccessController(
            _newAccessController
        );
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
        require(
            _accountAccessController.isAccountAllowed(_sender) &&
                !_accountAccessController.isAccountBlocked(_sender),
            "Account not allowed to deposit"
        );
        _depositRecord.recordDeposit(_sender, _finalAmount);
    }

    function setVault(address _newVault) external override onlyOwner {
        _vault = _newVault;
        emit VaultChanged(_newVault);
    }

    function getVault() external view returns (address) {
        return _vault;
    }

    function getAccountAccessController()
        external
        view
        returns (IAccountAccessController)
    {
        return _accountAccessController;
    }

    function getDepositRecord()
        external
        view
        returns (ICollateralDepositRecord)
    {
        return _depositRecord;
    }
}
