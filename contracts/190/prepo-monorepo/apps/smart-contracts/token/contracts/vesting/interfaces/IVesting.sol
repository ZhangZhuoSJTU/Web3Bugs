// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

/**
 * @notice Allows tokens to be claimed according to a vesting schedule
 * shared by all designated recipients.
 */
interface IVesting {
  /// @dev Emitted via `setAllocations()`.
  /// @param recipient Address of the recipient of tokens
  /// @param amount Amount of tokens allocated to recipient
  event Allocation(address recipient, uint256 amount);

  /// @dev Emitted via `claim()`.
  /// @param recipient Address of the recipient of tokens
  /// @param amount Amount of tokens claimed by recipient
  event Claim(address recipient, uint256 amount);

  /**
   * @dev Only callable by `owner()`.
   * @param newToken Address of the ERC20 token to be vested
   */
  function setToken(address newToken) external;

  /**
   * @dev Only callable by `owner()`.
   * @param newVestingStartTime Unix timestamp for when the vesting starts
   */
  function setVestingStartTime(uint256 newVestingStartTime) external;

  /**
   * @dev Only callable by `owner()`.
   * @param newVestingEndTime Unix timestamp for when the vesting ends
   */
  function setVestingEndTime(uint256 newVestingEndTime) external;

  /**
   * @notice Sets/Adjusts allocation amount of ERC20 tokens
   * to be vested for each user.
   * @dev Only callable by `owner()`.
   * @param recipients List of recipient addresses
   * @param amounts Respective amount of tokens allocated to each recipient
   */
  function setAllocations(
    address[] calldata recipients,
    uint256[] calldata amounts
  ) external;

  /**
   * @notice Transfers vested amount of tokens to the caller.
   * @dev Only claimable when not paused.
   * @dev Claimable amount will be 0 if the vested amount is less than the
   * total claimed amount. This is possible if the recipient's allocation was
   * adjusted to be lower.
   */
  function claim() external;

  /**
   * @return Address of the vested tokens
   */
  function getToken() external view returns (address);

  /**
   * @return Unix timestamp for when the vesting starts
   */
  function getVestingStartTime() external view returns (uint256);

  /**
   * @return Unix timestamp for when the vesting ends
   */
  function getVestingEndTime() external view returns (uint256);

  /**
   * @param recipient Address of the recipient of tokens
   * @return Amount of tokens allocated to recipient
   */
  function getAmountAllocated(address recipient)
    external
    view
    returns (uint256);

  /**
   * @return Total amount of tokens allocated to all recipients
   */
  function getTotalAllocatedSupply() external view returns (uint256);

  /**
   * @param recipient Address of the recipient of tokens
   * @return Total amount that has been claimed by the recipient till now
   */
  function getClaimedAmount(address recipient) external view returns (uint256);

  /**
   * @param recipient Address of the recipient of tokens
   * @return Amount that can be claimed by the recipient
   */
  function getClaimableAmount(address recipient)
    external
    view
    returns (uint256);

  /**
   * @param recipient Address of the recipient of tokens
   * @return Amount of tokens vested till now for the recipient
   */
  function getVestedAmount(address recipient) external view returns (uint256);
}
