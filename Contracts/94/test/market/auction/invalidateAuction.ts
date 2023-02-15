import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { ContractTransaction } from "ethers";
import { ethers } from "hardhat";
import { FNDNFTMarket, MockNFT } from "../../../typechain-types";
import { constants } from "ethers";
import { deployContracts } from "../../helpers/deploy";

describe("Market / auction / invalidateAuction", () => {
  const tokenId = 1;
  const auctionId = 1;
  const price = ethers.utils.parseEther("1");

  let deployer: SignerWithAddress;
  let creator: SignerWithAddress;
  let collector: SignerWithAddress;
  let market: FNDNFTMarket;
  let nft: MockNFT;
  let tx: ContractTransaction;

  beforeEach(async () => {
    [deployer, creator, collector] = await ethers.getSigners();
    ({ nft, market } = await deployContracts({ deployer, creator }));

    // Mint an NFT for testing
    await nft.mint();
    await nft.connect(creator).setApprovalForAll(market.address, true);

    // Create an auction
    await market.connect(creator).createReserveAuction(nft.address, tokenId, price);

    // Set a buy price
    await market.connect(creator).setBuyPrice(nft.address, tokenId, price);
  });

  describe("On `buy`", () => {
    beforeEach(async () => {
      // When someone accepts the buy price, the auction is invalidated since the owner has changed
      tx = await market.connect(collector).buy(nft.address, tokenId, price, { value: price });
    });

    it("Emits ReserveAuctionInvalidated", async () => {
      await expect(tx).to.emit(market, "ReserveAuctionInvalidated").withArgs(auctionId);
    });

    it("cannot read auction id for this token", async () => {
      expect(await market.getReserveAuctionIdFor(nft.address, tokenId)).to.eq(0);
    });
  });
});
