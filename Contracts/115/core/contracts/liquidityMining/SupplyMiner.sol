// SPDX-License-Identifier: MIT

pragma experimental ABIEncoderV2;
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "./GenericMiner.sol";
import "./interfaces/ISupplyMiner.sol";
import "../governance/interfaces/IGovernanceAddressProvider.sol";

contract SupplyMiner is ISupplyMiner, GenericMiner {
  using SafeMath for uint256;

  constructor(IGovernanceAddressProvider _addresses) public GenericMiner(_addresses) {}

  modifier onlyNotifier() {
    require(msg.sender == address(a.debtNotifier()), "Caller is not DebtNotifier");
    _;
  }

  /**
    Gets called by the `DebtNotifier` and will update the stake of the user
    to match his current outstanding debt by using his baseDebt.
    @param user address of the user.
    @param newBaseDebt the new baseDebt and therefore stake for the user.
  */
  function baseDebtChanged(address user, uint256 newBaseDebt) public override onlyNotifier {
    _updateStake(user, newBaseDebt);
  }
}
