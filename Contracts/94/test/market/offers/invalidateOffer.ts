import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ContractTransaction } from "ethers";
import { ethers } from "hardhat";
import { FETH, FNDNFTMarket, FoundationTreasury, MockNFT } from "../../../typechain-types";
import { deployContracts } from "../../helpers/deploy";
import { getFethExpectedExpiration } from "../../helpers/feth";

describe("market / offers / invalidateOffer", function () {
  const tokenId = 1;
  const auctionId = 1;
  const price = ethers.utils.parseEther("1");

  let market: FNDNFTMarket;
  let nft: MockNFT;
  let feth: FETH;
  let deployer: SignerWithAddress;
  let creator: SignerWithAddress;
  let collector: SignerWithAddress;
  let bidder: SignerWithAddress;
  let tx: ContractTransaction;
  let expiry: number;

  beforeEach(async () => {
    [deployer, creator, collector, bidder] = await ethers.getSigners();
    ({ nft, market, feth } = await deployContracts({ deployer, creator }));

    // Mint and approve NFT 1 for testing
    await nft.mint();
    await nft.setApprovalForAll(market.address, true);

    // Make an offer
    tx = await market.connect(collector).makeOffer(nft.address, tokenId, price, { value: price });
    expiry = await getFethExpectedExpiration(tx);

    // Create an auction to invalidate the offer
    await market.connect(creator).createReserveAuction(nft.address, tokenId, price);
  });

  it("The offer is still valid when there is a reserve price", async () => {
    const offer = await market.getOffer(nft.address, tokenId);
    expect(offer.amount).to.eq(price);
  });

  describe("Invalidate on auction start", () => {
    beforeEach(async () => {
      // When a bid is placed, the NFT is reserved for the winner of the auction
      tx = await market.connect(bidder).placeBid(auctionId, { value: price });
    });

    it("Emits OfferInvalidated", async () => {
      await expect(tx).to.emit(market, "OfferInvalidated").withArgs(nft.address, tokenId);
    });

    it("The FETH balance is now available for use", async () => {
      const balanceOf = await feth.balanceOf(collector.address);
      expect(balanceOf).to.eq(price);
    });

    it("Token lockup does not apply", async () => {
      const lockups = await feth.getLockups(collector.address);
      expect(lockups.amounts.length).to.eq(0);
    });

    it("The offer is no longer found", async () => {
      const offer = await market.getOffer(nft.address, tokenId);
      expect(offer.amount).to.eq(0);
      expect(offer.buyer).to.eq(ethers.constants.AddressZero);
    });
  });
});
