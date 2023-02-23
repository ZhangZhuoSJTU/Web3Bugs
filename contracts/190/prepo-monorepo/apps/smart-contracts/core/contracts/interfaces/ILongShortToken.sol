// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.7;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @notice LongShortToken contract representing PrePOMarket positions.
 *
 * The token can represent either a Long or Short position for the
 * PrePOMarket it belongs to.
 */
interface ILongShortToken is IERC20 {
  /**
   * @dev Inherited from OpenZeppelin Ownable.
   * @return Address of the current owner
   */
  function owner() external returns (address);

  /**
   * @notice Mints `amount` tokens to `recipient`. Allows PrePOMarket to mint
   * positions for users.
   * @dev Only callable by `owner()` (should be PrePOMarket).
   * @param recipient Address of the recipient
   * @param amount Amount of tokens to mint
   */
  function mint(address recipient, uint256 amount) external;

  /**
   * @notice Destroys `amount` tokens from `account`, deducting from the
   * caller's allowance.
   * @dev Inherited from OpenZeppelin ERC20Burnable.
   * @param account Address of the account to destroy tokens from
   * @param amount Amount of tokens to destroy
   */
  function burnFrom(address account, uint256 amount) external;
}
