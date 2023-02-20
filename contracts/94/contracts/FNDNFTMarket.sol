/*
  ･
   *　★
      ･ ｡
        　･　ﾟ☆ ｡
  　　　 *　★ ﾟ･｡ *  ｡
          　　* ☆ ｡･ﾟ*.｡
      　　　ﾟ *.｡☆｡★　･
​
                      `                     .-:::::-.`              `-::---...```
                     `-:`               .:+ssssoooo++//:.`       .-/+shhhhhhhhhhhhhyyyssooo:
                    .--::.            .+ossso+/////++/:://-`   .////+shhhhhhhhhhhhhhhhhhhhhy
                  `-----::.         `/+////+++///+++/:--:/+/-  -////+shhhhhhhhhhhhhhhhhhhhhy
                 `------:::-`      `//-.``.-/+ooosso+:-.-/oso- -////+shhhhhhhhhhhhhhhhhhhhhy
                .--------:::-`     :+:.`  .-/osyyyyyyso++syhyo.-////+shhhhhhhhhhhhhhhhhhhhhy
              `-----------:::-.    +o+:-.-:/oyhhhhhhdhhhhhdddy:-////+shhhhhhhhhhhhhhhhhhhhhy
             .------------::::--  `oys+/::/+shhhhhhhdddddddddy/-////+shhhhhhhhhhhhhhhhhhhhhy
            .--------------:::::-` +ys+////+yhhhhhhhddddddddhy:-////+yhhhhhhhhhhhhhhhhhhhhhy
          `----------------::::::-`.ss+/:::+oyhhhhhhhhhhhhhhho`-////+shhhhhhhhhhhhhhhhhhhhhy
         .------------------:::::::.-so//::/+osyyyhhhhhhhhhys` -////+shhhhhhhhhhhhhhhhhhhhhy
       `.-------------------::/:::::..+o+////+oosssyyyyyyys+`  .////+shhhhhhhhhhhhhhhhhhhhhy
       .--------------------::/:::.`   -+o++++++oooosssss/.     `-//+shhhhhhhhhhhhhhhhhhhhyo
     .-------   ``````.......--`        `-/+ooooosso+/-`          `./++++///:::--...``hhhhyo
                                              `````
   *　
      ･ ｡
　　　　･　　ﾟ☆ ｡
  　　　 *　★ ﾟ･｡ *  ｡
          　　* ☆ ｡･ﾟ*.｡
      　　　ﾟ *.｡☆｡★　･
    *　　ﾟ｡·*･｡ ﾟ*
  　　　☆ﾟ･｡°*. ﾟ
　 ･ ﾟ*｡･ﾟ★｡
　　･ *ﾟ｡　　 *
　･ﾟ*｡★･
 ☆∴｡　*
･ ｡
*/

// SPDX-License-Identifier: MIT OR Apache-2.0

pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

import "./mixins/Constants.sol";
import "./mixins/FoundationTreasuryNode.sol";
import "./mixins/NFTMarketAuction.sol";
import "./mixins/NFTMarketBuyPrice.sol";
import "./mixins/NFTMarketCore.sol";
import "./mixins/NFTMarketCreators.sol";
import "./mixins/NFTMarketFees.sol";
import "./mixins/NFTMarketOffer.sol";
import "./mixins/NFTMarketPrivateSale.sol";
import "./mixins/NFTMarketReserveAuction.sol";
import "./mixins/SendValueWithFallbackWithdraw.sol";

/**
 * @title A market for NFTs on Foundation.
 * @notice The Foundation marketplace is a contract which allows traders to buy and sell NFTs.
 * It supports buying and selling via auctions, private sales, buy price, and offers.
 * @dev All sales in the Foundation market will pay the creator 10% royalties on secondary sales. This is not specific
 * to NFTs minted on Foundation, it should work for any NFT. If royalty information was not defined when the NFT was
 * originally deployed, it may be added using the [Royalty Registry](https://royaltyregistry.xyz/) which will be
 * respected by our market contract.
 */
contract FNDNFTMarket is
  Constants,
  Initializable,
  FoundationTreasuryNode,
  NFTMarketCore,
  ReentrancyGuardUpgradeable,
  NFTMarketCreators,
  SendValueWithFallbackWithdraw,
  NFTMarketFees,
  NFTMarketAuction,
  NFTMarketReserveAuction,
  NFTMarketPrivateSale,
  NFTMarketBuyPrice,
  NFTMarketOffer
{
  /**
   * @notice Set immutable variables for the implementation contract.
   * @dev Using immutable instead of constants allows us to use different values on testnet.
   */
  constructor(
    address payable treasury,
    address feth,
    address royaltyRegistry,
    uint256 duration,
    address marketProxyAddress
  )
    FoundationTreasuryNode(treasury)
    NFTMarketCore(feth)
    NFTMarketCreators(royaltyRegistry)
    NFTMarketReserveAuction(duration)
    NFTMarketPrivateSale(marketProxyAddress) // solhint-disable-next-line no-empty-blocks
  {}

  /**
   * @notice Called once to configure the contract after the initial proxy deployment.
   * @dev This farms the initialize call out to inherited contracts as needed to initialize mutable variables.
   */
  function initialize() external initializer {
    NFTMarketAuction._initializeNFTMarketAuction();
  }

  /**
   * @inheritdoc NFTMarketCore
   * @dev This is a no-op function required to avoid compile errors.
   */
  function _afterAuctionStarted(address nftContract, uint256 tokenId)
    internal
    override(NFTMarketCore, NFTMarketBuyPrice, NFTMarketOffer)
  {
    super._afterAuctionStarted(nftContract, tokenId);
  }

  /**
   * @inheritdoc NFTMarketCore
   * @dev This is a no-op function required to avoid compile errors.
   */
  function _transferFromEscrow(
    address nftContract,
    uint256 tokenId,
    address recipient,
    address seller
  ) internal override(NFTMarketCore, NFTMarketReserveAuction, NFTMarketBuyPrice, NFTMarketOffer) {
    super._transferFromEscrow(nftContract, tokenId, recipient, seller);
  }

  /**
   * @inheritdoc NFTMarketCore
   * @dev This is a no-op function required to avoid compile errors.
   */
  function _transferFromEscrowIfAvailable(
    address nftContract,
    uint256 tokenId,
    address recipient
  ) internal override(NFTMarketCore, NFTMarketReserveAuction, NFTMarketBuyPrice) {
    super._transferFromEscrowIfAvailable(nftContract, tokenId, recipient);
  }

  /**
   * @inheritdoc NFTMarketCore
   * @dev This is a no-op function required to avoid compile errors.
   */
  function _transferToEscrow(address nftContract, uint256 tokenId)
    internal
    override(NFTMarketCore, NFTMarketReserveAuction, NFTMarketBuyPrice)
  {
    super._transferToEscrow(nftContract, tokenId);
  }

  /**
   * @inheritdoc NFTMarketCore
   * @dev This is a no-op function required to avoid compile errors.
   */
  function _getSellerFor(address nftContract, uint256 tokenId)
    internal
    view
    override(NFTMarketCore, NFTMarketReserveAuction, NFTMarketBuyPrice)
    returns (address payable seller)
  {
    return super._getSellerFor(nftContract, tokenId);
  }
}
