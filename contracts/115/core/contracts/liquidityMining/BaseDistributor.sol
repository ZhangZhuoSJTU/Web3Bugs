// SPDX-License-Identifier: MIT

pragma experimental ABIEncoderV2;
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../libraries/WadRayMath.sol";
import "../governance/interfaces/IGovernanceAddressProvider.sol";
import "./interfaces/IBaseDistributor.sol";

/*
  	Distribution Formula:
  	55.5m MIMO in first week
  	-5.55% redution per week

  	total(timestamp) = _SECONDS_PER_WEEK * ( (1-weeklyR^(timestamp/_SECONDS_PER_WEEK)) / (1-weeklyR) )
  		+ timestamp % _SECONDS_PER_WEEK * (1-weeklyR^(timestamp/_SECONDS_PER_WEEK)
  */

abstract contract BaseDistributor is IBaseDistributor {
  using SafeMath for uint256;
  using WadRayMath for uint256;

  uint256 public override totalShares;
  mapping(address => uint256) public override shares;
  address[] public payees;

  IGovernanceAddressProvider public override a;

  modifier onlyManager() {
    require(a.controller().hasRole(a.controller().MANAGER_ROLE(), msg.sender), "Caller is not Manager");
    _;
  }

  /**
    Public function to release the accumulated new MIMO tokens to the payees.
    @dev anyone can call this.
  */
  function release() public override {
    uint256 newTokens = mintableTokens();
    require(newTokens > 0, "newTokens is 0");
    require(payees.length > 0, "Payees not configured yet");
    // Mint MIMO to all receivers
    for (uint256 i = 0; i < payees.length; i++) {
      address payee = payees[i];
      _release(newTokens, payee);
    }
    emit TokensReleased(newTokens, now);
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

    if (payees.length > 0 && mintableTokens() > 0) {
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

  /**
    Get current configured payees.
    @return array of current payees.
  */
  function getPayees() public view override returns (address[] memory) {
    return payees;
  }

  /**
    Calculates how many MIMO tokens can be minted since the last time tokens were minted
    @return number of mintable tokens available right now.
  */
  function mintableTokens() public view virtual override returns (uint256);

  /**
    Internal function to release a percentage of newTokens to a specific payee
    @dev uses totalShares to calculate correct share
    @param _totalnewTokensReceived Total newTokens for all payees, will be split according to shares
    @param _payee The address of the payee to whom to distribute the fees.
  */
  function _release(uint256 _totalnewTokensReceived, address _payee) internal virtual;

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
}
