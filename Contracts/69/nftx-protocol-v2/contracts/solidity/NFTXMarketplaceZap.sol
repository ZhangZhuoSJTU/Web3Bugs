// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./interface/INFTXVault.sol";
import "./interface/INFTXVaultFactory.sol";
import "./interface/INFTXFeeDistributor.sol";
import "./interface/INFTXLPStaking.sol";
import "./interface/ITimelockRewardDistributionToken.sol";
import "./interface/IUniswapV2Router01.sol";
import "./testing/IERC721.sol";
import "./token/IERC1155Upgradeable.sol";
import "./token/IERC20Upgradeable.sol";
import "./token/ERC721HolderUpgradeable.sol";
import "./token/ERC1155HolderUpgradeable.sol";
import "./util/OwnableUpgradeable.sol";

// Authors: @0xKiwi_.

interface IWETH {
  function deposit() external payable;
  function transfer(address to, uint value) external returns (bool);
  function withdraw(uint) external;
  function balanceOf(address to) external view returns (uint256);
}

/**
 * @dev Contract module that helps prevent reentrant calls to a function.
 *
 * Inheriting from `ReentrancyGuard` will make the {nonReentrant} modifier
 * available, which can be applied to functions to make sure there are no nested
 * (reentrant) calls to them.
 *
 * Note that because there is a single `nonReentrant` guard, functions marked as
 * `nonReentrant` may not call one another. This can be worked around by making
 * those functions `private`, and then adding `external` `nonReentrant` entry
 * points to them.
 *
 * TIP: If you would like to learn more about reentrancy and alternative ways
 * to protect against it, check out our blog post
 * https://blog.openzeppelin.com/reentrancy-after-istanbul/[Reentrancy After Istanbul].
 */
abstract contract ReentrancyGuard {
    // Booleans are more expensive than uint256 or any type that takes up a full
    // word because each write operation emits an extra SLOAD to first read the
    // slot's contents, replace the bits taken up by the boolean, and then write
    // back. This is the compiler's defense against contract upgrades and
    // pointer aliasing, and it cannot be disabled.

    // The values being non-zero value makes deployment a bit more expensive,
    // but in exchange the refund on every call to nonReentrant will be lower in
    // amount. Since refunds are capped to a percentage of the total
    // transaction's gas, it is best to keep them low in cases like this one, to
    // increase the likelihood of the full refund coming into effect.
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;

    uint256 private _status;

    constructor() {
        _status = _NOT_ENTERED;
    }

    /**
     * @dev Prevents a contract from calling itself, directly or indirectly.
     * Calling a `nonReentrant` function from another `nonReentrant`
     * function is not supported. It is possible to prevent this from happening
     * by making the `nonReentrant` function external, and make it call a
     * `private` function that does the actual work.
     */
    modifier nonReentrant() {
        // On the first call to nonReentrant, _notEntered will be true
        require(_status != _ENTERED, "ReentrancyGuard: reentrant call");

        // Any calls to nonReentrant after this point will fail
        _status = _ENTERED;

        _;

        // By storing the original value once again, a refund is triggered (see
        // https://eips.ethereum.org/EIPS/eip-2200)
        _status = _NOT_ENTERED;
    }
}

/**
 * @dev Contract module which provides a basic access control mechanism, where
 * there is an account (an owner) that can be granted exclusive access to
 * specific functions.
 *
 * By default, the owner account will be the one that deploys the contract. This
 * can later be changed with {transferOwnership}.
 *
 * This module is used through inheritance. It will make available the modifier
 * `onlyOwner`, which can be applied to your functions to restrict their use to
 * the owner.
 */
abstract contract Ownable {
    address private _owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
     * @dev Initializes the contract setting the deployer as the initial owner.
     */
    constructor() {
        _setOwner(msg.sender);
    }

    /**
     * @dev Returns the address of the current owner.
     */
    function owner() public view virtual returns (address) {
        return _owner;
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        require(owner() == msg.sender, "Ownable: caller is not the owner");
        _;
    }

    /**
     * @dev Leaves the contract without owner. It will not be possible to call
     * `onlyOwner` functions anymore. Can only be called by the current owner.
     *
     * NOTE: Renouncing ownership will leave the contract without an owner,
     * thereby removing any functionality that is only available to the owner.
     */
    function renounceOwnership() public virtual onlyOwner {
        _setOwner(address(0));
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferOwnership(address newOwner) public virtual onlyOwner {
        require(newOwner != address(0), "Ownable: new owner is the zero address");
        _setOwner(newOwner);
    }

    function _setOwner(address newOwner) private {
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}

contract NFTXMarketplaceZap is Ownable, ReentrancyGuard, ERC721HolderUpgradeable, ERC1155HolderUpgradeable {
  IWETH public immutable WETH; 
  INFTXLPStaking public immutable lpStaking;
  INFTXVaultFactory public immutable nftxFactory;
  IUniswapV2Router01 public immutable sushiRouter;

  uint256 constant BASE = 10**18;

  event Buy(uint256 count, uint256 ethSpent, address to);
  event Sell(uint256 count, uint256 ethReceived, address to);
  event Swap(uint256 count, uint256 ethSpent, address to);

  constructor(address _nftxFactory, address _sushiRouter) Ownable() ReentrancyGuard() {
    nftxFactory = INFTXVaultFactory(_nftxFactory);
    lpStaking = INFTXLPStaking(INFTXFeeDistributor(INFTXVaultFactory(_nftxFactory).feeDistributor()).lpStaking());
    sushiRouter = IUniswapV2Router01(_sushiRouter);
    WETH = IWETH(IUniswapV2Router01(_sushiRouter).WETH());
    IERC20Upgradeable(address(IUniswapV2Router01(_sushiRouter).WETH())).approve(_sushiRouter, type(uint256).max);
  }

  function mintAndSell721(
    uint256 vaultId, 
    uint256[] memory ids, 
    uint256 minWethOut, 
    address[] calldata path,
    address to
  ) public nonReentrant {
    require(to != address(0));
    require(ids.length != 0);
    (address vault, uint256 vaultBalance) = _mint721(vaultId, ids);
    uint256[] memory amounts = _sellVaultTokenETH(vault, minWethOut, vaultBalance, path, to);
    emit Sell(ids.length, amounts[1], to);
  }

  function mintAndSell721WETH(
    uint256 vaultId, 
    uint256[] memory ids, 
    uint256 minWethOut, 
    address[] calldata path,
    address to
  ) public nonReentrant {
    require(to != address(0));
    require(ids.length != 0);
    (address vault, uint256 vaultBalance) = _mint721(vaultId, ids);
    uint256[] memory amounts = _sellVaultTokenWETH(vault, minWethOut, vaultBalance, path, to);
    emit Sell(ids.length, amounts[1], to);
  }

  function buyAndSwap721(
    uint256 vaultId, 
    uint256[] memory idsIn, 
    uint256[] memory specificIds, 
    address[] calldata path,
    address to
  ) public payable nonReentrant {
    require(to != address(0));
    require(idsIn.length != 0);
    WETH.deposit{value: msg.value}();
    INFTXVault vault = INFTXVault(nftxFactory.vault(vaultId));
    uint256 redeemFees = (vault.targetSwapFee() * specificIds.length) + (
        vault.randomSwapFee() * (idsIn.length - specificIds.length)
    );
    uint256[] memory amounts = _buyVaultToken(address(vault), redeemFees, msg.value, path);
    _swap721(vaultId, idsIn, specificIds, to);

    emit Swap(idsIn.length, amounts[0], to);

    // Return extras.
    uint256 remaining = WETH.balanceOf(address(this));
    WETH.withdraw(remaining);
    (bool success, ) = payable(to).call{value: remaining}("");
    require(success, "Address: unable to send value, recipient may have reverted");
  }

  function buyAndSwap721WETH(
    uint256 vaultId, 
    uint256[] memory idsIn, 
    uint256[] memory specificIds, 
    uint256 maxWethIn, 
    address[] calldata path,
    address to
  ) public nonReentrant {
    require(to != address(0));
    require(idsIn.length != 0);
    IERC20Upgradeable(address(WETH)).transferFrom(msg.sender, address(this), maxWethIn);
    INFTXVault vault = INFTXVault(nftxFactory.vault(vaultId));
    uint256 redeemFees = (vault.targetSwapFee() * specificIds.length) + (
        vault.randomSwapFee() * (idsIn.length - specificIds.length)
    );
    uint256[] memory amounts = _buyVaultToken(address(vault), redeemFees, maxWethIn, path);
    _swap721(vaultId, idsIn, specificIds, to);

    emit Swap(idsIn.length, amounts[0], to);

    // Return extras.
    uint256 remaining = WETH.balanceOf(address(this));
    WETH.transfer(to, remaining);
  }

  function buyAndSwap1155(
    uint256 vaultId, 
    uint256[] memory idsIn, 
    uint256[] memory amounts, 
    uint256[] memory specificIds, 
    address[] calldata path,
    address to
  ) public payable nonReentrant {
    require(to != address(0));
    require(idsIn.length != 0);
    WETH.deposit{value: msg.value}();
    uint256 count;
    for (uint256 i = 0; i < idsIn.length; i++) {
        uint256 amount = amounts[i];
        require(amount > 0, "Transferring < 1");
        count += amount;
    }
    INFTXVault vault = INFTXVault(nftxFactory.vault(vaultId));
    uint256 redeemFees = (vault.targetSwapFee() * specificIds.length) + (
        vault.randomSwapFee() * (count - specificIds.length)
    );
    uint256[] memory swapAmounts = _buyVaultToken(address(vault), redeemFees, msg.value, path);
    _swap1155(vaultId, idsIn, amounts, specificIds, to);

    emit Swap(count, swapAmounts[0], to);

    // Return extras.
    uint256 remaining = WETH.balanceOf(address(this));
    WETH.withdraw(remaining);
    (bool success, ) = payable(to).call{value: remaining}("");
    require(success, "Address: unable to send value, recipient may have reverted");
  }

  function buyAndSwap1155WETH(
    uint256 vaultId, 
    uint256[] memory idsIn, 
    uint256[] memory amounts, 
    uint256[] memory specificIds, 
    uint256 maxWethIn, 
    address[] calldata path,
    address to
  ) public payable nonReentrant {
    require(to != address(0));
    require(idsIn.length != 0);
    IERC20Upgradeable(address(WETH)).transferFrom(msg.sender, address(this), maxWethIn);
    uint256 count;
    for (uint256 i = 0; i < idsIn.length; i++) {
        uint256 amount = amounts[i];
        require(amount > 0, "Transferring < 1");
        count += amount;
    }
    INFTXVault vault = INFTXVault(nftxFactory.vault(vaultId));
    uint256 redeemFees = (vault.targetSwapFee() * specificIds.length) + (
        vault.randomSwapFee() * (count - specificIds.length)
    );
    uint256[] memory swapAmounts = _buyVaultToken(address(vault), redeemFees, msg.value, path);
    _swap1155(vaultId, idsIn, amounts, specificIds, to);

    emit Swap(count, swapAmounts[0], to);

    // Return extras.
    uint256 remaining = WETH.balanceOf(address(this));
    WETH.transfer(to, remaining);
  }

  function buyAndRedeem(
    uint256 vaultId, 
    uint256 amount,
    uint256[] memory specificIds, 
    address[] calldata path,
    address to
  ) public payable nonReentrant {
    require(to != address(0));
    require(amount != 0);
    WETH.deposit{value: msg.value}();
    INFTXVault vault = INFTXVault(nftxFactory.vault(vaultId));
    uint256 totalFee = (vault.targetRedeemFee() * specificIds.length) + (
        vault.randomRedeemFee() * (amount - specificIds.length)
    );
    uint256[] memory amounts = _buyVaultToken(address(vault), (amount*BASE)+totalFee, msg.value, path);
    _redeem(vaultId, amount, specificIds, to);

    emit Buy(amount, amounts[0], to);

    uint256 remaining = WETH.balanceOf(address(this));
    WETH.withdraw(remaining);
    (bool success, ) = payable(to).call{value: remaining}("");
    require(success, "Address: unable to send value, recipient may have reverted");
  }

  function buyAndRedeemWETH(
    uint256 vaultId, 
    uint256 amount,
    uint256[] memory specificIds, 
    uint256 maxWethIn, 
    address[] calldata path,
    address to
  ) public nonReentrant {
    require(to != address(0));
    require(amount != 0);
    IERC20Upgradeable(address(WETH)).transferFrom(msg.sender, address(this), maxWethIn);
    INFTXVault vault = INFTXVault(nftxFactory.vault(vaultId));
    uint256 totalFee = (vault.targetRedeemFee() * specificIds.length) + (
        vault.randomRedeemFee() * (amount - specificIds.length)
    );
    uint256[] memory amounts = _buyVaultToken(address(vault), (amount*BASE) + totalFee, maxWethIn, path);
    _redeem(vaultId, amount, specificIds, to);

    emit Buy(amount, amounts[0], to);

    uint256 remaining = WETH.balanceOf(address(this));
    WETH.transfer(to, remaining);
  }

  function mintAndSell1155(
    uint256 vaultId, 
    uint256[] memory ids, 
    uint256[] memory amounts,
    uint256 minWethOut, 
    address[] calldata path,
    address to
  ) public nonReentrant {
    require(to != address(0));
    require(ids.length != 0);
    (address vault, uint256 vaultTokenBalance) = _mint1155(vaultId, ids, amounts);
    uint256[] memory amounts = _sellVaultTokenETH(vault, minWethOut, vaultTokenBalance, path, to);

    uint256 count;
    for (uint256 i = 0; i < ids.length; i++) {
        count += amounts[i];
    }
    emit Sell(count, amounts[1], to);
  }

  function mintAndSell1155WETH(
    uint256 vaultId, 
    uint256[] memory ids, 
    uint256[] memory amounts,
    uint256 minWethOut, 
    address[] calldata path,
    address to
  ) public nonReentrant {
    require(to != address(0));
    require(ids.length != 0);
    (address vault, uint256 vaultTokenBalance) = _mint1155(vaultId, ids, amounts);
    _sellVaultTokenWETH(vault, minWethOut, vaultTokenBalance, path, to);

    uint256 count;
    for (uint256 i = 0; i < ids.length; i++) {
        count += amounts[i];
    }
    emit Sell(count, amounts[1], to);
  }

  function _mint721(
    uint256 vaultId, 
    uint256[] memory ids
  ) internal returns (address, uint256) {
    address vault = nftxFactory.vault(vaultId);
    require(vault != address(0), "NFTXZap: Vault does not exist");

    // Transfer tokens to zap and mint to NFTX.
    address assetAddress = INFTXVault(vault).assetAddress();
    for (uint256 i = 0; i < ids.length; i++) {
      transferFromERC721(assetAddress, ids[i], vault);
      approveERC721(assetAddress, vault, ids[i]);
    }
    uint256[] memory emptyIds;
    uint256 count = INFTXVault(vault).mint(ids, emptyIds);
    uint256 balance = (count * BASE) - (count * INFTXVault(vault).mintFee()); 
    require(balance == IERC20Upgradeable(vault).balanceOf(address(this)), "Did not receive expected balance");
    
    return (vault, balance);
  }

  function _swap721(
    uint256 vaultId, 
    uint256[] memory idsIn,
    uint256[] memory idsOut,
    address to
  ) internal returns (address) {
    address vault = nftxFactory.vault(vaultId);
    require(vault != address(0), "NFTXZap: Vault does not exist");

    // Transfer tokens to zap and mint to NFTX.
    address assetAddress = INFTXVault(vault).assetAddress();
    for (uint256 i = 0; i < idsIn.length; i++) {
      transferFromERC721(assetAddress, idsIn[i], vault);
      approveERC721(assetAddress, vault, idsIn[i]);
    }
    uint256[] memory emptyIds;
    INFTXVault(vault).swapTo(idsIn, emptyIds, idsOut, to);
    
    return (vault);
  }

  function _swap1155(
    uint256 vaultId, 
    uint256[] memory idsIn,
    uint256[] memory amounts,
    uint256[] memory idsOut,
    address to
  ) internal returns (address) {
    address vault = nftxFactory.vault(vaultId);
    require(vault != address(0), "NFTXZap: Vault does not exist");

    // Transfer tokens to zap and mint to NFTX.
    address assetAddress = INFTXVault(vault).assetAddress();
    IERC1155Upgradeable(assetAddress).safeBatchTransferFrom(msg.sender, address(this), idsIn, amounts, "");
    IERC1155Upgradeable(assetAddress).setApprovalForAll(vault, true);
    INFTXVault(vault).swapTo(idsIn, amounts, idsOut, to);
    
    return (vault);
  }

  function _redeem(
    uint256 vaultId, 
    uint256 amount,
    uint256[] memory specificIds,
    address to
  ) internal {
    address vault = nftxFactory.vault(vaultId);
    require(vault != address(0), "NFTXZap: Vault does not exist");
    INFTXVault(vault).redeemTo(amount, specificIds, to);
  }

  function _mint1155(
    uint256 vaultId, 
    uint256[] memory ids,
    uint256[] memory amounts
  ) internal returns (address, uint256) {
    address vault = nftxFactory.vault(vaultId);
    require(vault != address(0), "NFTXZap: Vault does not exist");

    // Transfer tokens to zap and mint to NFTX.
    address assetAddress = INFTXVault(vault).assetAddress();
    IERC1155Upgradeable(assetAddress).safeBatchTransferFrom(msg.sender, address(this), ids, amounts, "");
    IERC1155Upgradeable(assetAddress).setApprovalForAll(vault, true);
    uint256 count = INFTXVault(vault).mint(ids, amounts);
    uint256 balance = (count * BASE) - INFTXVault(vault).mintFee()*count;
    require(balance == IERC20Upgradeable(vault).balanceOf(address(this)), "Did not receive expected balance");
    
    return (vault, balance);
  }

  function _buyVaultToken(
    address vault, 
    uint256 minTokenOut, 
    uint256 maxWethIn, 
    address[] calldata path
  ) internal returns (uint256[] memory) {
    uint256[] memory amounts = sushiRouter.swapTokensForExactTokens(
      minTokenOut,
      maxWethIn,
      path, 
      address(this),
      block.timestamp
    );

    return amounts;
  }
  function _sellVaultTokenWETH(
    address vault, 
    uint256 minWethOut, 
    uint256 maxTokenIn, 
    address[] calldata path,
    address to
  ) internal returns (uint256[] memory) {
    IERC20Upgradeable(vault).approve(address(sushiRouter), maxTokenIn);
    uint256[] memory amounts = sushiRouter.swapExactTokensForTokens(
      maxTokenIn,
      minWethOut,
      path, 
      to,
      block.timestamp
    );

    return amounts;
  }

  function _sellVaultTokenETH(
    address vault, 
    uint256 minWethOut, 
    uint256 maxTokenIn, 
    address[] calldata path,
    address to
  ) internal returns (uint256[] memory) {
    IERC20Upgradeable(vault).approve(address(sushiRouter), maxTokenIn);
    uint256[] memory amounts = sushiRouter.swapExactTokensForETH(
      maxTokenIn,
      minWethOut,
      path, 
      to,
      block.timestamp
    );

    return amounts;
  }

  function transferFromERC721(address assetAddr, uint256 tokenId, address to) internal virtual {
    address kitties = 0x06012c8cf97BEaD5deAe237070F9587f8E7A266d;
    address punks = 0xb47e3cd837dDF8e4c57F05d70Ab865de6e193BBB;
    bytes memory data;
    if (assetAddr == kitties) {
        // Cryptokitties.
        data = abi.encodeWithSignature("transferFrom(address,address,uint256)", msg.sender, address(this), tokenId);
    } else if (assetAddr == punks) {
        // CryptoPunks.
        // Fix here for frontrun attack. Added in v1.0.2.
        bytes memory punkIndexToAddress = abi.encodeWithSignature("punkIndexToAddress(uint256)", tokenId);
        (bool checkSuccess, bytes memory result) = address(assetAddr).staticcall(punkIndexToAddress);
        (address owner) = abi.decode(result, (address));
        require(checkSuccess && owner == msg.sender, "Not the owner");
        data = abi.encodeWithSignature("buyPunk(uint256)", tokenId);
    } else {
        // Default.
        // We push to the vault to avoid an unneeded transfer.
        data = abi.encodeWithSignature("safeTransferFrom(address,address,uint256)", msg.sender, to, tokenId);
    }
    (bool success, bytes memory resultData) = address(assetAddr).call(data);
    require(success, string(resultData));
  }

  function approveERC721(address assetAddr, address to, uint256 tokenId) internal virtual {
    address kitties = 0x06012c8cf97BEaD5deAe237070F9587f8E7A266d;
    address punks = 0xb47e3cd837dDF8e4c57F05d70Ab865de6e193BBB;
    bytes memory data;
    if (assetAddr == kitties) {
        // Cryptokitties.
        data = abi.encodeWithSignature("approve(address,uint256)", to, tokenId);
    } else if (assetAddr == punks) {
        // CryptoPunks.
        data = abi.encodeWithSignature("offerPunkForSaleToAddress(uint256,uint256,address)", tokenId, 0, to);
    } else {
      // No longer needed to approve with pushing.
      return;
    }
    (bool success, bytes memory resultData) = address(assetAddr).call(data);
    require(success, string(resultData));
  }

  // calculates the CREATE2 address for a pair without making any external calls
  function pairFor(address tokenA, address tokenB) internal view returns (address pair) {
    (address token0, address token1) = sortTokens(tokenA, tokenB);
    pair = address(uint160(uint256(keccak256(abi.encodePacked(
      hex'ff',
      sushiRouter.factory(),
      keccak256(abi.encodePacked(token0, token1)),
      hex'e18a34eb0e04b04f7a0ac29a6e80748dca96319b42c54d679cb821dca90c6303' // init code hash
    )))));
  }

  // returns sorted token addresses, used to handle return values from pairs sorted in this order
  function sortTokens(address tokenA, address tokenB) internal pure returns (address token0, address token1) {
      require(tokenA != tokenB, 'UniswapV2Library: IDENTICAL_ADDRESSES');
      (token0, token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
      require(token0 != address(0), 'UniswapV2Library: ZERO_ADDRESS');
  }

  receive() external payable {

  }
}
