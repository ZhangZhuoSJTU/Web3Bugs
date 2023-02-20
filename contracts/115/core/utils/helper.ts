import axios from "axios";
import { AddressLike } from "ethereumjs-util";
import { ethers } from "hardhat";
import { COLLATERALS, Setter } from "../config/deployment";

export const etherscan = {
  1: "https://etherscan.io/tx/",
  4: "https://rinkeby.etherscan.io/tx/",
};

export const setCollateralConfig = async (
  configProvider: any,
  collateralType: string,
  collateralAddress: AddressLike,
): Promise<Setter | undefined> => {
  const collateralConfig = COLLATERALS[collateralType];
  console.log(`Setting ${collateralType}...`);
  try {
    const params = [
      collateralAddress,
      collateralConfig.parDebtLimit,
      collateralConfig.liquidationRatio,
      collateralConfig.minCollateralRatio,
      collateralConfig.borrowRate,
      collateralConfig.originationFee,
      collateralConfig.liquidationBonus,
      collateralConfig.liquidationFee,
    ];
    const setCollateralConfigTx = await configProvider.setCollateralConfig(...params);
    const receipt = await setCollateralConfigTx.wait(1);
    console.log(`${collateralType} : ${collateralAddress}`);
    console.log(`Set ${collateralType} Collateral Config (tx: ${receipt.transactionHash})`);
    return {
      status: receipt.status === 1 ? "Success" : "Failed",
      tx: receipt.transactionHash,
      gasUsed: receipt.gasUsed.toString(),
    };
  } catch (error) {
    console.log(error);
  }
};

export const getTokenPrice = async (address: string) => {
  const url = `https://api.coingecko.com/api/v3/simple/token_price/ethereum?contract_addresses=${address}&vs_currencies=USD`;
  try {
    const result: any = await axios.get(url);
    return result.data[address.toLowerCase()].usd;
  } catch (error) {
    console.log(error);
  }
};

export const getRate = async () => {
  try {
    const result: any = await axios.get(
      `https://freecurrencyapi.net/api/v2/latest?apikey=${process.env.FREE_CURRENCY_API_KEY}`,
    );
    return result.data.data.EUR;
  } catch (error) {
    console.log(error);
  }
};

export const capitalizeFirstLetter = (s: string) => {
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export const address0 = "0x0000000000000000000000000000000000000000";

export const getTimestamp = async () => {
  const block = await ethers.provider.getBlock("latest");
  return block.timestamp;
};
