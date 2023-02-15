// SPDX-License-Identifier: UNLICENSED

/**
  CErc20 is a mock compound token with stubs of the methods we need for testing.
*/

pragma solidity 0.8.4;

// TODO this could inherit from the ERC20 mock if needed
contract CErc20 {
  /// @dev allows us to dictate return from mint().
  uint256 private mintReturn;
  /// @dev the last amount mint was called with
  uint256 public mintCalled;

  /// @dev allows us to dictate return from redeem().
  uint256 private redeemReturn;
  /// @dev the last amount redeem was called with
  uint256 public redeemCalled;

  /// @dev allows us to dictate return from redeemUnderlying().
  uint256 private redeemUnderlyingReturn;
  /// @dev the last amount redeemUnderlying was called with
  uint256 public redeemUnderlyingCalled;

  /// @dev allows us to dictate return from exchangeRateCurrent().
  uint256 private exchangeRateCurrentReturn;

  function mint(uint256 n) public returns (uint256) {
    mintCalled = n;
    return mintReturn;
  }

  function mintReturns(uint256 n) public {
    mintReturn = n;
  }

  function redeem(uint256 n) public returns (uint256) {
    redeemCalled = n;
    return redeemReturn;
  }

  function redeemReturns(uint256 n) public {
    redeemReturn = n;
  }

  function redeemUnderlying(uint256 n) public returns (uint256) {
    redeemUnderlyingCalled = n;
    return redeemUnderlyingReturn;
  }

  function redeemUnderlyingReturns(uint256 n) public {
    redeemUnderlyingReturn = n;
  }

  function exchangeRateCurrent() public view returns (uint256) {
    return exchangeRateCurrentReturn;
  }

  function exchangeRateCurrentReturns(uint256 n) public {
    exchangeRateCurrentReturn = n;
  }

}
