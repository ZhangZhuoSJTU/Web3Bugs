import { ethers, network } from "hardhat";
import { BigNumber } from "ethers";
import { Address } from "../types";
import { Account, ForkedTokens } from "./types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import dependencies from "../deploys/dependencies";
import { IERC20__factory } from "../../typechain";
import { ether } from "../common";
import type DeployHelper  from "../deploys";

const provider = ethers.provider;

export const getAccounts = async (): Promise<Account[]> => {
  const accounts: Account[] = [];

  const wallets = await getWallets();
  for (let i = 0; i < wallets.length; i++) {
    accounts.push({
      wallet: wallets[i],
      address: await wallets[i].getAddress(),
    });
  }

  return accounts;
};

// Use the last wallet to ensure it has Ether
export const getRandomAccount = async (): Promise<Account> => {
  const accounts = await getAccounts();
  return accounts[accounts.length - 1];
};

export const getEthBalance = async (account: Address): Promise<BigNumber> => {
  return await provider.getBalance(account);
};

// NOTE ethers.signers may be a hardhat specific function
export const getWallets = async (): Promise<SignerWithAddress[]> => {
  return (await ethers.getSigners() as SignerWithAddress[]);
};

const getForkedDependencyAddresses = (): any => {
  return {
    whales: [
      dependencies.DAI_WHALE,
      dependencies.WETH_WHALE,
      dependencies.WBTC_WHALE,
      dependencies.USDC_WHALE,
      dependencies.STETH_WHALE,
    ],

    tokens: [
      dependencies.DAI[1],
      dependencies.WETH[1],
      dependencies.WBTC[1],
      dependencies.USDC[1],
      dependencies.STETH[1],
    ],
  };
};

// Mainnet token instances connected their impersonated
// top holders to enable approval / transfer etc.
export const getForkedTokens = (): ForkedTokens => {

  // (eslint is confused by typescript enum keyword)
  // eslint-disable-next-line no-unused-vars
  const enum ids { DAI, WETH, WBTC, USDC, STETH }
  const { whales, tokens } = getForkedDependencyAddresses();

  const forkedTokens = {
    dai: IERC20__factory.connect(tokens[ids.DAI], provider.getSigner(whales[ids.DAI])),
    weth: IERC20__factory.connect(tokens[ids.WETH], provider.getSigner(whales[ids.WETH])),
    wbtc: IERC20__factory.connect(tokens[ids.WBTC], provider.getSigner(whales[ids.WBTC])),
    usdc: IERC20__factory.connect(tokens[ids.USDC], provider.getSigner(whales[ids.USDC])),
    steth: IERC20__factory.connect(tokens[ids.STETH], provider.getSigner(whales[ids.STETH])),
  };

  return forkedTokens;
};

export const initializeForkedTokens = async (deployer: DeployHelper): Promise<void> => {
  const { whales } = getForkedDependencyAddresses();

  for (const whale of whales) {
    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [whale]},
    );

    const funder = await deployer.mocks.deployForceFunderMock();
    await funder.fund(whale, {value: ether(100)}); // Gas money
  }
};
