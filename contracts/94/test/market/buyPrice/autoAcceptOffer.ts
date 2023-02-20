import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ContractTransaction } from "ethers";
import { ethers } from "hardhat";
import { FETH, FNDNFTMarket, FoundationTreasury, MockNFT } from "../../../typechain-types";
import { deployContracts } from "../../helpers/deploy";

describe("market / buyPrice / autoAcceptOffer", function () {
  const tokenId = 1;
  const price = ethers.utils.parseEther("1");
  const offerPrice = price.mul(2);

  let treasury: FoundationTreasury;
  let market: FNDNFTMarket;
  let nft: MockNFT;
  let feth: FETH;
  let deployer: SignerWithAddress;
  let creator: SignerWithAddress;
  let collector: SignerWithAddress;
  let tx: ContractTransaction;

  beforeEach(async () => {
    [deployer, creator, collector] = await ethers.getSigners();
    ({ treasury, nft, market, feth } = await deployContracts({ deployer, creator }));

    // Mint and approve NFT 1 for testing
    await nft.mint();
    await nft.setApprovalForAll(market.address, true);

    // Make an offer for greater than the buy price we will set
    await market.connect(collector).makeOffer(nft.address, tokenId, offerPrice, { value: offerPrice });
  });

  describe("On `setBuyPrice`", () => {
    beforeEach(async () => {
      // On set price, accept the higher offer instead.
      tx = await market.connect(creator).setBuyPrice(nft.address, tokenId, price);
    });

    it("Emits OfferAccepted", async () => {
      await expect(tx)
        .to.emit(market, "OfferAccepted")
        .withArgs(
          nft.address,
          tokenId,
          collector.address,
          creator.address,
          offerPrice.mul(15).div(100),
          offerPrice.mul(85).div(100),
          0,
        );
    });

    it("Distributes ETH from the FETH balance", async () => {
      await expect(tx).to.changeEtherBalances(
        [feth, creator, treasury],
        [offerPrice.mul(-1), offerPrice.mul(85).div(100), offerPrice.mul(15).div(100)],
      );
    });
  });
});
