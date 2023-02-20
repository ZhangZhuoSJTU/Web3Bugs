import { network, ethers, artifacts } from "hardhat";
import {
  IAddressProvider,
  IERC20,
  IPriceFeed,
  IVaultsDataProvider,
  IWETH,
  SuperVault,
  IVaultsCore,
} from "../typechain";

import { BigNumber } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { deployMockContract } from "ethereum-waffle";

export const USDC = "0x2791bca1f2de4661ed88a30c99a7a9449aa84174";
export const WETH = "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619";
export const PAR = "0xe2aa7db6da1dae97c5f5c6914d285fbfcc32a128";
export const MIMO = "0xadac33f543267c4d59a8c299cf804c303bc3e4ac";
export const WMATIC = "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270";
export const ADDRESS_PROVIDER = "0xa802eE4bd9f449295ADb6d73f65118352420758A";
export const GOVERNANCE_ADDRESS_PROVIDER = "0x2489DF1F40BcA6DBa1554AafeCc237BBc6d0453c";
export const AAVE_LENDING_POOL = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";
export const WMATIC_MINER = "0x8b264d48c0887bc2946ea8995c3afcdbb576f799";
export const MULTISIG = "0xbB60ADbe38B4e6ab7fb0f9546C2C1b665B86af11";
export const DEX_ADDRESS_PROVIDER = "0x0465fad9a480f58c3690D4f6543Bc195882FCE45";
export const ONE = BigNumber.from("1000000000000000000");
export const aggregators = { ONEINCH: 1, PARASWAP: 0, INVALID1: -1, INVALID2: 2 };

// Error codes
export const SENDER_MUST_BE_OWNER = "SV001";
export const CALLER_MUST_BE_LENDING_POOL = "SV002";
export const NOT_ENOUGH_TOKENS_TO_REPAY_LOAN = "SV101";

export const depositWMatic = async (maticAmount: BigNumber, maticContract: IWETH) => {
  // Wrap our MATIC into WMATIC
  await maticContract.deposit({
    value: maticAmount,
  });
};

// Set up contracts on a forked mainnet network
export async function setupContracts(signer: SignerWithAddress) {
  const par: IERC20 = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", PAR);
  const mimo: IERC20 = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", MIMO);
  const wmatic: IWETH = await ethers.getContractAt("IWETH", WMATIC); // WMATIC behaves like WETH, so we can use the WETH ABI
  const addressProvider: IAddressProvider = await ethers.getContractAt("IAddressProvider", ADDRESS_PROVIDER);
  const priceFeed: IPriceFeed = await ethers.getContractAt("IPriceFeed", await addressProvider.priceFeed());
  const vaultsDataProvider: IVaultsDataProvider = await ethers.getContractAt(
    "IVaultsDataProvider",
    await addressProvider.vaultsData(),
  );
  const vaultsCore: IVaultsCore = await ethers.getContractAt("IVaultsCore", await addressProvider.core());
  const superVaultInstance: SuperVault = await getSuperVaultInstance(signer.address);
  return {
    superVaultInstance,
    wmatic,
    priceFeed,
    mimo,
    vaultsDataProvider,
    par,
    vaultsCore,
  };
}

// Read and deploy a mock contract from hardhat artificats
const readAndDeployMockContract = async (signer: SignerWithAddress, contractPath: string) => {
  const contractArtifact = await artifacts.readArtifact(contractPath);
  return deployMockContract(signer, contractArtifact.abi);
};

// Set up contracts for tests that use a local hardhat network
export const setupMockContracts = async (signer: SignerWithAddress) => {
  const a = await readAndDeployMockContract(signer, "IAddressProvider");
  const core = await readAndDeployMockContract(signer, "IVaultsCore");
  const par = await readAndDeployMockContract(signer, "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20");
  const ga = await readAndDeployMockContract(signer, "IGovernanceAddressProvider");
  const mimo = await readAndDeployMockContract(signer, "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20");
  const wmatic = await readAndDeployMockContract(signer, "IWETH");
  const mockVaultsData = await readAndDeployMockContract(signer, "IVaultsDataProvider");
  const miner = await readAndDeployMockContract(signer, "IGenericMiner");

  return {
    mockAddressProvider: a,
    mockVaultsCore: core,
    mockPar: par,
    mockGovernanceAddressProvider: ga,
    mockMimo: mimo,
    mockwmatic: wmatic,
    mockVaultsData,
    mockMiner: miner,
  };
};

// Deploy a supervault instance from SuperVaultcontract factory
export const getSuperVaultInstance = async (
  owner: string,
  addressProvider = ADDRESS_PROVIDER,
  governanceAddressProvider = GOVERNANCE_ADDRESS_PROVIDER,
  aaveLP = AAVE_LENDING_POOL,
  dexAddressProvider = DEX_ADDRESS_PROVIDER,
): Promise<SuperVault> => {
  // This only needs to be deployed once for everyone

  const superVaultFactory = await ethers.getContract("SuperVaultFactory");

  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [MULTISIG],
  });

  const superVaultInterface = await ethers.getContractFactory("SuperVault");

  // This needs to be deployed once per user
  const superVaultData = superVaultInterface.interface.encodeFunctionData("initialize", [
    addressProvider,
    governanceAddressProvider,
    aaveLP,
    owner,
    dexAddressProvider,
  ]);
  const cloneTx = await superVaultFactory.clone(superVaultData);
  const cloneReceipt = await cloneTx.wait(1);

  // @ts-ignore this address should be searchable in the subgraph
  const userSuperVault = cloneReceipt.events[1].args.superVaultContract;
  return ethers.getContractAt("SuperVault", userSuperVault);
};

// Re-fork hardhat network and re-set all contracts
export const resetNetworkFork = async () => {
  await network.provider.request({
    method: "hardhat_reset",
    params: [
      {
        forking: {
          jsonRpcUrl: `https://polygon-mainnet.g.alchemy.com/v2/VOWdgIgD9lo6KDGE17A8HC7Lbymc652o`,
        },
      },
    ],
  });
};

// Disable fork to use local hardhat network
export const disableFork = async () => {
  await network.provider.request({
    method: "hardhat_reset",
    params: [],
  });
};
