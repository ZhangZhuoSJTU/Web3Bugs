import { ethers } from "ethers";
import { BigNumber } from "ethers";

export const ether = (amount: number | string): BigNumber => {
  const weiString = ethers.utils.parseEther(amount.toString());
  return BigNumber.from(weiString);
};

export const gWei = (amount: number): BigNumber => {
  const weiString = BigNumber.from("1000000000").mul(amount);
  return BigNumber.from(weiString);
};

export const bitcoin = (amount: number): BigNumber => {
  const weiString = 100000000 * amount; // Handles decimal Bitcoins better
  return BigNumber.from(weiString);
};

export const usdc = (amount: number): BigNumber => {
  const weiString = 1000000 * amount;
  return BigNumber.from(weiString);
};
