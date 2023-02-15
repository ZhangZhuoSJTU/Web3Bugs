// SPDX-License-Identifier: MIT

pragma experimental ABIEncoderV2;
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "./GenericMinerV2.sol";
import "./interfaces/IDemandMinerV2.sol";
import "../../governance/interfaces/IGovernanceAddressProvider.sol";
import "../../libraries/WadRayMath.sol";

contract DemandMinerV2 is IDemandMinerV2, GenericMinerV2 {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;
  using WadRayMath for uint256;

  address private _feeCollector;
  IERC20 private immutable _token;

  FeeConfig private _feeConfig;

  constructor(
    IGovernanceAddressProvider _addresses,
    IERC20 token,
    address feeCollector,
    BoostConfig memory _boostConfig,
    FeeConfig memory feeConfig
  ) public GenericMinerV2(_addresses, _boostConfig) {
    require(address(token) != address(0), "LM000");
    require(address(token) != address(_addresses.mimo()), "LM001");
    require(feeCollector != address(0), "LM000");
    _token = token;
    _feeCollector = feeCollector;
    _feeConfig = feeConfig;
    emit FeeCollectorSet(feeCollector);
    emit FeeConfigSet(feeConfig);
  }

  /**
    Sets new _feeCollector
    @dev can only be called by protocol manager
    @param feeCollector new feeCollector address
   */
  function setFeeCollector(address feeCollector) external override onlyManager {
    _feeCollector = feeCollector;
    emit FeeCollectorSet(feeCollector);
  }

  /**
    Sets new _feeConfig
    @dev can only be called by protocol manager
    @param newFeeConfig new FeeConfig struct see {IDemandMinerV2.FeeConfig}
   */
  function setFeeConfig(FeeConfig memory newFeeConfig) external override onlyManager {
    _feeConfig = newFeeConfig;
    emit FeeConfigSet(newFeeConfig);
  }

  /**
    Deposit an ERC20 pool token for staking
    @dev this function uses `transferFrom()` and requires pre-approval via `approve()` on the ERC20
    @param amount the amount of tokens to be deposited. Unit is in WEI
  **/
  function deposit(uint256 amount) public override {
    _token.safeTransferFrom(msg.sender, address(this), amount);
    uint256 depositAmount = amount;
    if (_feeConfig.depositFee > 0) {
      uint256 fee = amount.wadMul(_feeConfig.depositFee);
      depositAmount = depositAmount.sub(fee);
      _token.safeTransfer(_feeCollector, fee);
      emit DepositFeeReleased(fee);
    }
    _increaseStake(msg.sender, depositAmount);
  }

  /**
    Withdraw staked ERC20 pool tokens. Will fail if user does not have enough tokens staked
    @param amount the amount of tokens to be withdrawn. Unit is in WEI
  **/
  function withdraw(uint256 amount) public override {
    uint256 withdrawAmount = amount;
    if (_feeConfig.withdrawFee > 0) {
      uint256 fee = amount.wadMul(_feeConfig.withdrawFee);
      withdrawAmount = withdrawAmount.sub(fee);
      _token.safeTransfer(_feeCollector, fee);
      emit WithdrawFeeReleased(fee);
    }
    _token.safeTransfer(msg.sender, withdrawAmount);
    _decreaseStake(msg.sender, amount);
  }

  function token() public view override returns (IERC20) {
    return _token;
  }

  function feeCollector() public view override returns (address) {
    return _feeCollector;
  }

  function feeConfig() public view override returns (FeeConfig memory) {
    return _feeConfig;
  }
}
