import { Wallet } from "ethers";
import { Address } from "../types";

export const getRandomAddress = async (): Promise<Address> => {
  const wallet = Wallet.createRandom();
  return await wallet.getAddress();
};
