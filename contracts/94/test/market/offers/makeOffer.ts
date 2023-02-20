import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ContractTransaction } from "ethers";
import { ethers } from "hardhat";
import { FETH, FNDNFTMarket, MockNFT } from "../../../typechain-types";
import { deployContracts } from "../../helpers/deploy";
import { getFethExpectedExpiration } from "../../helpers/feth";

describe("market / offers / makeOffer", function () {
  const tokenId = 1;
  const price = ethers.utils.parseEther("1");

  let market: FNDNFTMarket;
  let nft: MockNFT;
  let feth: FETH;
  let deployer: SignerWithAddress;
  let creator: SignerWithAddress;
  let collector: SignerWithAddress;
  let tx: ContractTransaction;
  let expiry: number;

  beforeEach(async () => {
    [deployer, creator, collector] = await ethers.getSigners();
    ({ nft, market, feth } = await deployContracts({ deployer, creator }));

    // Mint and approve NFT 1 for testing
    await nft.mint();
    await nft.setApprovalForAll(market.address, true);
  });

  describe("`makeOffer`", () => {
    beforeEach(async () => {
      tx = await market.connect(collector).makeOffer(nft.address, tokenId, price, { value: price });
      expiry = await getFethExpectedExpiration(tx);
    });

    it("Emits OfferMade", async () => {
      await expect(tx).to.emit(market, "OfferMade").withArgs(nft.address, tokenId, collector.address, price, expiry);
    });

    it("Transfers ETH into FETH", async () => {
      await expect(tx).to.changeEtherBalances([collector, feth], [price.mul(-1), price]);
    });

    it("Has FETH total balance", async () => {
      const totalBalance = await feth.totalBalanceOf(collector.address);
      expect(totalBalance).to.eq(price);
    });

    it("Has 0 available FETH balance", async () => {
      const balance = await feth.balanceOf(collector.address);
      expect(balance).to.eq(0);
    });

    it("Has a token lockup", async () => {
      const lockups = await feth.getLockups(collector.address);
      expect(lockups.amounts[0]).to.eq(price);
      expect(lockups.expiries[0]).to.eq(expiry);
    });
  });
});
