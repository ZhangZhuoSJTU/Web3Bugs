// SPDX-License-Identifier: UNLICENSED

pragma solidity ^0.8.0;

import './interfaces/IInterestRateModel.sol';
import './interfaces/IRewardDistribution.sol';
import './interfaces/IPriceOracle.sol';
import './external/Address.sol';
import './external/Ownable.sol';

contract Controller is Ownable {

  using Address for address;

  uint public  constant LIQ_MIN_HEALTH = 1e18;
  uint private constant MAX_COL_FACTOR = 99e18;
  uint private constant MAX_LIQ_FEES   = 50e18;

  IInterestRateModel  public interestRateModel;
  IPriceOracle        public priceOracle;
  IRewardDistribution public rewardDistribution;

  bool public depositsEnabled;
  bool public borrowingEnabled;
  uint public liqFeeCallerDefault;
  uint public liqFeeSystemDefault;
  uint public minBorrowUSD;

  mapping(address => mapping(address => uint)) public depositLimit;
  mapping(address => mapping(address => uint)) public borrowLimit;
  mapping(address => uint) public liqFeeCallerToken; // 1e18  = 1%
  mapping(address => uint) public liqFeeSystemToken; // 1e18  = 1%
  mapping(address => uint) public colFactor; // 99e18 = 99%

  address public feeRecipient;

  event NewFeeRecipient(address feeRecipient);
  event NewInterestRateModel(address interestRateModel);
  event NewPriceOracle(address priceOracle);
  event NewRewardDistribution(address rewardDistribution);
  event NewColFactor(address token, uint value);
  event NewDepositLimit(address pair, address token, uint value);
  event NewBorrowLimit(address pair, address token, uint value);
  event DepositsEnabled(bool value);
  event BorrowingEnabled(bool value);
  event NewLiqParamsToken(address token, uint liqFeeSystem, uint liqFeeCaller);
  event NewLiqParamsDefault(uint liqFeeSystem, uint liqFeeCaller);

  constructor(
    address _interestRateModel,
    uint _liqFeeSystemDefault,
    uint _liqFeeCallerDefault
  ) {
    _requireContract(_interestRateModel);

    interestRateModel = IInterestRateModel(_interestRateModel);
    liqFeeSystemDefault = _liqFeeSystemDefault;
    liqFeeCallerDefault = _liqFeeCallerDefault;
    depositsEnabled = true;
    borrowingEnabled = true;
  }

  function setFeeRecipient(address _value) external onlyOwner {
    _requireContract(_value);
    feeRecipient = _value;
    emit NewFeeRecipient(_value);
  }

  function setLiqParamsToken(
    address _token,
    uint    _liqFeeSystem,
    uint    _liqFeeCaller
  ) external onlyOwner {
    require(_liqFeeCaller + _liqFeeSystem <= MAX_LIQ_FEES, "Controller: fees too high");
    _requireContract(_token);

    liqFeeSystemToken[_token] = _liqFeeSystem;
    liqFeeCallerToken[_token] = _liqFeeCaller;

    emit NewLiqParamsToken(_token, _liqFeeSystem, _liqFeeCaller);
  }

  function setLiqParamsDefault(
    uint    _liqFeeSystem,
    uint    _liqFeeCaller
  ) external onlyOwner {
    require(_liqFeeCaller + _liqFeeSystem <= MAX_LIQ_FEES, "Controller: fees too high");

    liqFeeSystemDefault = _liqFeeSystem;
    liqFeeCallerDefault = _liqFeeCaller;

    emit NewLiqParamsDefault(_liqFeeSystem, _liqFeeCaller);
  }

  function setInterestRateModel(address _value) external onlyOwner {
    _requireContract(_value);
    interestRateModel = IInterestRateModel(_value);
    emit NewInterestRateModel(address(_value));
  }

  function setPriceOracle(address _value) external onlyOwner {
    _requireContract(_value);
    priceOracle = IPriceOracle(_value);
    emit NewPriceOracle(address(_value));
  }

  function setRewardDistribution(address _value) external onlyOwner {
    _requireContract(_value);
    rewardDistribution = IRewardDistribution(_value);
    emit NewRewardDistribution(address(_value));
  }

  function setDepositsEnabled(bool _value) external onlyOwner {
    depositsEnabled = _value;
    emit DepositsEnabled(_value);
  }

  function setBorrowingEnabled(bool _value) external onlyOwner {
    borrowingEnabled = _value;
    emit BorrowingEnabled(_value);
  }

  function setDepositLimit(address _pair, address _token, uint _value) external onlyOwner {
    _requireContract(_pair);
    _requireContract(_token);
    depositLimit[_pair][_token] = _value;
    emit NewDepositLimit(_pair, _token, _value);
  }

  function setBorrowLimit(address _pair, address _token, uint _value) external onlyOwner {
    _requireContract(_pair);
    _requireContract(_token);
    borrowLimit[_pair][_token] = _value;
    emit NewBorrowLimit(_pair, _token, _value);
  }

  function setMinBorrowUSD(uint _value) external onlyOwner {
    minBorrowUSD = _value;
  }

  function setColFactor(address _token, uint _value) external onlyOwner {
    require(_value <= MAX_COL_FACTOR, "Controller: _value <= MAX_COL_FACTOR");
    _requireContract(_token);
    colFactor[_token] = _value;
    emit NewColFactor(_token, _value);
  }

  function liqFeeSystem(address _token) public view returns(uint) {
    return liqFeeSystemToken[_token] > 0 ? liqFeeSystemToken[_token] : liqFeeSystemDefault;
  }

  function liqFeeCaller(address _token) public view returns(uint) {
    return liqFeeCallerToken[_token] > 0 ? liqFeeCallerToken[_token] : liqFeeCallerDefault;
  }

  function liqFeesTotal(address _token) external view returns(uint) {
    return liqFeeSystem(_token) + liqFeeCaller(_token);
  }

  function tokenPrice(address _token) external view returns(uint) {
    return priceOracle.tokenPrice(_token);
  }

  function tokenSupported(address _token) external view returns(bool) {
    return priceOracle.tokenSupported(_token);
  }

  function _requireContract(address _value) internal view {
    require(_value.isContract(), "Controller: must be a contract");
  }
}
