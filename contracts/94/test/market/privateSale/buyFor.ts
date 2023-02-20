import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ContractTransaction, Signature } from "ethers";
import { ethers } from "hardhat";
import { FETH, FNDNFTMarket, FoundationTreasury, MockNFT } from "../../../typechain-types";
import { deployContracts } from "../../helpers/deploy";
import { ONE_DAY } from "../../helpers/constants";
import { signPrivateSale } from "../../helpers/privateSale";
import { getBlockTime } from "../../helpers/time";

describe("market / privateSale / buyFor", function () {
  const tokenId = 1;
  const price = ethers.utils.parseEther("1");

  let treasury: FoundationTreasury;
  let market: FNDNFTMarket;
  let nft: MockNFT;
  let feth: FETH;
  let deployer: SignerWithAddress;
  let creator: SignerWithAddress;
  let collector: SignerWithAddress;
  let bidder: SignerWithAddress;
  let tx: ContractTransaction;
  let deadline: number;
  let signature: Signature;

  beforeEach(async () => {
    [deployer, creator, collector, bidder] = await ethers.getSigners();
    ({ treasury, nft, market, feth } = await deployContracts({ deployer, creator }));

    // Mint and approve NFT 1 for testing
    await nft.mint();
    await nft.setApprovalForAll(market.address, true);

    // Deposit FETH to use for the private sale purchase
    await feth.connect(collector).deposit({ value: price });

    // Sign a private sale offer
    deadline = (await getBlockTime()) + ONE_DAY;
    signature = await signPrivateSale(market, nft, tokenId, creator, collector, price, deadline);
  });

  describe("`buyFromPrivateSaleFor`", () => {
    beforeEach(async () => {
      // Not sending ETH, the available FETH balance will be used instead
      tx = await market
        .connect(collector)
        .buyFromPrivateSaleFor(nft.address, tokenId, price, deadline, signature.v, signature.r, signature.s);
    });

    it("Emits PrivateSaleFinalized", async () => {
      await expect(tx)
        .to.emit(market, "PrivateSaleFinalized")
        .withArgs(
          nft.address,
          tokenId,
          creator.address,
          collector.address,
          price.mul(15).div(100),
          price.mul(85).div(100),
          0,
          deadline,
        );
    });

    it("Transfers ETH from the FETH balance", async () => {
      await expect(tx).to.changeEtherBalances(
        [feth, creator, treasury],
        [price.mul(-1), price.mul(85).div(100), price.mul(15).div(100)],
      );
    });

    it("Transfers NFT to the new owner", async () => {
      const ownerOf = await nft.ownerOf(tokenId);
      expect(ownerOf).to.eq(collector.address);
    });

    it("Has no remaining FETH balance", async () => {
      const totalBalance = await feth.totalBalanceOf(collector.address);
      expect(totalBalance).to.eq(0);
    });
  });
});
