// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "prepo-shared-contracts/contracts/interfaces/ITokenSender.sol";
import "prepo-shared-contracts/contracts/AllowedMsgSenders.sol";
import "prepo-shared-contracts/contracts/WithdrawERC20.sol";
import "prepo-shared-contracts/contracts/SafeAccessControlEnumerable.sol";
import "prepo-shared-contracts/contracts/interfaces/IUintValue.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

contract TokenSender is
  ITokenSender,
  AllowedMsgSenders,
  WithdrawERC20, // TODO: Access control when WithdrawERC20 updated
  SafeAccessControlEnumerable
{
  IUintValue private _price;
  uint256 private _priceMultiplier;
  uint256 private _scaledPriceLowerBound;

  IERC20 private immutable _outputToken;
  uint256 private immutable _outputTokenDecimalsFactor;

  uint256 public constant MULTIPLIER_DENOMINATOR = 10000;
  bytes32 public constant SET_PRICE_ROLE = keccak256("TokenSender_setPrice(IUintValue)");
  bytes32 public constant SET_PRICE_MULTIPLIER_ROLE = keccak256("TokenSender_setPriceMultiplier(uint256)");
  bytes32 public constant SET_SCALED_PRICE_LOWER_BOUND_ROLE = keccak256("TokenSender_setScaledPriceLowerBound(uint256)");
  bytes32 public constant SET_ALLOWED_MSG_SENDERS_ROLE = keccak256("TokenSender_setAllowedMsgSenders(IAccountList)");

  constructor(IERC20Metadata outputToken) {
    _outputToken = outputToken;
    _outputTokenDecimalsFactor = 10**outputToken.decimals();
  }

  function send(address recipient, uint256 unconvertedAmount) external override onlyAllowedMsgSenders {
    uint256 scaledPrice = (_price.get() * _priceMultiplier) / MULTIPLIER_DENOMINATOR;
    if (scaledPrice <= _scaledPriceLowerBound) return;
    uint256 outputAmount = (unconvertedAmount * _outputTokenDecimalsFactor) / scaledPrice;
    if (outputAmount == 0) return;
    if (outputAmount > _outputToken.balanceOf(address(this))) return;
    _outputToken.transfer(recipient, outputAmount);
  }

  function setPrice(IUintValue price) external override onlyRole(SET_PRICE_ROLE) {
    _price = price;
    emit PriceChange(price);
  }

  function setPriceMultiplier(uint256 multiplier) external override onlyRole(SET_PRICE_MULTIPLIER_ROLE) {
    _priceMultiplier = multiplier;
    emit PriceMultiplierChange(multiplier);
  }

  function setScaledPriceLowerBound(uint256 lowerBound) external override onlyRole(SET_SCALED_PRICE_LOWER_BOUND_ROLE) {
    _scaledPriceLowerBound = lowerBound;
    emit ScaledPriceLowerBoundChange(lowerBound);
  }

  function setAllowedMsgSenders(IAccountList allowedMsgSenders) public override onlyRole(SET_ALLOWED_MSG_SENDERS_ROLE) {
    super.setAllowedMsgSenders(allowedMsgSenders);
  }

  function getOutputToken() external view override returns (IERC20) {
    return _outputToken;
  }

  function getPrice() external view override returns (IUintValue) {
    return _price;
  }

  function getPriceMultiplier() external view override returns (uint256) {
    return _priceMultiplier;
  }

  function getScaledPriceLowerBound() external view override returns (uint256) {
    return _scaledPriceLowerBound;
  }
}
