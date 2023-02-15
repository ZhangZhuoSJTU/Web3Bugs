// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.10;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import './Manager.sol';
import '../interfaces/managers/IStrategyManager.sol';

import '../interfaces/aaveV2/ILendingPool.sol';
import '../interfaces/aaveV2/ILendingPoolAddressesProvider.sol';
import '../interfaces/aaveV2/IAaveIncentivesController.sol';
import '../interfaces/aaveV2/IStakeAave.sol';
import '../interfaces/aaveV2/IAToken.sol';

// This contract contains logic for depositing staker funds into Aave V2 as a yield strategy

contract AaveV2Strategy is IStrategyManager, Manager {
  using SafeERC20 for IERC20;

  // Need to call a provider because Aave has the ability to change the lending pool address
  ILendingPoolAddressesProvider public constant LP_ADDRESS_PROVIDER =
    ILendingPoolAddressesProvider(0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5);

  // Aave contract that controls stkAAVE rewards
  IAaveIncentivesController public immutable aaveIncentivesController;

  // This is the token being deposited (USDC)
  IERC20 public immutable override want;
  // This is the receipt token Aave gives in exchange for a token deposit (aUSDC)
  IAToken public immutable aWant;

  // Address to receive stkAAVE rewards
  address public immutable aaveLmReceiver;

  // Constructor takes the aUSDC address and the rewards receiver address (a Sherlock address) as args
  constructor(IAToken _aWant, address _aaveLmReceiver) {
    if (address(_aWant) == address(0)) revert ZeroArgument();
    if (_aaveLmReceiver == address(0)) revert ZeroArgument();

    aWant = _aWant;
    // This gets the underlying token associated with aUSDC (USDC)
    want = IERC20(_aWant.UNDERLYING_ASSET_ADDRESS());
    // Gets the specific rewards controller for this token type
    aaveIncentivesController = _aWant.getIncentivesController();

    aaveLmReceiver = _aaveLmReceiver;
  }

  // Returns the current Aave lending pool address that should be used
  function getLp() internal view returns (ILendingPool) {
    return ILendingPool(LP_ADDRESS_PROVIDER.getLendingPool());
  }

  /// @notice Checks the aUSDC balance in this contract
  function balanceOf() public view override returns (uint256) {
    return aWant.balanceOf(address(this));
  }

  /// @notice Deposits all USDC held in this contract into Aave's lending pool
  function deposit() external override whenNotPaused {
    ILendingPool lp = getLp();
    // Checking the USDC balance of this contract
    uint256 amount = want.balanceOf(address(this));
    if (amount == 0) revert InvalidConditions();

    // If allowance for this contract is too low, approve the max allowance
    if (want.allowance(address(this), address(lp)) < amount) {
      want.safeApprove(address(lp), type(uint256).max);
    }

    // Deposits the full balance of USDC held in this contract into Aave's lending pool
    lp.deposit(address(want), amount, address(this), 0);
  }

  /// @notice Withdraws all USDC from Aave's lending pool back into the Sherlock core contract
  /// @dev Only callable by the Sherlock core contract
  /// @return The final amount withdrawn
  function withdrawAll() external override onlySherlockCore returns (uint256) {
    ILendingPool lp = getLp();
    if (balanceOf() == 0) {
      return 0;
    }
    // Withdraws all USDC from Aave's lending pool and sends it to the Sherlock core contract (msg.sender)
    return lp.withdraw(address(want), type(uint256).max, msg.sender);
  }

  /// @notice Withdraws a specific amount of USDC from Aave's lending pool back into the Sherlock core contract
  /// @param _amount Amount of USDC to withdraw
  function withdraw(uint256 _amount) external override onlySherlockCore {
    // Why do we only check if _amount is equal to the max value?
    if (_amount == type(uint256).max) revert InvalidArgument();

    ILendingPool lp = getLp();
    // Withdraws _amount of USDC and sends it to the Sherlock core contract
    // If the amount withdrawn is not equal to _amount, it reverts
    if (lp.withdraw(address(want), _amount, msg.sender) != _amount) revert InvalidConditions();
  }

  // Claims the stkAAVE rewards and sends them to the receiver address
  function claimRewards() external whenNotPaused {
    // Creates an array with one slot
    address[] memory assets = new address[](1);
    // Sets the slot equal to the address of aUSDC
    assets[0] = address(aWant);

    // Claims all the rewards on aUSDC and sends them to the aaveLmReceiver (an address controlled by governance)
    // Tokens are NOT meant to be (directly) distributed to stakers.
    aaveIncentivesController.claimRewards(assets, type(uint256).max, aaveLmReceiver);
  }

  /// @notice Function used to check if this is the current active yield strategy
  /// @return Boolean indicating it's active
  /// @dev If inactive the owner can pull all ERC20s and ETH
  /// @dev Will be checked by calling the sherlock contract
  function isActive() public view returns (bool) {
    return address(sherlockCore.yieldStrategy()) == address(this);
  }

  // Only contract owner can call this
  // Sends all specified tokens in this contract to the receiver's address (as well as ETH)
  function sweep(address _receiver, IERC20[] memory _extraTokens) external onlyOwner {
    if (_receiver == address(0)) revert ZeroArgument();
    // This contract must NOT be the current assigned yield strategy contract
    if (isActive()) revert InvalidConditions();
    // Executes the sweep for ERC-20s specified in _extraTokens as well as for ETH
    _sweep(_receiver, _extraTokens);
  }
}
