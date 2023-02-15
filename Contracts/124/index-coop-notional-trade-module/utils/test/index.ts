// These utils will be provider-aware of the hardhat interface
import { ethers } from "hardhat";
import { Address } from "../types";

import {
  AaveV2Fixture,
  BalancerFixture,
  CompoundFixture,
  CurveFixture,
  KyberV3DMMFixture,
  SystemFixture,
  UniswapFixture,
  YearnFixture,
  UniswapV3Fixture,
  PerpV2Fixture
} from "../fixtures";
import { Blockchain, ProtocolUtils } from "../common";

// Hardhat-Provider Aware Exports
const provider = ethers.provider;
export const getSystemFixture = (ownerAddress: Address) => new SystemFixture(provider, ownerAddress);
export const getProtocolUtils = () => new ProtocolUtils(provider);
export const getBlockchainUtils = () => new Blockchain(provider);
export const getAaveV2Fixture = (ownerAdderss: Address) => new AaveV2Fixture(provider, ownerAdderss);
export const getBalancerFixture = (ownerAddress: Address) => new BalancerFixture(provider, ownerAddress);
export const getCurveFixture = (ownerAddress: Address) => new CurveFixture(provider, ownerAddress);
export const getCompoundFixture = (ownerAddress: Address) => new CompoundFixture(provider, ownerAddress);
export const getKyberV3DMMFixture = (ownerAddress: Address) => new KyberV3DMMFixture(provider, ownerAddress);
export const getUniswapFixture = (ownerAddress: Address) => new UniswapFixture(provider, ownerAddress);
export const getYearnFixture = (ownerAddress: Address) => new YearnFixture(provider, ownerAddress);
export const getUniswapV3Fixture = (ownerAddress: Address) => new UniswapV3Fixture(provider, ownerAddress);
export const getPerpV2Fixture = (ownerAddress: Address) => new PerpV2Fixture(provider, ownerAddress);

export { ForkedTokens } from "./types";

export {
  getAccounts,
  getEthBalance,
  getRandomAccount,
  getForkedTokens,
  initializeForkedTokens,
} from "./accountUtils";
export {
  addSnapshotBeforeRestoreAfterEach,
  getLastBlockTimestamp,
  getProvider,
  getTransactionTimestamp,
  getWaffleExpect,
  increaseTimeAsync,
  mineBlockAsync,
  cacheBeforeEach
} from "./testingUtils";
export {
  getRandomAddress
} from "../common";
