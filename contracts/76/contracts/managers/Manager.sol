// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.10;

/******************************************************************************\
* Author: Evert Kors <dev@sherlock.xyz> (https://twitter.com/evert0x)
* Sherlock Protocol: https://sherlock.xyz
/******************************************************************************/

import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/security/Pausable.sol';

import '../interfaces/managers/IManager.sol';

abstract contract Manager is IManager, Ownable, Pausable {
  using SafeERC20 for IERC20;

  address private constant DEPLOYER = 0xAdBb28C2FEe078440B7088bbcd68DCfA63e55625;
  ISherlock internal sherlockCore;

  modifier onlySherlockCore() {
    if (msg.sender != address(sherlockCore)) revert InvalidSender();
    _;
  }

  /// @notice Set sherlock core address
  /// @param _sherlock Current core contract
  /// @dev Only deployer is able to set core address on all chains except Hardhat network
  /// @dev One time function, will revert once `sherlock` != address(0)
  /// @dev This contract will be deployed first, passed on as argument in core constuctor
  /// @dev emits `SherlockCoreSet`
  function setSherlockCoreAddress(ISherlock _sherlock) external override {
    if (address(_sherlock) == address(0)) revert ZeroArgument();
    // 31337 is of the Hardhat network blockchain
    if (block.chainid != 31337 && msg.sender != DEPLOYER) revert InvalidSender();

    if (address(sherlockCore) != address(0)) revert InvalidConditions();
    sherlockCore = _sherlock;

    emit SherlockCoreSet(_sherlock);
  }

  // Internal function to send tokens remaining in a contract to the receiver address
  function _sweep(address _receiver, IERC20[] memory _extraTokens) internal {
    // Loops through the extra tokens (ERC20) provided and sends all of them to the receiver address
    for (uint256 i; i < _extraTokens.length; i++) {
      IERC20 token = _extraTokens[i];
      token.safeTransfer(_receiver, token.balanceOf(address(this)));
    }
    // Sends any remaining ETH to the receiver address (as long as receiver address is payable)
    (bool success, ) = _receiver.call{ value: address(this).balance }('');
    if (success == false) revert InvalidConditions();
  }

  function pause() external onlySherlockCore {
    _pause();
  }

  function unpause() external onlySherlockCore {
    _unpause();
  }
}
