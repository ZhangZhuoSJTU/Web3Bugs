// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity =0.8.7;

import {IAaveATokenV2, IAaveLendingPoolV2, ILendingPoolAddressesProviderV2} from "../../peripheral/Aave/IAave.sol";

import {MassetHelpers, SafeERC20} from "../../shared/MassetHelpers.sol";
import {IERC20, ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockATokenV2 is ERC20 {
  address public lendingPool;
  IERC20 public underlyingToken;
  using SafeERC20 for IERC20;

  constructor(address _lendingPool, IERC20 _underlyingToken)
    ERC20("MockAToken", "MAT")
  {
    lendingPool = _lendingPool;
    underlyingToken = _underlyingToken;
  }

  function burn(address user, uint256 amount) public {
    _burn(user, amount);
  }

  function mint(address user, uint256 amount) public {
    _mint(user, amount);
  }
}

contract MockAaveV2 is IAaveLendingPoolV2, ILendingPoolAddressesProviderV2 {
  using SafeERC20 for IERC20;

  mapping(address => address) reserveToAToken;
  address pool = address(this);
  address payable core = payable(address(this));

  function addAToken(address _aToken, address _underlying) public {
    MassetHelpers.safeInfiniteApprove(_underlying, _aToken);
    reserveToAToken[_underlying] = _aToken;
  }

  function deposit(
    address _reserve,
    uint256 _amount,
    address, /* _onBehalfOf */
    uint16 /*_referralCode*/
  ) external override {
    uint256 previousBal = IERC20(reserveToAToken[_reserve]).balanceOf(
      msg.sender
    );
    uint256 factor = 2 * (10**13); // 0.002%
    uint256 interest = (previousBal * factor) / 1e18;
    MockATokenV2(reserveToAToken[_reserve]).mint(msg.sender, interest);
    // Take their reserve
    transferTokens(msg.sender, address(this), _reserve, true, _amount);
    // Credit them with aToken
    MockATokenV2(reserveToAToken[_reserve]).mint(msg.sender, _amount);
  }

  function withdraw(
    address reserve,
    uint256 amount,
    address to
  ) external override {
    MockATokenV2(reserveToAToken[reserve]).burn(msg.sender, amount);
    IERC20(reserve).transfer(to, amount);
  }

  function getLendingPool() external view override returns (address) {
    return pool;
  }

  function breakLendingPools() external {
    pool = address(0);
    core = payable(address(0));
  }

  function transferTokens(
    address _sender,
    address _recipient,
    address _basset,
    bool _hasTxFee,
    uint256 _qty
  ) internal returns (uint256 receivedQty) {
    receivedQty = _qty;
    if (_hasTxFee) {
      uint256 balBefore = IERC20(_basset).balanceOf(_recipient);
      IERC20(_basset).safeTransferFrom(_sender, _recipient, _qty);
      uint256 balAfter = IERC20(_basset).balanceOf(_recipient);
      receivedQty = _qty > balAfter - balBefore ? balAfter - balBefore : _qty;
    } else {
      IERC20(_basset).safeTransferFrom(_sender, _recipient, _qty);
    }
  }
}
