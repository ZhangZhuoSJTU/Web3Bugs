pragma solidity ^0.8.0;

import "../interface/INFTXVault.sol";
import "../interface/INFTXVaultFactory.sol";
import "../interface/IERC3156Upgradeable.sol";
import "../token/ERC20Upgradeable.sol";

interface ClaimToken {
  function claim(uint256[] calldata ids) external returns (uint256);
  function accumulated(uint256 tokenIndex) external returns (uint256);
}

// Author: 0xKiwi. 

contract NFTXFlashSwipe is IERC3156FlashBorrowerUpgradeable {
  uint256 constant BASE = 10**18;
  INFTXVaultFactory public nftxFactory;
  
  ClaimToken NCT = ClaimToken(0x8A9c4dfe8b9D8962B31e4e16F8321C44d48e246E);
  ClaimToken WET = ClaimToken(0x76280AF9D18a868a0aF3dcA95b57DDE816c1aaf2);
  address tempLender;

  enum Type {
    Hashmasks,
    Waifusion
  }

  struct VaultData {
    uint256 vaultId;
    address vaultAddr;
    uint256 count;
    uint256[] specificIds;
    address operator;
    Type swipeType;
  }

  function flashSwipeNCT(address operator, uint256 count, uint256[] calldata specificIds) public {
    flashSwipe(operator, 6, count, specificIds, Type.Hashmasks);
  }

  function flashSwipeWET(address operator, uint256 count, uint256[] calldata specificIds) public {
    flashSwipe(operator, 10, count, specificIds, Type.Waifusion);
  }

  function flashSwipe(address operator, uint256 vaultId, uint256 count, uint256[] calldata specificIds, Type swipeType) public {
    // Small protection to protect from frontrunning.
    require(operator == msg.sender, "No frontrun pls");
    address vault = nftxFactory.vault(vaultId);
    // Calculate and pull mint/redeem fees.
    uint256 targetRedeemFee = INFTXVault(vault).targetRedeemFee() * specificIds.length;
    uint256 mintFee = INFTXVault(vault).mintFee() * count;
    IERC20Upgradeable(vault).transferFrom(msg.sender, address(this), mintFee + targetRedeemFee);

    // Approve flash loan amount.
    uint256 allowance = IERC20Upgradeable(vault).allowance(address(this), address(vault));
    uint256 amount = count ** BASE;
    IERC20Upgradeable(vault).approve(address(vault), allowance + count);

    // Prepare for flash loan callback.
    bytes memory loanData = abi.encode(VaultData(vaultId, vault, count, specificIds, operator, swipeType));
    tempLender = vault;
    IERC3156FlashLenderUpgradeable(vault).flashLoan(this, vault, amount, loanData);
    tempLender = address(0);
  }

  function onFlashLoan(
    address initiator,
    address token,
    uint256 amount,
    uint256 /* fee */,
    bytes calldata data
  ) external override returns (bytes32) {
    require(
        initiator == address(this),
        "FlashSwipe: Untrusted loan initiator"
    );
    require(
        msg.sender == address(tempLender),
        "FlashSwipe: Untrusted lender"
    );
    (VaultData memory loanData) = abi.decode(data, (VaultData));
    uint256[] memory redeemedIds = flashRedeem(loanData);
    // Perform rest of process, mint back, etc.

    if (loanData.swipeType == Type.Waifusion) {
      uint256 claimedAmount = WET.claim(redeemedIds);
      ERC20Upgradeable(address(WET)).transfer(loanData.operator, claimedAmount);
    } else if (loanData.swipeType == Type.Hashmasks) {
      uint256 claimedAmount = NCT.claim(redeemedIds);
      ERC20Upgradeable(address(NCT)).transfer(loanData.operator, claimedAmount);
    }

    flashMint(loanData.vaultAddr, redeemedIds);
    return keccak256("ERC3156FlashBorrower.onFlashLoan");
  }

  function flashRedeem(VaultData memory loanData) internal returns (uint256[] memory) {
    return INFTXVault(loanData.vaultAddr).redeem(loanData.count, loanData.specificIds);
  }

  function flashMint(address vault, uint256[] memory specificIds) internal {
    uint256[] memory empty;
    INFTXVault(vault).mint(specificIds, empty);
  }
}