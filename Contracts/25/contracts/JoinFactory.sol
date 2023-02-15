// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.1;

import "./interfaces/vault/IJoinFactory.sol";
import "./utils/access/AccessControl.sol";
import "./Join.sol";


/// @dev The JoinFactory creates new join instances.
contract JoinFactory is IJoinFactory, AccessControl {

  /// @dev Deploys a new join.
  /// @param asset Address of the asset token.
  /// @return join The join address.
  function createJoin(address asset)
    external override
    auth
    returns (address)
  {
    Join join = new Join(asset);

    join.grantRole(join.ROOT(), msg.sender);
    join.renounceRole(join.ROOT(), address(this));
    
    emit JoinCreated(asset, address(join));

    return address(join);
  }
}