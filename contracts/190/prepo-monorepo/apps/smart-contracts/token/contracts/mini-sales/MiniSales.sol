// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "./interfaces/IMiniSales.sol";
import "prepo-shared-contracts/contracts/WithdrawERC20.sol";

contract MiniSales is IMiniSales, WithdrawERC20 {
  IERC20 private immutable saleToken;
  IERC20 private immutable paymentToken;
  uint256 private immutable saleTokenDenominator;
  uint256 private price;
  IPurchaseHook private purchaseHook;

  constructor(
    address _newSaleToken,
    address _newPaymentToken,
    uint256 _newSaleTokenDecimals
  ) {
    saleToken = IERC20(_newSaleToken);
    paymentToken = IERC20(_newPaymentToken);
    saleTokenDenominator = 10**_newSaleTokenDecimals;
  }

  function purchase(
    address _recipient,
    uint256 _saleTokenAmount,
    uint256 _purchasePrice,
    bytes calldata _data
  ) external override nonReentrant {
    require(_purchasePrice == price, "Price mismatch");
    IPurchaseHook _hook = purchaseHook;
    if (address(_hook) != address(0)) {
      _hook.hook(
        _msgSender(),
        _recipient,
        _saleTokenAmount,
        _purchasePrice,
        _data
      );
    }
    uint256 _paymentTokenAmount = (_saleTokenAmount * _purchasePrice) /
      saleTokenDenominator;
    paymentToken.transferFrom(
      _msgSender(),
      address(this),
      _paymentTokenAmount
    );
    saleToken.transfer(_recipient, _saleTokenAmount);
    emit Purchase(_msgSender(), _recipient, _saleTokenAmount, _purchasePrice);
  }

  function setPrice(uint256 _newPrice) external override onlyOwner {
    price = _newPrice;
    emit PriceChange(_newPrice);
  }

  function setPurchaseHook(IPurchaseHook _newPurchaseHook)
    external
    override
    onlyOwner
  {
    purchaseHook = _newPurchaseHook;
    emit PurchaseHookChange(_newPurchaseHook);
  }

  function getSaleToken() external view override returns (IERC20) {
    return saleToken;
  }

  function getPaymentToken() external view override returns (IERC20) {
    return paymentToken;
  }

  function getPrice() external view override returns (uint256) {
    return price;
  }

  function getPurchaseHook() external view override returns (IPurchaseHook) {
    return purchaseHook;
  }

  function getSaleForPayment(uint256 payment)
    external
    view
    override
    returns (uint256)
  {
    return (payment * saleTokenDenominator) / price;
  }
}
