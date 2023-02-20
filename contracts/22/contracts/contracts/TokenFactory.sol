// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.3;

import "./SyntheticToken.sol";
import "./interfaces/ITokenFactory.sol";

/// @title TokenFactory
/// @notice contract is used to reliably mint the synthetic tokens used by the float protocol.
contract TokenFactory is ITokenFactory {
  /*╔═══════════════════════════╗
    ║           STATE           ║
    ╚═══════════════════════════╝*/

  /// @notice address of long short contract
  address public longShort;

  /// @notice admin role hash for the synthetic token
  bytes32 public constant DEFAULT_ADMIN_ROLE = keccak256("DEFAULT_ADMIN_ROLE");
  /// @notice minter role hash for the synthetic token
  bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
  /// @notice pauser role hash for the synthetic token
  bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

  /*╔═══════════════════════════╗
    ║         MODIFIERS         ║
    ╚═══════════════════════════╝*/

  /// @dev only allow longShort contract to call this function
  modifier onlyLongShort() {
    require(msg.sender == address(longShort));
    _;
  }

  /*╔════════════════════════════╗
    ║           SET-UP           ║
    ╚════════════════════════════╝*/

  /// @notice sets the address of the longShort contract on initialization
  /// @param _longShort address of the longShort contract
  constructor(address _longShort) {
    longShort = _longShort;
  }

  /*╔════════════════════════════╗
    ║       TOKEN CREATION       ║
    ╚════════════════════════════╝*/

  /// @notice creates and sets up a new synthetic token
  /// @param syntheticName name of the synthetic token
  /// @param syntheticSymbol ticker symbol of the synthetic token
  /// @param staker address of the staker contract
  /// @param marketIndex market index this synthetic token belongs to
  /// @param isLong boolean denoting if the synthetic token is long or short
  /// @return syntheticToken - address of the created synthetic token
  function createSyntheticToken(
    string calldata syntheticName,
    string calldata syntheticSymbol,
    address staker,
    uint32 marketIndex,
    bool isLong
  ) external override onlyLongShort returns (address syntheticToken) {
    syntheticToken = address(
      new SyntheticToken(syntheticName, syntheticSymbol, longShort, staker, marketIndex, isLong)
    );

    // Give minter roles
    SyntheticToken(syntheticToken).grantRole(DEFAULT_ADMIN_ROLE, longShort);
    SyntheticToken(syntheticToken).grantRole(MINTER_ROLE, longShort);
    SyntheticToken(syntheticToken).grantRole(PAUSER_ROLE, longShort);

    // Revoke roles
    SyntheticToken(syntheticToken).revokeRole(DEFAULT_ADMIN_ROLE, address(this));
    SyntheticToken(syntheticToken).revokeRole(MINTER_ROLE, address(this));
    SyntheticToken(syntheticToken).revokeRole(PAUSER_ROLE, address(this));
  }
}
