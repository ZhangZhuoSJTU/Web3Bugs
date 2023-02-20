//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';

abstract contract ERC721Payable {
  uint256 public mintFee;
  IERC20 public payableToken;
  bool public isForSale;
  address public royaltyVault;
  address public splitFactory;
  event NewPayment(
    address from,
    address to,
    uint256 amount,
    bool royaltyVaultPayment
  );

  // ---------------- MODIFIER ----------------

  modifier onlyVaultUninitialized() {
    require(
      !royaltyVaultInitialized(),
      'CoreCollection: Royalty Vault already initialized'
    );
    _;
  }

  modifier onlyVaultInitialized() {
    require(
      royaltyVaultInitialized(),
      'CoreCollection: Royalty Vault not initialized'
    );
    _;
  }

  // ---------------- VIEW ----------------

  function royaltyVaultInitialized() public view returns (bool) {
    return royaltyVault != address(0);
  }

  // ---------------- INTERNAL ----------------

  /**
   * @notice Handles the transfer of ERC20 tokens when a token gets minted
   * @dev Tokens are transferred to the Royalty Vault if the vault is set
   * Otherwise, tokens get transferred to the ERC721 collection contract
   * @param _amount The amount of ERC20 to be transferred
   */
  function _handlePayment(uint256 _amount) internal {
    address recipient = royaltyVaultInitialized()
      ? royaltyVault
      : address(this);
    payableToken.transferFrom(msg.sender, recipient, _amount);
    emit NewPayment(msg.sender, recipient, _amount, royaltyVaultInitialized());
  }
}
