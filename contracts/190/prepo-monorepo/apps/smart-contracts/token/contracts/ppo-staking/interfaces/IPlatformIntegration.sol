// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity =0.8.7;

/**
 * @title Platform interface to integrate with lending platform like Compound, AAVE etc.
 */
interface IPlatformIntegration {
  /**
   * @dev Deposit the given bAsset to Lending platform
   * @param _bAsset bAsset address
   * @param _amount Amount to deposit
   */
  function deposit(
    address _bAsset,
    uint256 _amount,
    bool isTokenFeeCharged
  ) external returns (uint256 quantityDeposited);

  /**
   * @dev Withdraw given bAsset from Lending platform
   */
  function withdraw(
    address _receiver,
    address _bAsset,
    uint256 _amount,
    bool _hasTxFee
  ) external;

  /**
   * @dev Withdraw given bAsset from Lending platform
   */
  function withdraw(
    address _receiver,
    address _bAsset,
    uint256 _amount,
    uint256 _totalAmount,
    bool _hasTxFee
  ) external;

  /**
   * @dev Withdraw given bAsset from the cache
   */
  function withdrawRaw(
    address _receiver,
    address _bAsset,
    uint256 _amount
  ) external;

  /**
   * @dev Returns the current balance of the given bAsset
   */
  function checkBalance(address _bAsset) external returns (uint256 balance);
}
