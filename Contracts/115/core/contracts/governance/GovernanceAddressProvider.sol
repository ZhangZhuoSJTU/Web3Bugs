// SPDX-License-Identifier: MIT

pragma experimental ABIEncoderV2;
pragma solidity 0.6.12;

import "./interfaces/IGovernanceAddressProvider.sol";
import "./interfaces/IGovernorAlpha.sol";
import "./interfaces/ITimelock.sol";
import "./interfaces/IVotingEscrow.sol";
import "../interfaces/IAccessController.sol";
import "../liquidityMining/interfaces/IDebtNotifier.sol";
import "../liquidityMining/interfaces/IMIMO.sol";

contract GovernanceAddressProvider is IGovernanceAddressProvider {
  IAddressProvider public override parallel;
  IMIMO public override mimo;
  IDebtNotifier public override debtNotifier;
  IGovernorAlpha public override governorAlpha;
  ITimelock public override timelock;
  IVotingEscrow public override votingEscrow;

  constructor(IAddressProvider _parallel) public {
    require(address(_parallel) != address(0));
    parallel = _parallel;
  }

  modifier onlyManager() {
    require(controller().hasRole(controller().MANAGER_ROLE(), msg.sender), "Caller is not a Manager");
    _;
  }

  /**
    Update the `AddressProvider` address that points to main AddressProvider
    used in the Parallel Protocol
    @dev only manager can call this.
    @param _parallel the address of the new `AddressProvider` address.
  */
  function setParallelAddressProvider(IAddressProvider _parallel) public override onlyManager {
    require(address(_parallel) != address(0));
    parallel = _parallel;
  }

  /**
    Update the `MIMO` ERC20 token address
    @dev only manager can call this.
    @param _mimo the address of the new `MIMO` token address.
  */
  function setMIMO(IMIMO _mimo) public override onlyManager {
    require(address(_mimo) != address(0));
    mimo = _mimo;
  }

  /**
    Update the `DebtNotifier` address
    @dev only manager can call this.
    @param _debtNotifier the address of the new `DebtNotifier`.
  */
  function setDebtNotifier(IDebtNotifier _debtNotifier) public override onlyManager {
    require(address(_debtNotifier) != address(0));
    debtNotifier = _debtNotifier;
  }

  /**
    Update the `GovernorAlpha` address
    @dev only manager can call this.
    @param _governorAlpha the address of the new `GovernorAlpha`.
  */
  function setGovernorAlpha(IGovernorAlpha _governorAlpha) public override onlyManager {
    require(address(_governorAlpha) != address(0));
    governorAlpha = _governorAlpha;
  }

  /**
    Update the `Timelock` address
    @dev only manager can call this.
    @param _timelock the address of the new `Timelock`.
  */
  function setTimelock(ITimelock _timelock) public override onlyManager {
    require(address(_timelock) != address(0));
    timelock = _timelock;
  }

  /**
    Update the `VotingEscrow` address
    @dev only manager can call this.
    @param _votingEscrow the address of the new `VotingEscrow`.
  */
  function setVotingEscrow(IVotingEscrow _votingEscrow) public override onlyManager {
    require(address(_votingEscrow) != address(0));
    votingEscrow = _votingEscrow;
  }

  function controller() public view override returns (IAccessController) {
    return parallel.controller();
  }
}
