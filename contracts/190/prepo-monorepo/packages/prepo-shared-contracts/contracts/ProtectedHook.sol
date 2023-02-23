// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "./SafeOwnable.sol";
import "./interfaces/IProtectedHook.sol";

contract ProtectedHook is IProtectedHook, SafeOwnable {
  address private _allowedContract;

  modifier onlyAllowedContract() {
    require(_msgSender() == _allowedContract, "msg.sender != allowed contract");
    _;
  }

  function setAllowedContract(address _newAllowedContract) external override onlyOwner {
    _allowedContract = _newAllowedContract;
    emit AllowedContractChange(_newAllowedContract);
  }

  function getAllowedContract() external view override returns (address) {
    return _allowedContract;
  }
}
