// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.7.4;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';

import '../interfaces/aaveV2/ILendingPool.sol';
import '../interfaces/aaveV2/ILendingPoolAddressesProvider.sol';
import '../interfaces/aaveV2/IAaveIncentivesController.sol';
import '../interfaces/aaveV2/IStakeAave.sol';
import '../interfaces/aaveV2/IAToken.sol';

import '../interfaces/IStrategy.sol';

contract AaveV2 is IStrategy, Ownable {
  using SafeMath for uint256;

  ILendingPoolAddressesProvider public lpAddressProvider =
    ILendingPoolAddressesProvider(0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5);
  IAaveIncentivesController public aaveIncentivesController;

  ERC20 public override want;
  IAToken public aWant;

  address public sherlock;
  address public aaveLmReceiver;

  modifier onlySherlock() {
    require(msg.sender == sherlock, 'sherlock');
    _;
  }

  constructor(
    IAToken _aWant,
    address _sherlock,
    address _aaveLmReceiver
  ) {
    aWant = _aWant;
    want = ERC20(_aWant.UNDERLYING_ASSET_ADDRESS());
    aaveIncentivesController = _aWant.getIncentivesController();

    sherlock = _sherlock;
    aaveLmReceiver = _aaveLmReceiver;

    ILendingPool lp = getLp();
    want.approve(address(lp), uint256(-1));
  }

  /**
    View methods
  */

  function aBalance() internal view returns (uint256) {
    return aWant.balanceOf(address(this));
  }

  function getLp() internal view returns (ILendingPool) {
    return ILendingPool(lpAddressProvider.getLendingPool());
  }

  function balanceOf() external view override returns (uint256) {
    return aBalance();
  }

  /**
    Sherlock strategy methods
  */

  function deposit() public override {
    ILendingPool lp = getLp();
    uint256 amount = want.balanceOf(address(this));
    require(amount > 0, 'ZERO_AMOUNT');

    lp.deposit(address(want), amount, address(this), 0);
  }

  function withdrawAll() external override onlySherlock returns (uint256) {
    ILendingPool lp = getLp();
    if (aBalance() == 0) {
      return 0;
    }
    return lp.withdraw(address(want), uint256(-1), msg.sender);
  }

  function withdraw(uint256 _amount) external override onlySherlock {
    require(_amount != uint256(-1), 'MAX');

    ILendingPool lp = getLp();
    lp.withdraw(address(want), _amount, msg.sender);
  }

  function claimRewards() external {
    address[] memory assets = new address[](1);
    assets[0] = address(aWant);

    aaveIncentivesController.claimRewards(assets, uint256(-1), aaveLmReceiver);
  }
}
