import { TypedDataDomain } from "@ethersproject/abstract-signer";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber, BigNumberish, Contract, Signature, utils } from "ethers";
import { ethers } from "hardhat";
import { FNDNFTMarket } from "../../typechain-types";

const name = "FNDNFTMarket";
const buyFromPrivateSaleType = {
  BuyFromPrivateSale: [
    { name: "nftContract", type: "address" },
    { name: "tokenId", type: "uint256" },
    { name: "buyer", type: "address" },
    { name: "price", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
};

export async function signPrivateSale(
  market: FNDNFTMarket,
  nft: Contract,
  tokenId: BigNumberish,
  seller: SignerWithAddress,
  buyer: SignerWithAddress,
  price: BigNumber,
  deadline: BigNumberish,
): Promise<Signature> {
  const network = await ethers.provider.getNetwork();
  const domain: TypedDataDomain = {
    name,
    version: "1",
    chainId: network.chainId,
    verifyingContract: market.address,
  };
  const sig = await seller._signTypedData(domain, buyFromPrivateSaleType, {
    nftContract: nft.address,
    tokenId: tokenId,
    buyer: buyer.address,
    price,
    deadline,
  });
  const signature = utils.splitSignature(sig);
  return signature;
}
