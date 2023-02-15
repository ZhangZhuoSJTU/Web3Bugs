// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.8.4;

import "./Abstracts.sol";

contract VaultTracker {
  struct Vault {
    uint256 notional;
    uint256 redeemable;
    uint256 exchangeRate;
  }

  mapping(address => Vault) public vaults;

  address public immutable admin;
  address public immutable cTokenAddr;
  address public immutable swivel;
  bool public matured;
  uint256 public immutable maturity;
  uint256 public maturityRate;

  /// @param m Maturity timestamp of the new market
  /// @param c cToken address associated with underlying for the new market
  /// @param s address of the deployed swivel contract
  constructor(uint256 m, address c, address s) {
    admin = msg.sender;
    maturity = m;
    cTokenAddr = c;
    swivel = s;
  }

  /// @notice Adds notional (nTokens) to a given user's vault
  /// @param o Address that owns a vault
  /// @param a Amount of notional added
  function addNotional(address o, uint256 a) public onlyAdmin(admin) returns (bool) {
    uint256 exchangeRate = CErc20(cTokenAddr).exchangeRateCurrent();

    Vault memory vlt = vaults[o];

    if (vlt.notional > 0) {
      uint256 yield;
      uint256 interest;

      // if market has matured, calculate marginal interest between the maturity rate and previous position exchange rate
      // otherwise, calculate marginal exchange rate between current and previous exchange rate.
      if (matured) { // Calculate marginal interest
        yield = ((maturityRate * 1e26) / vlt.exchangeRate) - 1e26;
      } else {
        yield = ((exchangeRate * 1e26) / vlt.exchangeRate) - 1e26;
      }

      interest = (yield * vlt.notional) / 1e26;
      // add interest and amount to position, reset cToken exchange rate
      vlt.redeemable += interest;
      vlt.notional += a;
    } else {
      vlt.notional = a;
    }

    vlt.exchangeRate = exchangeRate;
    vaults[o] = vlt;

    return true;
  }

  /// @notice Removes notional (nTokens) from a given user's vault
  /// @param o Address that owns a vault
  /// @param a Amount of notional to remove
  function removeNotional(address o, uint256 a) public onlyAdmin(admin) returns (bool) {

    Vault memory vlt = vaults[o];

    require(vlt.notional >= a, "amount exceeds vault balance");

    uint256 yield;
    uint256 interest;
    uint256 exchangeRate = CErc20(cTokenAddr).exchangeRateCurrent();

    // if market has matured, calculate marginal interest between the maturity rate and previous position exchange rate
    // otherwise, calculate marginal exchange rate between current and previous exchange rate.
    if (matured) { // Calculate marginal interest
      yield = ((maturityRate * 1e26) / vlt.exchangeRate) - 1e26;
    } else {
      // calculate marginal interest
      yield = ((exchangeRate * 1e26) / vlt.exchangeRate) - 1e26;
    }

    interest = (yield * vlt.notional) / 1e26;
    // remove amount from position, Add interest to position, reset cToken exchange rate
    vlt.redeemable += interest;
    vlt.notional -= a;
    vlt.exchangeRate = exchangeRate;

    vaults[o] = vlt;

    return true;
  }

  /// @notice Redeem's the `redeemable` + marginal interest from a given user's vault
  /// @param o Address that owns a vault
  function redeemInterest(address o) external onlyAdmin(admin) returns (uint256) {

    Vault memory vlt = vaults[o];

    uint256 redeemable = vlt.redeemable;
    uint256 yield;
    uint256 interest;
    uint256 exchangeRate = CErc20(cTokenAddr).exchangeRateCurrent();

    // if market has matured, calculate marginal interest between the maturity rate and previous position exchange rate
    // otherwise, calculate marginal exchange rate between current and previous exchange rate.
    if (matured) { // Calculate marginal interest
      yield = ((maturityRate * 1e26) / vlt.exchangeRate) - 1e26;
    } else {
      // calculate marginal interest
      yield = ((exchangeRate * 1e26) / vlt.exchangeRate) - 1e26;
    }

    interest = (yield * vlt.notional) / 1e26;

    vlt.exchangeRate = exchangeRate;
    vlt.redeemable = 0;

    vaults[o] = vlt;

    // return adds marginal interest to previously accrued redeemable interest
    return (redeemable + interest);
  }

  /// @notice Matures the vault and sets the market's maturityRate
  function matureVault() external onlyAdmin(admin) returns (bool) {
    require(!matured, 'already matured');
    require(block.timestamp >= maturity, 'maturity has not been reached');
    matured = true;
    maturityRate = CErc20(cTokenAddr).exchangeRateCurrent();
    return true;
  }

  /// @notice Transfers notional (nTokens) from one user to another
  /// @param f Owner of the amount
  /// @param t Recipient of the amount
  /// @param a Amount to transfer
  function transferNotionalFrom(address f, address t, uint256 a) external onlyAdmin(admin) returns (bool) {
    Vault memory from = vaults[f];
    Vault memory to = vaults[t];

    require(from.notional >= a, "amount exceeds available balance");

    uint256 yield;
    uint256 interest;
    uint256 exchangeRate = CErc20(cTokenAddr).exchangeRateCurrent();

    // if market has matured, calculate marginal interest between the maturity rate and previous position exchange rate
    // otherwise, calculate marginal exchange rate between current and previous exchange rate.
    if (matured) { 
      // calculate marginal interest
      yield = ((maturityRate * 1e26) / from.exchangeRate) - 1e26;
    } else {
      yield = ((exchangeRate * 1e26) / from.exchangeRate) - 1e26;
    }

    interest = (yield * from.notional) / 1e26;
    // remove amount from position, Add interest to position, reset cToken exchange rate
    from.redeemable += interest;
    from.notional -= a;
    from.exchangeRate = exchangeRate;

    vaults[f] = from;

    // transfer notional to address "t", calculate interest if necessary
    if (to.notional > 0) {
      uint256 newVaultInterest;

      // if market has matured, calculate marginal interest between the maturity rate and previous position exchange rate
      // otherwise, calculate marginal exchange rate between current and previous exchange rate.
      if (matured) { 
        // calculate marginal interest
        yield = ((maturityRate * 1e26) / to.exchangeRate) - 1e26;
      } else {
        yield = ((exchangeRate * 1e26) / to.exchangeRate) - 1e26;
      }

      newVaultInterest = (yield * to.notional) / 1e26;
      // add interest and amount to position, reset cToken exchange rate
      to.redeemable += newVaultInterest;
      to.notional += a;
    } else {
      to.notional += a;
    }

    to.exchangeRate = exchangeRate;
    vaults[t] = to;

    return true;
  }

  /// @notice transfers, in notional, a fee payment to the Swivel contract without recalculating marginal interest for the owner
  /// @param f Owner of the amount
  /// @param a Amount to transfer
  function transferNotionalFee(address f, uint256 a) external onlyAdmin(admin) returns(bool) {
    Vault memory oVault = vaults[f];
    Vault memory sVault = vaults[swivel];

    // remove notional from its owner
    oVault.notional -= a;

    uint256 exchangeRate = CErc20(cTokenAddr).exchangeRateCurrent();
    uint256 yield;
    uint256 interest;

    // check if exchangeRate has been stored already this block. If not, calculate marginal interest + store exchangeRate
    if (sVault.exchangeRate != exchangeRate) {
      // the rate will be 0 if swivel did not already have a vault
      if (sVault.exchangeRate != 0) {
        // if market has matured, calculate marginal interest between the maturity rate and previous position exchange rate
        // otherwise, calculate marginal exchange rate between current and previous exchange rate.
        if (matured) { 
          // calculate marginal interest
            yield = ((maturityRate * 1e26) / sVault.exchangeRate) - 1e26;
        } else {
            yield = ((exchangeRate * 1e26) / sVault.exchangeRate) - 1e26;
        }

        interest = (yield * sVault.notional) / 1e26;
        // add interest and amount, reset cToken exchange rate
        sVault.redeemable += interest;
      }
      sVault.exchangeRate = exchangeRate;
    }

    // add notional to swivel's vault
    sVault.notional += a;

    // store the adjusted vaults
    vaults[swivel] = sVault;
    vaults[f] = oVault;
    return true;
  }

  /// @notice Returns both relevant balances for a given user's vault
  /// @param o Address that owns a vault
  function balancesOf(address o) public view returns (uint256, uint256) {
    return (vaults[o].notional, vaults[o].redeemable);
  }

  modifier onlyAdmin(address a) {
    require(msg.sender == a, 'sender must be admin');
    _;
  }
}
