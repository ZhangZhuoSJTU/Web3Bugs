// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity =0.8.7;

/**
 * @title   Governable
 * @author  mStable
 * @notice  Simple contract implementing an Ownable pattern.
 * @dev     Derives from V2.3.0 @openzeppelin/contracts/ownership/Ownable.sol
 *          Modified to have custom name and features
 *              - Removed `renounceOwnership`
 *              - Changes `_owner` to `_governor`
 *          VERSION: 1.1
 *          DATE:    2021-04-15
 */
contract Governable {
  event GovernorChanged(
    address indexed previousGovernor,
    address indexed newGovernor
  );

  address private _governor;

  /**
   * @dev Initializes the contract setting the deployer as the initial Governor.
   */
  constructor() {
    _governor = msg.sender;
    emit GovernorChanged(address(0), _governor);
  }

  /**
   * @dev Returns the address of the current Governor.
   */
  function governor() public view virtual returns (address) {
    return _governor;
  }

  /**
   * @dev Throws if called by any account other than the Governor.
   */
  modifier onlyGovernor() {
    require(isGovernor(), "GOV: caller is not the Governor");
    _;
  }

  /**
   * @dev Returns true if the caller is the current Governor.
   */
  function isGovernor() public view returns (bool) {
    return msg.sender == _governor;
  }

  /**
   * @dev Transfers Governance of the contract to a new account (`newGovernor`).
   * Can only be called by the current Governor.
   * @param _newGovernor Address of the new Governor
   */
  function changeGovernor(address _newGovernor) external virtual onlyGovernor {
    _changeGovernor(_newGovernor);
  }

  /**
   * @dev Change Governance of the contract to a new account (`newGovernor`).
   * @param _newGovernor Address of the new Governor
   */
  function _changeGovernor(address _newGovernor) internal {
    require(_newGovernor != address(0), "GOV: new Governor is address(0)");
    emit GovernorChanged(_governor, _newGovernor);
    _governor = _newGovernor;
  }
}
