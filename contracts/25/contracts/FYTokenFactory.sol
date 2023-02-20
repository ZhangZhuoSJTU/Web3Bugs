// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.1;

import "./interfaces/vault/IOracle.sol";
import "./interfaces/vault/IJoin.sol";
import "./interfaces/vault/IFYTokenFactory.sol";
import "./utils/access/AccessControl.sol";
import "./FYToken.sol";


/// @dev The FYTokenFactory creates new FYToken instances.
contract FYTokenFactory is IFYTokenFactory, AccessControl {

  /// @dev Deploys a new fyToken.
  /// @return fyToken The fyToken address.
  function createFYToken(
    bytes6 baseId,
    IOracle oracle,
    IJoin baseJoin,
    uint32 maturity,
    string memory name,
    string memory symbol
  )
    external override
    auth
    returns (address)
  {
    FYToken fyToken = new FYToken(
      baseId,
      oracle,
      baseJoin,
      maturity,
      name,     // Derive from base and maturity, perhaps
      symbol    // Derive from base and maturity, perhaps
    );

    fyToken.grantRole(fyToken.ROOT(), msg.sender);
    fyToken.renounceRole(fyToken.ROOT(), address(this));
    
    emit FYTokenCreated(address(fyToken), baseJoin.asset(), maturity);

    return address(fyToken);
  }
}