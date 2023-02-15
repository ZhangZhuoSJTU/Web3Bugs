import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { Address } from "../types";
import { IERC20 } from "../../typechain";

export type Account = {
  address: Address;
  wallet: SignerWithAddress;
};

export type ForkedTokens = {
  [key: string]: IERC20;
};
