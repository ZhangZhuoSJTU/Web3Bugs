// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity =0.8.7;

/**
 * @dev Interface for Aaves Lending Pool
 * Documentation: https://developers.aave.com/#lendingpooladdressesprovider
 */
interface ILendingPoolAddressesProviderV2 {
  /**
   * @notice Get the current address for Aave LendingPool
   * @dev Lending pool is the core contract on which to call deposit
   */
  function getLendingPool() external view returns (address);
}

/**
 * @dev Interface for Aaves A Token
 * Documentation: https://developers.aave.com/#atokens
 */
interface IAaveATokenV2 {
  /**
   * @notice returns the current total aToken balance of _user all interest collected included.
   * To obtain the user asset principal balance with interests excluded , ERC20 non-standard
   * method principalBalanceOf() can be used.
   */
  function balanceOf(address _user) external view returns (uint256);
}

interface IAaveLendingPoolV2 {
  /**
   * @dev deposits The underlying asset into the reserve. A corresponding amount of the overlying asset (aTokens)
   * is minted.
   * @param reserve the address of the reserve
   * @param amount the amount to be deposited
   * @param referralCode integrators are assigned a referral code and can potentially receive rewards.
   **/
  function deposit(
    address reserve,
    uint256 amount,
    address onBehalfOf,
    uint16 referralCode
  ) external;

  /**
   * @dev withdraws the assets of user.
   * @param reserve the address of the reserve
   * @param amount the underlying amount to be redeemed
   * @param to address that will receive the underlying
   **/
  function withdraw(
    address reserve,
    uint256 amount,
    address to
  ) external;
}

/** Interface for Staking AAVE Token
 * Documentation: https://docs.aave.com/developers/protocol-governance/staking-aave
 */
interface IStakedAave {
  function COOLDOWN_SECONDS() external returns (uint256);

  function UNSTAKE_WINDOW() external returns (uint256);

  function stake(address to, uint256 amount) external;

  function redeem(address to, uint256 amount) external;

  function cooldown() external;

  function claimRewards(address to, uint256 amount) external;

  function stakersCooldowns(address staker) external returns (uint256);
}
