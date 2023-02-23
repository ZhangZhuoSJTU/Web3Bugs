// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "./ICollateralHook.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/draft-IERC20PermitUpgradeable.sol";

/**
 * @notice Used for minting and redeeming Collateral tokens for trading in
 * PrePO markets. A Collateral token represents a liability for a specified
 * Base Token at a 1:1 exchange ratio. These Base Tokens can be withdrawn and
 * invested by a manager to earn yield except for a minimum required reserve
 * that must be kept within the contract
 * (enforced by `ManagerWithdrawHook.sol`).
 */
interface ICollateral is IERC20Upgradeable, IERC20PermitUpgradeable {
  /**
   * @dev Emitted via `deposit()`.
   * @param depositor Address collateral was minted to
   * @param amountAfterFee Amount of collateral minted
   * @param fee Amount of `baseToken` taken as a fee
   */
  event Deposit(address indexed depositor, uint256 amountAfterFee, uint256 fee);

  /**
   * @dev Emitted via `withdraw()`.
   * @param withdrawer Address that redeemed collateral
   * @param amountAfterFee Amount of `baseToken` that was returned
   * @param fee Amount of `baseToken` taken as a fee
   */
  event Withdraw(address indexed withdrawer, uint256 amountAfterFee, uint256 fee);

  /**
   * @dev Emitted via `setManager()`.
   * @param manager Address of the new manager
   */
  event ManagerChange(address manager);

  /**
   * @dev Emitted via `setDepositFee()`.
   * @param fee The new factor for calculating deposit fees
   */
  event DepositFeeChange(uint256 fee);

  /**
   * @dev Emitted via `setWithdrawFee()`.
   * @param fee The new factor for calculating withdraw fees
   */
  event WithdrawFeeChange(uint256 fee);

  /**
   * @dev Emitted via `setDepositHook()`.
   * @param hook Address of the new hook for `deposit()`
   */
  event DepositHookChange(address hook);

  /**
   * @dev Emitted via `setWithdrawHook()`.
   * @param hook Address of the new hook for `withdraw()`
   */
  event WithdrawHookChange(address hook);

  /**
   * @dev Emitted via `setManagerWithdrawHook()`.
   * @param hook Address of the new hook for `managerWithdraw()`
   */
  event ManagerWithdrawHookChange(address hook);

  /**
   * @notice Mints Collateral tokens to `recipient` based on `amount`
   * Base Token deposited.
   * @dev The `msg.sender` paying for the deposit does not have to match the
   * `recipient` that tokens will be minted to.
   *
   * An optional external hook `depositHook`, is called to provide expanded
   * functionality such as pausability and deposit limits.
   *
   * Fees are not directly captured, but approved to the `depositHook` for
   * flexibility on how to handle fees.
   *
   * Assumes Base Token approval has already been given by `msg.sender`.
   *
   * Does not allow deposit amounts small enough to result in
   * a fee of 0 (if the deposit fee factor is > 0), including 0.
   * @param recipient Address to mint Collateral to
   * @param amount Base Token amount to be deposited
   * @return Collateral amount to be minted
   */
  function deposit(address recipient, uint256 amount) external returns (uint256);

  /**
   * @notice Gives Base Token in exchange for Collateral at a 1:1 ratio.
   * @dev An optional external hook `withdrawHook`, is called to provide
   * expanded functionality such as pausability and withdraw limits.
   *
   * Fees are not directly captured, but approved to the `withdrawHook` for
   * flexibility on how to handle fees.
   *
   * Does not allow withdraw amounts small enough to result in
   * a fee of 0 (if the withdraw fee factor is > 0), including 0.
   * @param amount Collateral amount to redeem
   */
  function withdraw(uint256 amount) external;

  /**
   * @notice Sends `amount` BaseToken within the contract to `manager`.
   * @dev An optional external hook `managerWithdrawHook`, is called to
   * provide expanded functionality such as reserve requirements.
   *
   * Only callable by `manager`
   * @param amount Base Token amount to withdraw
   */
  function managerWithdraw(uint256 amount) external;

  /**
   * @notice Sets manager that can withdraw Base Token from the contract
   * @dev Only callable by `SET_MANAGER_ROLE` role holder
   * @param newManager Address that will be manager
   */
  function setManager(address newManager) external;

  /**
   * @notice Sets the fee factor for minting Collateral, must be a 4 decimal
   * place percentage value e.g. 4.9999% = 49999.
   * @dev Only callable by `SET_DEPOSIT_FEE_ROLE` role holder
   * @param newDepositFee The new deposit fee factor
   */
  function setDepositFee(uint256 newDepositFee) external;

  /**
   * @notice Sets the fee factor for redeeming Collateral, must be a 4 decimal
   * place percentage value e.g. 4.9999% = 49999.
   * @dev Only callable by `SET_WITHDRAW_FEE_ROLE` role holder
   * @param newWithdrawFee The new withdraw fee factor
   */
  function setWithdrawFee(uint256 newWithdrawFee) external;

  /**
   * @notice Sets the hook to be called within `deposit()`
   * @dev Only callable by `SET_DEPOSIT_HOOK_ROLE` role holder
   * @param newHook Address of the new deposit hook
   */
  function setDepositHook(ICollateralHook newHook) external;

  /**
   * @notice Sets the hook to be called within `withdraw()`
   * @dev Only callable by `SET_WITHDRAW_HOOK_ROLE` role holder
   * @param newHook Address of the new withdraw hook
   */
  function setWithdrawHook(ICollateralHook newHook) external;

  /**
   * @notice Sets the hook to be called within `managerWithdraw()`
   * @dev Only callable by `SET_MANAGER_WITHDRAW_HOOK_ROLE` role holder
   * @param newHook Address of the new manager withdraw hook
   */
  function setManagerWithdrawHook(ICollateralHook newHook) external;

  /// @return The ERC20 token exchangeable 1:1 for Collateral
  function getBaseToken() external view returns (IERC20);

  /// @return The manager allowed to withdraw Base Token from the contract
  function getManager() external view returns (address);

  /// @return The factor used to calculate fees for depositinng
  function getDepositFee() external view returns (uint256);

  /// @return The factor used to calculate fees for withdrawing
  function getWithdrawFee() external view returns (uint256);

  /// @return The hook that is called in `deposit()`
  function getDepositHook() external view returns (ICollateralHook);

  /// @return The hook that is called in `withdraw()`
  function getWithdrawHook() external view returns (ICollateralHook);

  /// @return The hook that is called in `managerWithdraw()`
  function getManagerWithdrawHook() external view returns (ICollateralHook);

  /// @return The contract's Base Token balance
  function getReserve() external view returns (uint256);
}
