// SPDX-License-Identifier: UNLICENSED
pragma solidity =0.8.7;

import "./ICollateral.sol";

/**
 * @notice The base contract for an external hook that adds functionality to
 * a `Collateral` contract.
 */
interface ICollateralHook {
  /**
   * @dev Emitted via `setCollateral()`.
   * @param collateral The new collateral address
   */
  event CollateralChange(address collateral);

  /**
   * @dev This function should be as "stateless" as possible, and if it needs
   * to change state it should delegate that logic to an external contract.
   *
   * `amountBeforeFee` is the Base Token amount deposited/withdrawn by the
   * caller before fees are taken.
   *
   * `amountAfterFee` is the BaseToken amount deposited/withdrawn by the
   * caller after fees are taken.
   *
   * Only callable by `collateral`.
   * @param sender Caller depositing/withdrawing collateral
   * @param amountBeforeFee Base Token amount before fees
   * @param amountAfterFee Base Token amount after fees
   */
  function hook(
    address sender,
    uint256 amountBeforeFee,
    uint256 amountAfterFee
  ) external;

  /**
   * @notice Sets the collateral that will be allowed to call this hook.
   * @dev Only callable by `SET_COLLATERAL_ROLE`.
   * @param newCollateral The new allowed collateral
   */
  function setCollateral(ICollateral newCollateral) external;

  /// @return The collateral that is allowed to call this hook.
  function getCollateral() external view returns (ICollateral);
}
