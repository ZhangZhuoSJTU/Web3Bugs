import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { upgrades } from "hardhat";
import {
  EmptyMockContract__factory,
  FETH,
  FETH__factory,
  FNDNFTMarket,
  FNDNFTMarket__factory,
  FoundationTreasury,
  FoundationTreasury__factory,
  MockNFT,
  MockNFT__factory,
  RoyaltyRegistry,
  RoyaltyRegistry__factory,
} from "../../typechain-types";
import { ONE_DAY } from "./constants";

export type Contracts = {
  treasury: FoundationTreasury;
  market: FNDNFTMarket;
  feth: FETH;
  royaltyRegistry: RoyaltyRegistry;
  nft: MockNFT;
};

export async function deployContracts({
  deployer,
  defaultAdmin,
  defaultOperator,
  creator,
}: {
  deployer: SignerWithAddress;
  defaultAdmin?: SignerWithAddress;
  defaultOperator?: SignerWithAddress;
  creator?: SignerWithAddress;
}): Promise<Contracts> {
  const treasury = await deployTreasury({ deployer, defaultAdmin, defaultOperator });
  const royaltyRegistry = await deployRoyaltyRegistry(deployer);
  const { market, feth } = await deployMarketAndFETH({ deployer, treasury, royaltyRegistry });
  const nft = await deployMockNFT(creator ?? deployer);

  return { treasury, market, feth, royaltyRegistry, nft };
}

export async function deployTreasury({
  deployer,
  defaultAdmin,
  defaultOperator,
}: {
  deployer: SignerWithAddress;
  defaultAdmin?: SignerWithAddress;
  defaultOperator?: SignerWithAddress;
}): Promise<FoundationTreasury> {
  const Treasury = new FoundationTreasury__factory(deployer);
  const admin = defaultAdmin ?? deployer;
  const treasury = (await upgrades.deployProxy(Treasury, [admin.address])) as FoundationTreasury;
  const operator = defaultOperator ?? admin;
  await treasury.connect(admin).grantOperator(operator.address);

  return treasury;
}

export async function deployRoyaltyRegistry(deployer: SignerWithAddress): Promise<RoyaltyRegistry> {
  // Manually deploy proxy and set implementation, deploy helpers assume building from source
  const factoryProxy = await upgrades.deployProxy(new EmptyMockContract__factory(deployer));
  const proxyAdmin = await upgrades.admin.getInstance();
  const registryFactory = new RoyaltyRegistry__factory(deployer);
  let royaltyRegistry = await registryFactory.deploy();
  await proxyAdmin.upgrade(factoryProxy.address, royaltyRegistry.address);
  royaltyRegistry = RoyaltyRegistry__factory.connect(factoryProxy.address, deployer);

  return royaltyRegistry;
}

export async function deployFETH({
  deployer,
  marketAddress,
}: {
  deployer: SignerWithAddress;
  marketAddress: string;
}): Promise<FETH> {
  const FETH = new FETH__factory(deployer);
  return (await upgrades.deployProxy(FETH, [], {
    unsafeAllow: ["state-variable-immutable", "constructor"], // https://docs.openzeppelin.com/upgrades-plugins/1.x/faq#why-cant-i-use-immutable-variables
    constructorArgs: [marketAddress, ONE_DAY],
  })) as FETH;
}

export async function deployMarketAndFETH({
  deployer,
  treasury,
  royaltyRegistry,
}: {
  deployer: SignerWithAddress;
  treasury: FoundationTreasury;
  royaltyRegistry: RoyaltyRegistry;
}): Promise<{ market: FNDNFTMarket; feth: FETH }> {
  // Create a proxy to an empty mock in order to determine the proxy address to be used in constructor args
  const mockFactory = new EmptyMockContract__factory(deployer);
  const marketProxy = await upgrades.deployProxy(mockFactory);
  const feth = await deployFETH({ deployer, marketAddress: marketProxy.address });
  const Market = new FNDNFTMarket__factory(deployer);
  const market = (await upgrades.upgradeProxy(marketProxy, Market, {
    unsafeAllow: ["state-variable-immutable", "constructor"], // https://docs.openzeppelin.com/upgrades-plugins/1.x/faq#why-cant-i-use-immutable-variables
    constructorArgs: [
      treasury.address,
      feth.address,
      royaltyRegistry.address,
      ONE_DAY, // duration
      marketProxy.address,
    ],
    unsafeAllowLinkedLibraries: true, // https://github.com/OpenZeppelin/openzeppelin-upgrades/issues/52
  })) as FNDNFTMarket;
  await market.initialize();

  return { market, feth };
}

export async function deployMockNFT(deployer: SignerWithAddress): Promise<MockNFT> {
  const MockNFT = new MockNFT__factory(deployer);
  return await MockNFT.deploy();
}
