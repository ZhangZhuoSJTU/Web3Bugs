// SPDX-License-Identifier: MIT

pragma experimental ABIEncoderV2;
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import { SafeERC20, IERC20 } from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "../governance/interfaces/IGovernanceAddressProvider.sol";
import "./BaseDistributor.sol";

contract EthereumDistributor is BaseDistributor {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  constructor(IGovernanceAddressProvider _a) public {
    require(address(_a) != address(0));

    a = _a;
  }

  /**
    Calculates how many MIMO tokens can be minted since the last time tokens were minted
    @return number of mintable tokens available right now.
  */
  function mintableTokens() public view override returns (uint256) {
    return a.mimo().balanceOf(address(this));
  }

  /**
    Internal function to release a percentage of newTokens to a specific payee
    @dev uses totalShares to calculate correct share
    @param _totalnewTokensReceived Total newTokens for all payees, will be split according to shares
    @param _payee The address of the payee to whom to distribute the fees.
  */
  function _release(uint256 _totalnewTokensReceived, address _payee) internal override {
    uint256 payment = _totalnewTokensReceived.mul(shares[_payee]).div(totalShares);
    IERC20(a.mimo()).safeTransfer(_payee, payment);
  }
}
