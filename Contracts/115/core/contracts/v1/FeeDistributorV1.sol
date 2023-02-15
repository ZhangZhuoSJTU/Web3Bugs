// SPDX-License-Identifier: MIT

pragma experimental ABIEncoderV2;
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../libraries/WadRayMath.sol";
import "../interfaces/ISTABLEX.sol";
import "./interfaces/IFeeDistributorV1.sol";
import "./interfaces/IAddressProviderV1.sol";

contract FeeDistributorV1 is IFeeDistributorV1, ReentrancyGuard {
  using SafeMath for uint256;

  event PayeeAdded(address account, uint256 shares);
  event FeeReleased(uint256 income, uint256 releasedAt);

  uint256 public override lastReleasedAt;
  IAddressProviderV1 public override a;

  uint256 public override totalShares;
  mapping(address => uint256) public override shares;
  address[] public payees;

  modifier onlyManager() {
    require(a.controller().hasRole(a.controller().MANAGER_ROLE(), msg.sender), "Caller is not Manager");
    _;
  }

  constructor(IAddressProviderV1 _addresses) public {
    require(address(_addresses) != address(0));
    a = _addresses;
  }

  /**
    Public function to release the accumulated fee income to the payees.
    @dev anyone can call this.
  */
  function release() public override nonReentrant {
    uint256 income = a.core().availableIncome();
    require(income > 0, "income is 0");
    require(payees.length > 0, "Payees not configured yet");
    lastReleasedAt = now;

    // Mint USDX to all receivers
    for (uint256 i = 0; i < payees.length; i++) {
      address payee = payees[i];
      _release(income, payee);
    }
    emit FeeReleased(income, lastReleasedAt);
  }

  /**
    Get current configured payees.
    @return array of current payees.
  */
  function getPayees() public view override returns (address[] memory) {
    return payees;
  }

  /**
    Internal function to release a percentage of income to a specific payee
    @dev uses totalShares to calculate correct share
    @param _totalIncomeReceived Total income for all payees, will be split according to shares
    @param _payee The address of the payee to whom to distribute the fees.
  */
  function _release(uint256 _totalIncomeReceived, address _payee) internal {
    uint256 payment = _totalIncomeReceived.mul(shares[_payee]).div(totalShares);
    a.stablex().mint(_payee, payment);
  }

  /**
    Internal function to add a new payee.
    @dev will update totalShares and therefore reduce the relative share of all other payees.
    @param _payee The address of the payee to add.
    @param _shares The number of shares owned by the payee.
  */
  function _addPayee(address _payee, uint256 _shares) internal {
    require(_payee != address(0), "payee is the zero address");
    require(_shares > 0, "shares are 0");
    require(shares[_payee] == 0, "payee already has shares");

    payees.push(_payee);
    shares[_payee] = _shares;
    totalShares = totalShares.add(_shares);
    emit PayeeAdded(_payee, _shares);
  }

  /**
    Updates the payee configuration to a new one.
    @dev will release existing fees before the update.
    @param _payees Array of payees
    @param _shares Array of shares for each payee
  */
  function changePayees(address[] memory _payees, uint256[] memory _shares) public override onlyManager {
    require(_payees.length == _shares.length, "Payees and shares mismatched");
    require(_payees.length > 0, "No payees");

    uint256 income = a.core().availableIncome();
    if (income > 0 && payees.length > 0) {
      release();
    }

    for (uint256 i = 0; i < payees.length; i++) {
      delete shares[payees[i]];
    }
    delete payees;
    totalShares = 0;

    for (uint256 i = 0; i < _payees.length; i++) {
      _addPayee(_payees[i], _shares[i]);
    }
  }
}
