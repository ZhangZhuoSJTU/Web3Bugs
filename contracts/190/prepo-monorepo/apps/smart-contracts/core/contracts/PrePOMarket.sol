// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "./interfaces/ILongShortToken.sol";
import "./interfaces/IPrePOMarket.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract PrePOMarket is IPrePOMarket, Ownable, ReentrancyGuard {
  IMarketHook private _mintHook;
  IMarketHook private _redeemHook;

  IERC20 private immutable collateral;
  ILongShortToken private immutable longToken;
  ILongShortToken private immutable shortToken;

  uint256 private immutable floorLongPayout;
  uint256 private immutable ceilingLongPayout;
  uint256 private finalLongPayout;

  uint256 private immutable floorValuation;
  uint256 private immutable ceilingValuation;

  uint256 private redemptionFee;

  uint256 private immutable expiryTime;

  uint256 private constant MAX_PAYOUT = 1e18;
  uint256 private constant FEE_DENOMINATOR = 1000000;
  uint256 private constant FEE_LIMIT = 100000;

  /**
   * Assumes `_collateral`, `_longToken`, and `_shortToken` are
   * valid, since they will be handled by the PrePOMarketFactory. The
   * treasury is initialized to governance due to stack limitations.
   *
   * Assumes that ownership of `_longToken` and `_shortToken` has been
   * transferred to this contract via `createMarket()` in
   * `PrePOMarketFactory.sol`.
   */
  constructor(address _governance, address _collateral, ILongShortToken _longToken, ILongShortToken _shortToken, uint256 _floorLongPayout, uint256 _ceilingLongPayout, uint256 _floorValuation, uint256 _ceilingValuation, uint256 _expiryTime) {
    require(_ceilingLongPayout > _floorLongPayout, "Ceiling must exceed floor");
    require(_expiryTime > block.timestamp, "Invalid expiry");
    require(_ceilingLongPayout <= MAX_PAYOUT, "Ceiling cannot exceed 1");

    transferOwnership(_governance);

    collateral = IERC20(_collateral);
    longToken = _longToken;
    shortToken = _shortToken;

    floorLongPayout = _floorLongPayout;
    ceilingLongPayout = _ceilingLongPayout;
    finalLongPayout = MAX_PAYOUT + 1;

    floorValuation = _floorValuation;
    ceilingValuation = _ceilingValuation;

    expiryTime = _expiryTime;

    emit MarketCreated(address(_longToken), address(_shortToken), _floorLongPayout, _ceilingLongPayout, _floorValuation, _ceilingValuation, _expiryTime);
  }

  function mint(uint256 _amount) external override nonReentrant returns (uint256) {
    require(finalLongPayout > MAX_PAYOUT, "Market ended");
    require(collateral.balanceOf(msg.sender) >= _amount, "Insufficient collateral");
    if (address(_mintHook) != address(0)) _mintHook.hook(msg.sender, _amount, _amount);
    collateral.transferFrom(msg.sender, address(this), _amount);
    longToken.mint(msg.sender, _amount);
    shortToken.mint(msg.sender, _amount);
    emit Mint(msg.sender, _amount);
    return _amount;
  }

  function redeem(uint256 _longAmount, uint256 _shortAmount) external override nonReentrant {
    require(longToken.balanceOf(msg.sender) >= _longAmount, "Insufficient long tokens");
    require(shortToken.balanceOf(msg.sender) >= _shortAmount, "Insufficient short tokens");

    uint256 _collateralAmount;
    if (finalLongPayout <= MAX_PAYOUT) {
      uint256 _shortPayout = MAX_PAYOUT - finalLongPayout;
      _collateralAmount = (finalLongPayout * _longAmount + _shortPayout * _shortAmount) / MAX_PAYOUT;
    } else {
      require(_longAmount == _shortAmount, "Long and Short must be equal");
      _collateralAmount = _longAmount;
    }

    uint256 _actualFee;
    uint256 _expectedFee = (_collateralAmount * redemptionFee) / FEE_DENOMINATOR;
    if (redemptionFee > 0) { require(_expectedFee > 0, "fee = 0"); }
    else { require(_collateralAmount > 0, "amount = 0"); }
    if (address(_redeemHook) != address(0)) {
      collateral.approve(address(_redeemHook), _expectedFee);
      uint256 _collateralAllowanceBefore = collateral.allowance(address(this), address(_redeemHook));
      _redeemHook.hook(msg.sender, _collateralAmount, _collateralAmount - _expectedFee);
      _actualFee = _collateralAllowanceBefore - collateral.allowance(address(this), address(_redeemHook));
      collateral.approve(address(_redeemHook), 0);
    } else { _actualFee = 0; }

    longToken.burnFrom(msg.sender, _longAmount);
    shortToken.burnFrom(msg.sender, _shortAmount);
    uint256 _collateralAfterFee = _collateralAmount - _actualFee;
    collateral.transfer(msg.sender, _collateralAfterFee);

    emit Redemption(msg.sender, _collateralAfterFee, _actualFee);
  }

  function setMintHook(IMarketHook mintHook) external override onlyOwner {
    _mintHook = mintHook;
    emit MintHookChange(address(mintHook));
  }

  function setRedeemHook(IMarketHook redeemHook) external override onlyOwner {
    _redeemHook = redeemHook;
    emit RedeemHookChange(address(redeemHook));
  }

  function setFinalLongPayout(uint256 _finalLongPayout) external override onlyOwner {
    require(_finalLongPayout >= floorLongPayout, "Payout cannot be below floor");
    require(_finalLongPayout <= ceilingLongPayout, "Payout cannot exceed ceiling");
    finalLongPayout = _finalLongPayout;
    emit FinalLongPayoutSet(_finalLongPayout);
  }

  function setRedemptionFee(uint256 _redemptionFee) external override onlyOwner {
    require(_redemptionFee <= FEE_LIMIT, "Exceeds fee limit");
    redemptionFee = _redemptionFee;
    emit RedemptionFeeChange(_redemptionFee);
  }

  function getMintHook() external view override returns (IMarketHook) { return _mintHook; }

  function getRedeemHook() external view override returns (IMarketHook) { return _redeemHook; }

  function getCollateral() external view override returns (IERC20) { return collateral; }

  function getLongToken() external view override returns (ILongShortToken) { return longToken; }

  function getShortToken() external view override returns (ILongShortToken) { return shortToken; }

  function getFloorLongPayout() external view override returns (uint256) { return floorLongPayout; }

  function getCeilingLongPayout() external view override returns (uint256) { return ceilingLongPayout; }

  function getFinalLongPayout() external view override returns (uint256) { return finalLongPayout; }

  function getFloorValuation() external view override returns (uint256) { return floorValuation; }

  function getCeilingValuation() external view override returns (uint256) { return ceilingValuation; }

  function getRedemptionFee() external view override returns (uint256) { return redemptionFee; }

  function getExpiryTime() external view override returns (uint256) { return expiryTime; }

  function getMaxPayout() external pure override returns (uint256) { return MAX_PAYOUT; }

  function getFeeDenominator() external pure override returns (uint256) { return FEE_DENOMINATOR; }

  function getFeeLimit() external pure override returns (uint256) { return FEE_LIMIT; }
}
