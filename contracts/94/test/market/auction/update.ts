import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { ContractTransaction } from "ethers";
import { ethers } from "hardhat";
import { FNDNFTMarket, MockNFT } from "../../../typechain-types";
import { deployContracts } from "../../helpers/deploy";
import { constants } from "ethers";

describe("Market / auction / create", () => {
  const tokenId = 1;
  const auctionId = 1;
  const originalPrice = ethers.utils.parseEther("1");
  const newPrice = ethers.utils.parseEther("0.5");

  let deployer: SignerWithAddress;
  let creator: SignerWithAddress;
  let market: FNDNFTMarket;
  let nft: MockNFT;
  let tx: ContractTransaction;

  beforeEach(async () => {
    [deployer, creator] = await ethers.getSigners();
    ({ nft, market } = await deployContracts({ deployer, creator }));
    await nft.mint();
    await nft.connect(creator).setApprovalForAll(market.address, true);
    await market.connect(creator).createReserveAuction(nft.address, tokenId, originalPrice);
    tx = await market.connect(creator).updateReserveAuction(auctionId, newPrice);
  });

  it("can update auction", async () => {
    await expect(tx).to.emit(market, "ReserveAuctionUpdated").withArgs(
      auctionId,
      newPrice, // reservePrice
    );
  });
  it("can read auction info", async () => {
    const auctionInfo = await market.getReserveAuction(auctionId);
    expect(auctionInfo.nftContract).to.eq(nft.address);
    expect(auctionInfo.tokenId).to.eq(tokenId);
    expect(auctionInfo.seller).to.eq(creator.address);
    expect(auctionInfo.endTime).to.eq(0);
    expect(auctionInfo.bidder).to.eq(constants.AddressZero);
    expect(auctionInfo.amount).to.eq(newPrice);
  });
});
