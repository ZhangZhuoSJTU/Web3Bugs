import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ContractTransaction } from "ethers";
import { ethers } from "hardhat";
import { FETH, FNDNFTMarket, FoundationTreasury, MockNFT } from "../../../typechain-types";
import { deployContracts } from "../../helpers/deploy";
import { getFethExpectedExpiration } from "../../helpers/feth";

describe("market / offers / acceptOffer", function () {
  const tokenId = 1;
  const price = ethers.utils.parseEther("1");

  let treasury: FoundationTreasury;
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
    ({ treasury, nft, market, feth } = await deployContracts({ deployer, creator }));

    // Mint and approve NFT 1 for testing
    await nft.mint();
    await nft.setApprovalForAll(market.address, true);

    // Make an offer to accept
    tx = await market.connect(collector).makeOffer(nft.address, tokenId, price, { value: price });
    expiry = await getFethExpectedExpiration(tx);
  });

  describe("`acceptOffer`", () => {
    beforeEach(async () => {
      tx = await market.connect(creator).acceptOffer(nft.address, tokenId, collector.address, price);
    });

    it("Emits OfferAccepted", async () => {
      await expect(tx)
        .to.emit(market, "OfferAccepted")
        .withArgs(
          nft.address,
          tokenId,
          collector.address,
          creator.address,
          price.mul(15).div(100),
          price.mul(85).div(100),
          0,
        );
    });

    it("Emits BalanceUnlocked", async () => {
      await expect(tx).to.emit(feth, "BalanceUnlocked").withArgs(collector.address, expiry, price);
    });

    it("Emits ETHWithdrawn", async () => {
      await expect(tx).to.emit(feth, "ETHWithdrawn").withArgs(collector.address, market.address, price);
    });

    it("Distributes ETH from the FETH balance", async () => {
      await expect(tx).to.changeEtherBalances(
        [feth, creator, treasury],
        [price.mul(-1), price.mul(85).div(100), price.mul(15).div(100)],
      );
    });

    it("The FETH total balance is no longer available", async () => {
      const totalBalance = await feth.totalBalanceOf(collector.address);
      expect(totalBalance).to.eq(0);
    });

    it("Token lockup does not apply", async () => {
      const lockups = await feth.getLockups(collector.address);
      expect(lockups.amounts.length).to.eq(0);
    });
  });
});
