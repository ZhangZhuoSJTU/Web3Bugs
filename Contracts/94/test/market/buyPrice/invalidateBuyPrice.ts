import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ContractTransaction } from "ethers";
import { ethers } from "hardhat";
import { FNDNFTMarket, FoundationTreasury, MockNFT } from "../../../typechain-types";
import { deployContracts } from "../../helpers/deploy";

describe("market / buyPrice / invalidateBuyPrice", function () {
  const tokenId = 1;
  const auctionId = 1;
  const price = ethers.utils.parseEther("1");

  let market: FNDNFTMarket;
  let nft: MockNFT;
  let deployer: SignerWithAddress;
  let admin: SignerWithAddress;
  let creator: SignerWithAddress;
  let collector: SignerWithAddress;
  let withdrawToWallet: SignerWithAddress;
  let user: SignerWithAddress;
  let tx: ContractTransaction;

  beforeEach(async () => {
    [deployer, admin, creator, collector, withdrawToWallet, user] = await ethers.getSigners();
    ({ nft, market } = await deployContracts({ deployer, creator }));

    // Mint and approve NFT 1 for testing
    await nft.mint();
    await nft.setApprovalForAll(market.address, true);

    // Set a price
    await market.connect(creator).setBuyPrice(nft.address, tokenId, price);

    // Create an auction
    await market.connect(creator).createReserveAuction(nft.address, tokenId, price);
  });

  describe("The buy price is invalidated when the first bid is placed", () => {
    beforeEach(async () => {
      // When a bid is placed, the NFT is reserved for the winner of the auction
      tx = await market.connect(collector).placeBid(auctionId, { value: price });
    });

    it("Emits BuyPriceInvalidated", async () => {
      await expect(tx).to.emit(market, "BuyPriceInvalidated").withArgs(nft.address, tokenId);
    });
  });
});
