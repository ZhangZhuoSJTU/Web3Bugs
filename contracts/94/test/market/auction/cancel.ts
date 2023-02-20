import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { ContractTransaction } from "ethers";
import { ethers } from "hardhat";
import { FNDNFTMarket, MockNFT } from "../../../typechain-types";
import { constants } from "ethers";
import { deployContracts } from "../../helpers/deploy";

describe("Market / auction / cancel", () => {
  const tokenId = 1;
  const auctionId = 1;

  let deployer: SignerWithAddress;
  let creator: SignerWithAddress;
  let market: FNDNFTMarket;
  let nft: MockNFT;
  let tx: ContractTransaction;
  const price = ethers.utils.parseEther("1");

  beforeEach(async () => {
    [deployer, creator] = await ethers.getSigners();
    ({ nft, market } = await deployContracts({ deployer, creator }));
    await nft.mint();
    await nft.connect(creator).setApprovalForAll(market.address, true);
    await market.connect(creator).createReserveAuction(nft.address, tokenId, price);
    tx = await market.connect(creator).cancelReserveAuction(auctionId);
  });

  it("can cancel auction", async () => {
    await expect(tx).to.emit(market, "ReserveAuctionCanceled").withArgs(
      1, // auctionId
    );
  });

  it("The NFT has been returned to the creator", async () => {
    expect(await nft.ownerOf(tokenId)).to.eq(creator.address);
  });

  it("cannot read auction info", async () => {
    const auctionInfo = await market.getReserveAuction(auctionId);
    expect(auctionInfo.nftContract).to.eq(constants.AddressZero);
    expect(auctionInfo.tokenId).to.eq(0);
    expect(auctionInfo.seller).to.eq(constants.AddressZero);
    expect(auctionInfo.endTime).to.eq(0);
    expect(auctionInfo.bidder).to.eq(constants.AddressZero);
    expect(auctionInfo.amount).to.eq(0);
  });

  it("cannot read auction id for this token", async () => {
    expect(await market.getReserveAuctionIdFor(nft.address, tokenId)).to.eq(0);
  });
});
