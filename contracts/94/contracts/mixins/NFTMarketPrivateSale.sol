// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";

import "./NFTMarketFees.sol";

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

error NFTMarketPrivateSale_Can_Be_Offered_For_24Hrs_Max();
error NFTMarketPrivateSale_Proxy_Address_Is_Not_A_Contract();
error NFTMarketPrivateSale_Sale_Expired();
error NFTMarketPrivateSale_Signature_Verification_Failed();
error NFTMarketPrivateSale_Too_Much_Value_Provided();

/**
 * @title Allows owners to offer an NFT for sale to a specific collector.
 * @notice Private sales are authorized by the seller with an EIP-712 signature.
 * @dev Private sale offers must be accepted by the buyer before they expire, typically in 24 hours.
 */
abstract contract NFTMarketPrivateSale is NFTMarketFees {
  using AddressUpgradeable for address;

  /// @dev This value was replaced with an immutable version.
  bytes32 private __gap_was_DOMAIN_SEPARATOR;

  /// @notice The domain used in EIP-712 signatures.
  /// @dev It is not a constant so that the chainId can be determined dynamically.
  /// If multiple classes use EIP-712 signatures in the future this can move to a shared file.
  bytes32 private immutable DOMAIN_SEPARATOR;

  /// @notice The hash of the private sale method signature used for EIP-712 signatures.
  bytes32 private constant BUY_FROM_PRIVATE_SALE_TYPEHASH =
    keccak256("BuyFromPrivateSale(address nftContract,uint256 tokenId,address buyer,uint256 price,uint256 deadline)");
  /// @notice The name used in the EIP-712 domain.
  /// @dev If multiple classes use EIP-712 signatures in the future this can move to the shared constants file.
  string private constant NAME = "FNDNFTMarket";

  /**
   * @notice Emitted when an NFT is sold in a private sale.
   * @dev The total amount of this sale is `f8nFee` + `creatorFee` + `ownerRev`.
   * @param nftContract The address of the NFT contract.
   * @param tokenId The ID of the NFT.
   * @param seller The address of the seller.
   * @param buyer The address of the buyer.
   * @param f8nFee The amount of ETH that was sent to Foundation for this sale.
   * @param creatorFee The amount of ETH that was sent to the creator for this sale.
   * @param ownerRev The amount of ETH that was sent to the owner for this sale.
   */
  event PrivateSaleFinalized(
    address indexed nftContract,
    uint256 indexed tokenId,
    address indexed seller,
    address buyer,
    uint256 f8nFee,
    uint256 creatorFee,
    uint256 ownerRev,
    uint256 deadline
  );

  /**
   * @notice Configures the contract to accept EIP-712 signatures.
   * @param marketProxyAddress The address of the proxy contract which will be called when accepting a private sale.
   */
  constructor(address marketProxyAddress) {
    if (!marketProxyAddress.isContract()) {
      revert NFTMarketPrivateSale_Proxy_Address_Is_Not_A_Contract();
    }
    uint256 chainId;
    // solhint-disable-next-line no-inline-assembly
    assembly {
      chainId := chainid()
    }
    DOMAIN_SEPARATOR = keccak256(
      abi.encode(
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
        keccak256(bytes(NAME)),
        // Incrementing the version can be used to invalidate previously signed messages.
        keccak256(bytes("1")),
        chainId,
        marketProxyAddress
      )
    );
  }

  /**
   * @notice Buy an NFT from a private sale.
   * @dev The seller signs a message approving the sale and then the buyer calls this function
   * with the `msg.value` equal to the agreed upon price.
   * @param nftContract The address of the NFT contract.
   * @param tokenId The ID of the NFT.
   * @param deadline The timestamp at which the offer to sell will expire.
   * @param v The v value of the EIP-712 signature.
   * @param r The r value of the EIP-712 signature.
   * @param s The s value of the EIP-712 signature.
   */
  function buyFromPrivateSale(
    IERC721 nftContract,
    uint256 tokenId,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) external payable {
    buyFromPrivateSaleFor(nftContract, tokenId, msg.value, deadline, v, r, s);
  }

  /**
   * @notice Buy an NFT from a private sale.
   * @dev The seller signs a message approving the sale and then the buyer calls this function
   * with the `amount` equal to the agreed upon price.
   * @dev `amount` - `msg.value` is withdrawn from the bidder's FETH balance.
   * @param nftContract The address of the NFT contract.
   * @param tokenId The ID of the NFT.
   * @param amount The amount to buy for, if this is more than `msg.value` funds will be
   * withdrawn from your FETH balance.
   * @param deadline The timestamp at which the offer to sell will expire.
   * @param v The v value of the EIP-712 signature.
   * @param r The r value of the EIP-712 signature.
   * @param s The s value of the EIP-712 signature.
   */
  function buyFromPrivateSaleFor(
    IERC721 nftContract,
    uint256 tokenId,
    uint256 amount,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
  ) public payable nonReentrant {
    if (deadline < block.timestamp) {
      // The signed message from the seller has expired.
      revert NFTMarketPrivateSale_Sale_Expired();
    } else if (deadline > block.timestamp + 2 days) {
      // Private sales typically expire in 24 hours, but 2 days is used here in order to ensure
      // that transactions do not fail due to a minor timezone error or similar during signing.

      // This prevents malicious actors from requesting signatures that never expire.
      revert NFTMarketPrivateSale_Can_Be_Offered_For_24Hrs_Max();
    }

    if (amount > msg.value) {
      // Withdraw additional ETH required from their available FETH balance.

      unchecked {
        // The if above ensures delta will not underflow
        uint256 delta = amount - msg.value;
        feth.marketWithdrawFrom(msg.sender, delta);
      }
    } else if (amount < msg.value) {
      // The terms of the sale cannot change, so if too much ETH is sent then something went wrong.
      revert NFTMarketPrivateSale_Too_Much_Value_Provided();
    }

    // The seller must have the NFT in their wallet when this function is called,
    // otherwise the signature verification below will fail.
    address payable seller = payable(nftContract.ownerOf(tokenId));

    // Scoping this block to avoid a stack too deep error
    {
      bytes32 digest = keccak256(
        abi.encodePacked(
          "\x19\x01",
          DOMAIN_SEPARATOR,
          keccak256(abi.encode(BUY_FROM_PRIVATE_SALE_TYPEHASH, nftContract, tokenId, msg.sender, amount, deadline))
        )
      );

      // Revert if the signature is invalid, the terms are not as expected, or if the seller transferred the NFT.
      if (ecrecover(digest, v, r, s) != seller) {
        revert NFTMarketPrivateSale_Signature_Verification_Failed();
      }
    }

    // This should revert if the seller has not given the market contract approval.
    nftContract.transferFrom(seller, msg.sender, tokenId);

    // Distribute revenue for this sale.
    (uint256 f8nFee, uint256 creatorFee, uint256 ownerRev) = _distributeFunds(
      address(nftContract),
      tokenId,
      seller,
      amount
    );

    emit PrivateSaleFinalized(
      address(nftContract),
      tokenId,
      seller,
      msg.sender,
      f8nFee,
      creatorFee,
      ownerRev,
      deadline
    );
  }

  /**
   * @notice This empty reserved space is put in place to allow future versions to add new
   * variables without shifting down storage in the inheritance chain.
   * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
   */
  uint256[1000] private __gap;
}
