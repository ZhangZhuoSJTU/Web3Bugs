import { Wallet } from "ethers";

export const generateNewAddress = (): string => {
  return Wallet.createRandom().address;
};
