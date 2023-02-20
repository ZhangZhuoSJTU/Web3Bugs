// SPDX-License-Identifier: MIT

pragma experimental ABIEncoderV2;
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IDemandMinerV2 {
  event FeeCollectorSet(address feeCollector);

  event FeeConfigSet(FeeConfig);

  event DepositFeeReleased(uint256 income);

  event WithdrawFeeReleased(uint256 income);

  struct FeeConfig {
    uint256 depositFee;
    uint256 withdrawFee;
  }

  function setFeeCollector(address feeCollector) external;

  function setFeeConfig(FeeConfig memory newFeeConfig) external;

  function deposit(uint256 amount) external;

  function withdraw(uint256 amount) external;

  function token() external view returns (IERC20);

  function feeCollector() external view returns (address);

  function feeConfig() external view returns (FeeConfig memory);
}
