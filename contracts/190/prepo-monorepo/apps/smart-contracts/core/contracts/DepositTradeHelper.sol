// SPDX-License-Identifier: AGPL-3.0
pragma solidity =0.8.7;

import "./interfaces/IDepositTradeHelper.sol";
import "prepo-shared-contracts/contracts/SafeOwnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-IERC20Permit.sol";

contract DepositTradeHelper is IDepositTradeHelper, SafeOwnable {
  ICollateral private immutable _collateral;
  IERC20 private immutable _baseToken;
  ISwapRouter private immutable _swapRouter;
  uint24 public constant override POOL_FEE_TIER = 10000;

  constructor(ICollateral collateral, ISwapRouter swapRouter) {
    _collateral = collateral;
    _baseToken = collateral.getBaseToken();
    _swapRouter = swapRouter;
    collateral.getBaseToken().approve(address(collateral), type(uint256).max);
    collateral.approve(address(swapRouter), type(uint256).max);
  }

  function depositAndTrade(uint256 baseTokenAmount, Permit calldata baseTokenPermit, Permit calldata collateralPermit, OffChainTradeParams calldata tradeParams) external override {
    if (baseTokenPermit.deadline != 0) {
      IERC20Permit(address(_baseToken)).permit(msg.sender, address(this), type(uint256).max, baseTokenPermit.deadline, baseTokenPermit.v, baseTokenPermit.r, baseTokenPermit.s);
    }
    _baseToken.transferFrom(msg.sender, address(this), baseTokenAmount);
    if (collateralPermit.deadline != 0) {
      _collateral.permit(msg.sender, address(this), type(uint256).max, collateralPermit.deadline, collateralPermit.v, collateralPermit.r, collateralPermit.s);
    }
    uint256 _collateralAmountMinted = _collateral.deposit(msg.sender, baseTokenAmount);
    _collateral.transferFrom(msg.sender, address(this), _collateralAmountMinted);
    ISwapRouter.ExactInputSingleParams memory exactInputSingleParams = ISwapRouter.ExactInputSingleParams(address(_collateral), tradeParams.tokenOut, POOL_FEE_TIER, msg.sender, tradeParams.deadline, _collateralAmountMinted, tradeParams.amountOutMinimum, tradeParams.sqrtPriceLimitX96);
    _swapRouter.exactInputSingle(exactInputSingleParams);
  }

  function getCollateral() external view override returns (ICollateral) { return _collateral; }

  function getBaseToken() external view override returns (IERC20) { return _baseToken; }

  function getSwapRouter() external view override returns (ISwapRouter) { return _swapRouter; }
}
