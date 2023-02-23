// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "./ITransferHook.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/draft-IERC20PermitUpgradeable.sol";

interface IPPO is IERC20Upgradeable, IERC20PermitUpgradeable {
  /**
   * @notice Sets the external `ITransferHook` contract to be called before
   * any PPO transfer.
   * @dev The transfer hook's `hook()` function will be called within
   * `_beforeTokenTransfer()`.
   *
   * Only callable by `owner()`.
   * @param newTransferHook Address of the `ITransferHook` contract
   */
  function setTransferHook(ITransferHook newTransferHook) external;

  /**
   * @notice Mints `amount` PPO to `recipient`.
   * @dev Only callable by `owner()`.
   * @param recipient Address to send minted `PPO` to
   * @param amount Amount of `PPO` to be sent
   */
  function mint(address recipient, uint256 amount) external;

  /**
   * @notice Burns `amount` tokens from the caller.
   * @param amount Amount of `PPO` to be burned
   */
  function burn(uint256 amount) external;

  /**
   * @notice Burns `amount` tokens from `account`.
   * @dev The caller's allowance with the `account` must be >= `amount` and
   * will be decreased by `amount`.
   * @param account Address to burn `PPO` from
   * @param amount Amount of `PPO` to be burned
   */
  function burnFrom(address account, uint256 amount) external;

  /**
   * @notice Atomically allows and transfers `amount` from `from` to
   * `to`, if before the `deadline`, using a signature signed by `from`.
   * @dev `from`, `to` and `deadline` must exactly match the values used
   * to generate `v`, `r` and `s`.
   * @param from Address to transfer `PPO` from
   * @param to Address to transfer `PPO` to
   * @param amount Amount of PPO to be transferred
   * @param deadline Future timestamp, specified in the permit signature
   * before which the transaction must execute
   * @param v recovery identifier of the signature
   * @param r part of ECDSA signature output
   * @param s part of ECDSA signature output
   */
  function transferFromWithPermit(
    address from,
    address to,
    uint256 amount,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) external;

  /// @return The transfer hook contract
  function getTransferHook() external view returns (ITransferHook);
}
