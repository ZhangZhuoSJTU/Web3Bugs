import { ethers } from "hardhat";
import { deploy } from "./helpers";

(async () => {
  const config = {
    trustedForwarder: "0x9399BB24DBB5C4b782C70c2969F58716Ebbd6a3b",
    bicoOwner: "0x46b65ae065341D034fEA45D76c6fA936EAfBfdeb",
    pauser: "0x46b65ae065341D034fEA45D76c6fA936EAfBfdeb",
    tokens: [
      {
        tokenAddress: "0xeabc4b91d9375796aa4f69cc764a4ab509080a58",
        minCap: ethers.BigNumber.from(10).pow(18 + 2),
        maxCap: ethers.BigNumber.from(10).pow(18 + 4),
        toChainIds: [
          {
            chainId: 43113,
            minCap: ethers.BigNumber.from(10).pow(18 + 2),
            // Max Cap needs to be less than the maxTransfer Fee on destination chain id to cover for incentive amount
            maxCap: ethers.BigNumber.from(9).mul(ethers.BigNumber.from(10).pow(18 + 3)),
          },
          {
            chainId: 5,
            minCap: ethers.BigNumber.from(10).pow(18 + 2),
            // Max Cap needs to be less than the maxTransfer Fee on destination chain id to cover for incentive amount
            maxCap: ethers.BigNumber.from(9).mul(ethers.BigNumber.from(10).pow(18 + 3)),
          },
        ],
        equilibriumFee: 10000000,
        maxFee: 200000000,
        maxWalletLiquidityCap: ethers.BigNumber.from(10).pow(18 + 4),
        maxLiquidityCap: ethers.BigNumber.from(10).pow(18 + 5),
        svgHelper: await ethers.getContractFactory("PolygonUSDT"),
        decimals: 18,
      },
      {
        tokenAddress: "0xa6fa4fb5f76172d178d61b04b0ecd319c5d1c0aa",
        minCap: ethers.BigNumber.from(10).pow(18 - 2),
        maxCap: ethers.BigNumber.from(10).pow(18 + 2),
        toChainIds: [
          {
            chainId: 43113,
            minCap: ethers.BigNumber.from(10).pow(18 - 2),
            // Max Cap needs to be less than the maxTransfer Fee on destination chain id to cover for incentive amount
            maxCap: ethers.BigNumber.from(97).mul(ethers.BigNumber.from(10).pow(18)),
          },
          {
            chainId: 5,
            minCap: ethers.BigNumber.from(10).pow(18 - 2),
            // Max Cap needs to be less than the maxTransfer Fee on destination chain id to cover for incentive amount
            maxCap: ethers.BigNumber.from(97).mul(ethers.BigNumber.from(10).pow(18)),
          },
        ],
        equilibriumFee: 10000000,
        maxFee: 200000000,
        maxWalletLiquidityCap: ethers.BigNumber.from(10).pow(18 + 4),
        maxLiquidityCap: ethers.BigNumber.from(10).pow(18 + 5),
        svgHelper: await ethers.getContractFactory("PolygonETH"),
        decimals: 18,
      },
      {
        tokenAddress: "0xdA5289fCAAF71d52a80A254da614a192b693e977",
        minCap: ethers.BigNumber.from(10).pow(6 + 2),
        maxCap: ethers.BigNumber.from(10).pow(6 + 4),
        toChainIds: [
          {
            chainId: 5,
            minCap: ethers.BigNumber.from(10).pow(6 + 2),
            // Max Cap needs to be less than the maxTransfer Fee on destination chain id to cover for incentive amount
            maxCap: ethers.BigNumber.from(9).mul(ethers.BigNumber.from(10).pow(6 + 3)),
          },
        ],
        equilibriumFee: 10000000,
        maxFee: 200000000,
        maxWalletLiquidityCap: ethers.BigNumber.from(10).pow(6 + 4),
        maxLiquidityCap: ethers.BigNumber.from(10).pow(6 + 5),
        svgHelper: await ethers.getContractFactory("PolygonUSDC"),
        decimals: 6,
      },
    ],
  };
  await deploy(config);
})();
