// SPDX-License-Identifier: UNLICENSED

// Copyright (c) 2021 0xdev0 - All rights reserved
// https://twitter.com/0xdev0

pragma solidity ^0.8.0;

import './interfaces/IERC20.sol';
import './interfaces/ILPTokenMaster.sol';
import './interfaces/ILendingPair.sol';
import './interfaces/IController.sol';
import './interfaces/IRewardDistribution.sol';
import './interfaces/IInterestRateModel.sol';

import './external/Math.sol';
import './external/Ownable.sol';
import './external/Address.sol';
import './external/Clones.sol';
import './external/ERC20.sol';

import './TransferHelper.sol';

contract LendingPair is TransferHelper {

  // Prevents division by zero and other undesirable behaviour
  uint public constant MIN_RESERVE = 1000;

  using Address for address;
  using Clones for address;

  mapping (address => mapping (address => uint)) public debtOf;
  mapping (address => mapping (address => uint)) public accountInterestSnapshot;
  mapping (address => uint) public cumulativeInterestRate; // 100e18 = 100%
  mapping (address => uint) public totalDebt;
  mapping (address => IERC20) public lpToken;

  IController public controller;
  address public tokenA;
  address public tokenB;
  uint public lastBlockAccrued;

  event Liquidation(
    address indexed account,
    address indexed repayToken,
    address indexed supplyToken,
    uint repayAmount,
    uint supplyAmount
  );

  event Deposit(address indexed account, address indexed token, uint amount);
  event Withdraw(address indexed token, uint amount);
  event Borrow(address indexed token, uint amount);
  event Repay(address indexed account, address indexed token, uint amount);

  receive() external payable {}

  function initialize(
    address _lpTokenMaster,
    address _controller,
    IERC20 _tokenA,
    IERC20 _tokenB
  ) external {
    require(address(tokenA) == address(0), "LendingPair: already initialized");
    require(address(_tokenA) != address(0) && address(_tokenB) != address(0), "LendingPair: cannot be ZERO address");

    controller = IController(_controller);
    tokenA = address(_tokenA);
    tokenB = address(_tokenB);
    lastBlockAccrued = block.number;

    lpToken[tokenA] = _createLpToken(_lpTokenMaster);
    lpToken[tokenB] = _createLpToken(_lpTokenMaster);
  }

  function depositRepay(address _account, address _token, uint _amount) external {
    _validateToken(_token);
    accrueAccount(_account);

    _depositRepay(_account, _token, _amount);
    _safeTransferFrom(_token, msg.sender, _amount);
  }

  function depositRepayETH(address _account) external payable {
    accrueAccount(_account);

    _depositRepay(_account, address(WETH), msg.value);
    _depositWeth();
  }

  function deposit(address _account, address _token, uint _amount) external {
    _validateToken(_token);
    accrueAccount(_account);

    _deposit(_account, _token, _amount);
    _safeTransferFrom(_token, msg.sender, _amount);
  }

  function withdrawBorrow(address _token, uint _amount) external {
    _validateToken(_token);
    accrueAccount(msg.sender);

    _withdrawBorrow(_token, _amount);
    _safeTransfer(IERC20(_token), msg.sender, _amount);
  }

  function withdrawBorrowETH(uint _amount) external {
    accrueAccount(msg.sender);

    _withdrawBorrow(address(WETH), _amount);
    _wethWithdrawTo(msg.sender, _amount);
    _checkMinReserve(address(WETH));
  }

  function withdraw(address _token, uint _amount) external {
    _validateToken(_token);
    accrueAccount(msg.sender);

    _withdraw(_token, _amount);
    _safeTransfer(IERC20(_token), msg.sender, _amount);
  }

  function withdrawAll(address _token) external {
    _validateToken(_token);
    accrueAccount(msg.sender);

    uint amount = lpToken[address(_token)].balanceOf(msg.sender);
    _withdraw(_token, amount);
    _safeTransfer(IERC20(_token), msg.sender, amount);
  }

  function withdrawAllETH() external {
    accrueAccount(msg.sender);

    uint amount = lpToken[address(WETH)].balanceOf(msg.sender);
    _withdraw(address(WETH), amount);
    _wethWithdrawTo(msg.sender, amount);
  }

  function borrow(address _token, uint _amount) external {
    _validateToken(_token);
    accrueAccount(msg.sender);

    _borrow(_token, _amount);
    _safeTransfer(IERC20(_token), msg.sender, _amount);
  }

  function repayAll(address _account, address _token) external {
    _validateToken(_token);
    accrueAccount(_account);

    uint amount = debtOf[_token][_account];
    _repay(_account, _token, amount);
    _safeTransferFrom(_token, msg.sender, amount);
  }

  function repayAllETH(address _account) external payable {
    accrueAccount(_account);

    uint amount = debtOf[address(WETH)][_account];
    require(msg.value >= amount, "LendingPair: insufficient ETH deposit");

    _depositWeth();
    _repay(_account, address(WETH), amount);
    uint refundAmount = msg.value > amount ? (msg.value - amount) : 0;

    if (refundAmount > 0) {
      _wethWithdrawTo(msg.sender, refundAmount);
    }
  }

  function repay(address _account, address _token, uint _amount) external {
    _validateToken(_token);
    accrueAccount(_account);

    _repay(_account, _token, _amount);
    _safeTransferFrom(_token, msg.sender, _amount);
  }

  function accrue() public {
    if (lastBlockAccrued < block.number) {
      _accrueInterest(tokenA);
      _accrueInterest(tokenB);
      lastBlockAccrued = block.number;
    }
  }

  function accrueAccount(address _account) public {
    _distributeReward(_account);
    accrue();
    _accrueAccountInterest(_account);

    if (_account != feeRecipient()) {
      _accrueAccountInterest(feeRecipient());
    }
  }

  function accountHealth(address _account) public view returns(uint) {

    if (debtOf[tokenA][_account] == 0 && debtOf[tokenB][_account] == 0) {
      return controller.LIQ_MIN_HEALTH();
    }

    uint totalAccountSupply  = _supplyCredit(_account, tokenA, tokenA)  + _supplyCredit(_account, tokenB, tokenA);
    uint totalAccountBorrrow = _borrowBalance(_account, tokenA, tokenA) + _borrowBalance(_account, tokenB, tokenA);

    return totalAccountSupply * 1e18 / totalAccountBorrrow;
  }

  // Get borow balance converted to the units of _returnToken
  function borrowBalance(
    address _account,
    address _borrowedToken,
    address _returnToken
  ) external view returns(uint) {

    _validateToken(_borrowedToken);
    _validateToken(_returnToken);

    return _borrowBalance(_account, _borrowedToken, _returnToken);
  }

  function supplyBalance(
    address _account,
    address _suppliedToken,
    address _returnToken
  ) external view returns(uint) {

    _validateToken(_suppliedToken);
    _validateToken(_returnToken);

    return _supplyBalance(_account, _suppliedToken, _returnToken);
  }

  function supplyRatePerBlock(address _token) external view returns(uint) {
    _validateToken(_token);
    return controller.interestRateModel().supplyRatePerBlock(ILendingPair(address(this)), _token);
  }

  function borrowRatePerBlock(address _token) external view returns(uint) {
    _validateToken(_token);
    return _borrowRatePerBlock(_token);
  }

  // Sell collateral to reduce debt and increase accountHealth
  // Set _repayAmount to uint(-1) to repay all debt, inc. pending interest
  function liquidateAccount(
    address _account,
    address _repayToken,
    uint    _repayAmount,
    uint    _minSupplyOutput
  ) external {

    // Input validation and adjustments

    _validateToken(_repayToken);
    address supplyToken = _repayToken == tokenA ? tokenB : tokenA;

    // Check account is underwater after interest

    _accrueAccountInterest(_account);
    _accrueAccountInterest(feeRecipient());
    uint health = accountHealth(_account);
    require(health < controller.LIQ_MIN_HEALTH(), "LendingPair: account health > LIQ_MIN_HEALTH");

    // Calculate balance adjustments

    _repayAmount = Math.min(_repayAmount, debtOf[_repayToken][_account]);

    uint supplyDebt   = _convertTokenValues(_repayToken, supplyToken, _repayAmount);
    uint callerFee    = supplyDebt * controller.liqFeeCaller(_repayToken) / 100e18;
    uint systemFee    = supplyDebt * controller.liqFeeSystem(_repayToken) / 100e18;
    uint supplyBurn   = supplyDebt + callerFee + systemFee;
    uint supplyOutput = supplyDebt + callerFee;

    require(supplyOutput >= _minSupplyOutput, "LendingPair: supplyOutput >= _minSupplyOutput");

    // Adjust balances

    _burnSupply(supplyToken, _account, supplyBurn);
    _mintSupply(supplyToken, feeRecipient(), systemFee);
    _burnDebt(_repayToken, _account, _repayAmount);

    // Settle token transfers

    _safeTransferFrom(_repayToken, msg.sender, _repayAmount);
    _safeTransfer(IERC20(supplyToken), msg.sender, supplyOutput);

    emit Liquidation(_account, _repayToken, supplyToken, _repayAmount, supplyOutput);
  }

  function pendingSupplyInterest(address _token, address _account) external view returns(uint) {
    _validateToken(_token);
    uint newInterest = _newInterest(lpToken[_token].balanceOf(_account), _token, _account);
    return newInterest * _lpRate(_token) / 100e18;
  }

  function pendingBorrowInterest(address _token, address _account) external view returns(uint) {
    _validateToken(_token);
    return _pendingBorrowInterest(_token, _account);
  }

  function feeRecipient() public view returns(address) {
    return controller.feeRecipient();
  }

  function checkAccountHealth(address _account) public view  {
    uint health = accountHealth(_account);
    require(health >= controller.LIQ_MIN_HEALTH(), "LendingPair: insufficient accountHealth");
  }

  function convertTokenValues(
    address _fromToken,
    address _toToken,
    uint    _inputAmount
  ) external view returns(uint) {

    _validateToken(_fromToken);
    _validateToken(_toToken);

    return _convertTokenValues(_fromToken, _toToken, _inputAmount);
  }

  function _depositRepay(address _account, address _token, uint _amount) internal {

    uint debt = debtOf[_token][_account];
    uint repayAmount = debt > _amount ? _amount : debt;

    if (repayAmount > 0) {
      _repay(_account, _token, repayAmount);
    }

    uint depositAmount = _amount - repayAmount;

    if (depositAmount > 0) {
      _deposit(_account, _token, depositAmount);
    }
  }

  function _withdrawBorrow(address _token, uint _amount) internal {

    uint supplyAmount = lpToken[_token].balanceOf(msg.sender);
    uint withdrawAmount = supplyAmount > _amount ? _amount : supplyAmount;

    if (withdrawAmount > 0) {
      _withdraw(_token, withdrawAmount);
    }

    uint borrowAmount = _amount - withdrawAmount;

    if (borrowAmount > 0) {
      _borrow(_token, borrowAmount);
    }
  }

  function _distributeReward(address _account) internal {
    IRewardDistribution rewardDistribution = controller.rewardDistribution();

    if (address(rewardDistribution) != address(0)) {
      rewardDistribution.distributeReward(_account, tokenA);
      rewardDistribution.distributeReward(_account, tokenB);
    }
  }

  function _mintSupply(address _token, address _account, uint _amount) internal {
    if (_amount > 0) {
      lpToken[_token].mint(_account, _amount);
    }
  }

  function _burnSupply(address _token, address _account, uint _amount) internal {
    if (_amount > 0) {
      lpToken[_token].burn(_account, _amount);
    }
  }

  function _mintDebt(address _token, address _account, uint _amount) internal {
    debtOf[_token][_account] += _amount;
    totalDebt[_token] += _amount;
  }

  function _burnDebt(address _token, address _account, uint _amount) internal {
    debtOf[_token][_account] -= _amount;
    totalDebt[_token] -= _amount;
  }

  function _accrueAccountInterest(address _account) internal {
    uint lpBalanceA = lpToken[tokenA].balanceOf(_account);
    uint lpBalanceB = lpToken[tokenB].balanceOf(_account);

    _accrueAccountSupply(tokenA, lpBalanceA, _account);
    _accrueAccountSupply(tokenB, lpBalanceB, _account);
    _accrueAccountDebt(tokenA, _account);
    _accrueAccountDebt(tokenB, _account);

    accountInterestSnapshot[tokenA][_account] = cumulativeInterestRate[tokenA];
    accountInterestSnapshot[tokenB][_account] = cumulativeInterestRate[tokenB];
  }

  function _accrueAccountSupply(address _token, uint _amount, address _account) internal {
    if (_amount > 0) {
      uint supplyInterest   = _newInterest(_amount, _token, _account);
      uint newSupplyAccount = supplyInterest * _lpRate(_token) / 100e18;
      uint newSupplySystem  = supplyInterest * _systemRate(_token) / 100e18;

      _mintSupply(_token, _account, newSupplyAccount);
      _mintSupply(_token, feeRecipient(), newSupplySystem);
    }
  }

  function _accrueAccountDebt(address _token, address _account) internal {
    if (debtOf[_token][_account] > 0) {
      uint newDebt = _pendingBorrowInterest(_token, _account);
      _mintDebt(_token, _account, newDebt);
    }
  }

  function _withdraw(address _token, uint _amount) internal {

    lpToken[address(_token)].burn(msg.sender, _amount);

    checkAccountHealth(msg.sender);

    emit Withdraw(_token, _amount);
  }

  function _borrow(address _token, uint _amount) internal {

    require(lpToken[address(_token)].balanceOf(msg.sender) == 0, "LendingPair: cannot borrow supplied token");

    _mintDebt(_token, msg.sender, _amount);

    _checkBorrowLimits(_token, msg.sender);
    checkAccountHealth(msg.sender);

    emit Borrow(_token, _amount);
  }

  function _repay(address _account, address _token, uint _amount) internal {
    _burnDebt(_token, _account, _amount);
    emit Repay(_account, _token, _amount);
  }

  function _deposit(address _account, address _token, uint _amount) internal {

    _checkOracleSupport(tokenA);
    _checkOracleSupport(tokenB);

    require(debtOf[_token][_account] == 0, "LendingPair: cannot deposit borrowed token");

    _mintSupply(_token, _account, _amount);
    _checkDepositLimit(_token);

    emit Deposit(_account, _token, _amount);
  }

  function _accrueInterest(address _token) internal {
    uint blocksElapsed = block.number - lastBlockAccrued;
    uint newInterest = _borrowRatePerBlock(_token) * blocksElapsed;
    cumulativeInterestRate[_token] += newInterest;
  }

  function _createLpToken(address _lpTokenMaster) internal returns(IERC20) {
    ILPTokenMaster newLPToken = ILPTokenMaster(_lpTokenMaster.clone());
    newLPToken.initialize();
    return IERC20(newLPToken);
  }

  function _safeTransfer(IERC20 _token, address _recipient, uint _amount) internal {
    if (_amount > 0) {
      bool success = _token.transfer(_recipient, _amount);
      require(success, "LendingPair: transfer failed");
      _checkMinReserve(address(_token));
    }
  }

  function _wethWithdrawTo(address _to, uint _amount) internal override {
    if (_amount > 0) {
      TransferHelper._wethWithdrawTo(_to, _amount);
      _checkMinReserve(address(WETH));
    }
  }

  function _borrowRatePerBlock(address _token) internal view returns(uint) {
    return controller.interestRateModel().borrowRatePerBlock(ILendingPair(address(this)), _token);
  }

  function _pendingBorrowInterest(address _token, address _account) internal view returns(uint) {
    return _newInterest(debtOf[_token][_account], _token, _account);
  }

  function _borrowBalance(
    address _account,
    address _borrowedToken,
    address _returnToken
  ) internal view returns(uint) {

    return _convertTokenValues(_borrowedToken, _returnToken, debtOf[_borrowedToken][_account]);
  }

  // Get supply balance converted to the units of _returnToken
  function _supplyBalance(
    address _account,
    address _suppliedToken,
    address _returnToken
  ) internal view returns(uint) {

    return _convertTokenValues(_suppliedToken, _returnToken, lpToken[_suppliedToken].balanceOf(_account));
  }

  function _supplyCredit(
    address _account,
    address _suppliedToken,
    address _returnToken
  ) internal view returns(uint) {

    return _supplyBalance(_account, _suppliedToken, _returnToken) * controller.colFactor(_suppliedToken) / 100e18;
  }

  function _convertTokenValues(
    address _fromToken,
    address _toToken,
    uint    _inputAmount
  ) internal view returns(uint) {

    uint priceFrom = controller.tokenPrice(_fromToken) * 1e18 / 10 ** IERC20(_fromToken).decimals();
    uint priceTo   = controller.tokenPrice(_toToken)   * 1e18 / 10 ** IERC20(_toToken).decimals();

    return _inputAmount * priceFrom / priceTo;
  }

  function _validateToken(address _token) internal view {
    require(_token == tokenA || _token == tokenB, "LendingPair: invalid token");
  }

  function _checkOracleSupport(address _token) internal view {
    require(controller.tokenSupported(_token), "LendingPair: token not supported");
  }

  function _checkMinReserve(address _token) internal view {
    require(IERC20(_token).balanceOf(address(this)) >= MIN_RESERVE, "LendingPair: below MIN_RESERVE");
  }

  function _checkDepositLimit(address _token) internal view {
    require(controller.depositsEnabled(), "LendingPair: deposits disabled");

    uint depositLimit = controller.depositLimit(address(this), _token);

    if (depositLimit > 0) {
      require((lpToken[_token].totalSupply()) <= depositLimit, "LendingPair: deposit limit reached");
    }
  }

  function _checkBorrowLimits(address _token, address _account) internal view {
    require(controller.borrowingEnabled(), "LendingPair: borrowing disabled");

    uint accountBorrowUSD = debtOf[_token][_account] * controller.tokenPrice(_token) / 1e18;
    require(accountBorrowUSD >= controller.minBorrowUSD(), "LendingPair: borrow amount below minimum");

    uint borrowLimit = controller.borrowLimit(address(this), _token);

    if (borrowLimit > 0) {
      require(totalDebt[_token] <= borrowLimit, "LendingPair: borrow limit reached");
    }
  }

  function _systemRate(address _token) internal view returns(uint) {
    return controller.interestRateModel().systemRate(ILendingPair(address(this)), _token);
  }

  function _lpRate(address _token) internal view returns(uint) {
    return 100e18 - _systemRate(_token);
  }

  function _newInterest(uint _balance, address _token, address _account) internal view returns(uint) {
    return _balance * (cumulativeInterestRate[_token] - accountInterestSnapshot[_token][_account]) / 100e18;
  }
}
