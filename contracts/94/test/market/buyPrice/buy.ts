import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ContractTransaction } from "ethers";
import { ethers } from "hardhat";
import { FNDNFTMarket, FoundationTreasury, MockNFT } from "../../../typechain-types";
import { deployContracts } from "../../helpers/deploy";

describe("market / buyPrice / buy", function () {
  const tokenId = 1;
  const price = ethers.utils.parseEther("1");

  let treasury: FoundationTreasury;
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
    ({ treasury, nft, market } = await deployContracts({ deployer, creator }));

    // Mint and approve NFT 1 for testing
    await nft.mint();
    await nft.setApprovalForAll(market.address, true);

    // Set a price
    await market.connect(creator).setBuyPrice(nft.address, tokenId, price);
  });

  describe("`buy`", () => {
    beforeEach(async () => {
      tx = await market.connect(collector).buy(nft.address, tokenId, price, { value: price });
    });

    it("Emits BuyPriceAccepted", async () => {
      await expect(tx)
        .to.emit(market, "BuyPriceAccepted")
        .withArgs(
          nft.address,
          tokenId,
          creator.address,
          collector.address,
          price.mul(15).div(100),
          price.mul(85).div(100),
          0,
        );
    });

    it("Transfers ETH", async () => {
      await expect(tx).to.changeEtherBalances(
        [collector, creator, treasury],
        [price.mul(-1), price.mul(85).div(100), price.mul(15).div(100)],
      );
    });

    it("Transfers NFT to the new owner", async () => {
      const ownerOf = await nft.ownerOf(tokenId);
      expect(ownerOf).to.eq(collector.address);
    });
  });
});
