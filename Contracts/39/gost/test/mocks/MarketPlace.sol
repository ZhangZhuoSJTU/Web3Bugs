// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.4;

/// @dev MarketPlace is a mock whose bindings are imported by unit tests in any pkg/*testing that needs it
contract MarketPlace {
  struct MethodArgs {
    uint256 maturity;
    address one; // is sender or maker depending on method
    address two; // same as above
    uint256 amount;
  }

  mapping (address => uint256) public cTokenAddressCalled;
  mapping (address => MethodArgs) public custodialInitiateCalled;
  mapping (address => MethodArgs) public custodialExitCalled;
  mapping (address => MethodArgs) public p2pZcTokenExchangeCalled;
  mapping (address => MethodArgs) public p2pVaultExchangeCalled;
  mapping (address => MethodArgs) public mintZcTokenAddingNotionalCalled;
  mapping (address => MethodArgs) public burnZcTokenRemovingNotionalCalled;
  mapping (address => MethodArgs) public transferVaultNotionalFeeCalled;
  mapping (address => MethodArgs) public redeemZcTokenCalled;
  mapping (address => MethodArgs) public redeemVaultInterestCalled;

  address private cTokenAddr;
  bool private custodialInitiateReturn;
  bool private custodialExitReturn;
  bool private p2pZcTokenExchangeReturn;
  bool private p2pVaultExchangeReturn;
  bool private mintZcTokenAddingNotionalReturn;
  bool private burnZcTokenRemovingNotionalReturn;
  bool private transferVaultNotionalFeeReturn;
  uint256 private redeemZcTokenReturn;
  uint256 private redeemVaultInterestReturn;

  function cTokenAddressReturns(address a) external {
    cTokenAddr = a;
  }

  function cTokenAddress(address u, uint256 m) external returns (address) {
    cTokenAddressCalled[u] = m;
    return cTokenAddr;
  }

  function custodialInitiateReturns(bool b) external {
    custodialInitiateReturn = b;
  }

  // called by swivel IVFZI && IZFVI 
  // call with underlying, maturity, mint-target, add-notional-target and an amount
  function custodialInitiate(address u, uint256 m, address o, address t, uint256 a) external returns (bool) {
    MethodArgs memory args; 
    args.maturity = m;
    args.one = o; // will be the recipient of minted zctoken
    args.two = t; // will be the recipient of added notional
    args.amount = a; // the amount of minted zctoken and notional added
    custodialInitiateCalled[u] = args;

    return custodialInitiateReturn;
  }

  function custodialExitReturns(bool b) external {
    custodialExitReturn = b;
  }

  // called by swivel EVFZE FF EZFVE
  // call with underlying, maturity, burn-target, remove-notional-target and an amount
  function custodialExit(address u, uint256 m, address o, address t, uint256 a) external returns (bool) {
    MethodArgs memory args; 
    args.maturity = m;
    args.one = o; // will be the burn-from target
    args.two = t; // will be the remove-notional target
    args.amount = a; // zctoken burned, notional removed
    custodialExitCalled[u] = args;

    return custodialExitReturn;
  }

  function p2pZcTokenExchangeReturns(bool b) external {
    p2pZcTokenExchangeReturn = b;
  }

  // called by swivel IZFZE, EZFZI
  // call with underlying, maturity, transfer-from, transfer-to, amount
  function p2pZcTokenExchange(address u, uint256 m, address o, address t, uint256 a) external returns (bool) {
    MethodArgs memory args;
    args.maturity = m;
    args.one = o;
    args.two = t;
    args.amount = a;
    p2pZcTokenExchangeCalled[u] = args;

    return p2pZcTokenExchangeReturn;
  }

  function p2pVaultExchangeReturns(bool b) external {
    p2pVaultExchangeReturn = b;
  }

  // called by swivel IVFVE, EVFVI
  // call with underlying, maturity, remove-from, add-to, amount
  function p2pVaultExchange(address u, uint256 m, address o, address t, uint256 a) external returns (bool) {
    MethodArgs memory args;
    args.maturity = m;
    args.one = o;
    args.two = t;
    args.amount = a;
    p2pVaultExchangeCalled[u] = args;

    return p2pVaultExchangeReturn;
  }

  function mintZcTokenAddingNotionalReturns(bool b) external {
    mintZcTokenAddingNotionalReturn = b;
  }

  // call with underlying, maturity, mint-to, amount
  function mintZcTokenAddingNotional(address u, uint256 m, address t, uint256 a) external returns (bool) {
    MethodArgs memory args;
    args.maturity = m;
    args.one = t;
    args.amount = a;
    mintZcTokenAddingNotionalCalled[u] = args;

    return mintZcTokenAddingNotionalReturn;
  }

  function burnZcTokenRemovingNotionalReturns(bool b) external {
    burnZcTokenRemovingNotionalReturn = b;
  }

  // call with underlying, maturity, mint-to, amount
  function burnZcTokenRemovingNotional(address u, uint256 m, address t, uint256 a) external returns (bool) {
    MethodArgs memory args;
    args.maturity = m;
    args.one = t;
    args.amount = a;
    burnZcTokenRemovingNotionalCalled[u] = args;

    return burnZcTokenRemovingNotionalReturn;
  }

  function transferVaultNotionalFeeReturns(bool b) external {
    transferVaultNotionalFeeReturn = b;
  }

  function transferVaultNotionalFee(address u, uint256 m, address f, uint256 a) external returns (bool) {
    MethodArgs memory args;
    args.maturity = m;
    args.one = f;
    args.amount = a;
    transferVaultNotionalFeeCalled[u] = args;

    return transferVaultNotionalFeeReturn;
  }

  function redeemZcTokenReturns(uint256 a) external {
    redeemZcTokenReturn = a;
  }

  function redeemZcToken(address u, uint256 m, address t, uint256 a) external returns (uint256) {
    MethodArgs memory args;
    args.maturity = m;
    args.one = t;
    args.amount = a;
    redeemZcTokenCalled[u] = args;

    return redeemZcTokenReturn;
  }

  function redeemVaultInterestReturns(uint256 a) external {
    redeemVaultInterestReturn = a;
  }

  function redeemVaultInterest(address u, uint256 m, address t) external returns (uint256) {
    MethodArgs memory args;
    args.maturity = m;
    args.one = t;
    redeemVaultInterestCalled[u] = args;

    return redeemVaultInterestReturn;
  }
}
