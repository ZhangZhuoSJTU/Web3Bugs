import { task, types } from "hardhat/config";

import { SingleTokenJoin } from "../typechain/SingleTokenJoin";
import { SingleTokenJoin__factory } from "../typechain/factories/SingleTokenJoin__factory";

import "@nomiclabs/hardhat-ethers";
import { EthSingleTokenJoin__factory } from "../typechain/factories/EthSingleTokenJoin__factory";
import { EthSingleTokenJoin } from "../typechain/EthSingleTokenJoin";
import { SingleNativeTokenExit__factory } from "../typechain/factories/SingleNativeTokenExit__factory";
import { SingleNativeTokenExit } from "../typechain/SingleNativeTokenExit";
import { deployContract } from "ethereum-waffle";
import {
  DiamondFactoryContract,
  DiamondFactoryContract__factory,
  PieFactoryContract__factory,
  IERC20__factory,
  BasketFacet,
  ERC20Facet,
  CallFacet,
  DiamondCutFacet,
  DiamondLoupeFacet,
  OwnershipFacet,
  PieFactoryContract,
  Diamond,
  RebalanceManager__factory,
  RebalanceManagerV2__factory,
  RebalanceManagerV2,
  SingleTokenJoinV2,
  SingleTokenJoinV2__factory,
  EthSingleTokenJoinV2,
  EthSingleTokenJoinV2__factory,
  SingleNativeTokenExitV2,
  SingleNativeTokenExitV2__factory,
} from "../typechain";
import { Contract, BytesLike, utils } from "ethersv5";
import BasketFacetArtifact from "../artifacts/contracts/facets/Basket/BasketFacet.sol/BasketFacet.json";
import ERC20FacetArtifact from "../artifacts/contracts/facets/ERC20/ERC20Facet.sol/ERC20Facet.json";
import CallFacetArtifact from "../artifacts/contracts/facets/Call/CallFacet.sol/CallFacet.json";
import DiamondCutFacetArtifact from "../artifacts/@pie-dao/diamond/contracts/facets/DiamondCutFacet.sol/DiamondCutFacet.json";
import DiamondLoupeFacetArtifact from "../artifacts/@pie-dao/diamond/contracts/facets/DiamondLoupeFacet.sol/DiamondLoupeFacet.json";
import OwnershipFacetArtifact from "../artifacts/@pie-dao/diamond/contracts/facets/OwnershipFacet.sol/OwnershipFacet.json";
import PieFactoryContractArtifact from "../artifacts/contracts/factories/PieFactoryContract.sol/PieFactoryContract.json";
import DiamondArtifact from "../artifacts/@pie-dao/diamond/contracts/Diamond.sol/Diamond.json";
import DiamondFactoryArtifact from "../artifacts/contracts/test/DiamondFactoryContract.sol/DiamondFactoryContract.json";
import { constants } from "ethers";

function getSelectors(contract: Contract) {
  const signatures: BytesLike[] = [];
  for (const key of Object.keys(contract.functions)) {
    signatures.push(utils.keccak256(utils.toUtf8Bytes(key)).substr(0, 10));
  }

  return signatures;
}

task("deploy-diamond-factory").setAction(async (taskArgs, { ethers, run }) => {
  const signers = await ethers.getSigners();

  const diamondFactory = (await deployContract(
    signers[0] as any,
    DiamondFactoryArtifact,
    [],
    { gasLimit: 5000000 }
  )) as DiamondFactoryContract;
  console.log("Factory address:", diamondFactory.address);
  return diamondFactory;
});

task("deploy-diamond-from-factory")
  .addParam("factory", "address of the factory")
  .addParam("diamondCut", "facets to add", undefined, types.json)
  .setAction(async (taskArgs, { ethers, run }) => {
    const signers = await ethers.getSigners();

    const account = await signers[0].getAddress();
    const diamondCut = taskArgs.diamondCut;
    console.log(diamondCut);
    const diamondFactory = DiamondFactoryContract__factory.connect(
      taskArgs.factory,
      signers[0]
    );

    diamondFactory.deployNewDiamond(account, diamondCut);
  });

task("get-default-cut")
  .addParam("factory")
  .setAction(async (taskArgs, { ethers, run }) => {
    const signers = await ethers.getSigners();

    const factory = PieFactoryContract__factory.connect(
      taskArgs.factory,
      signers[0]
    );
    const cut = await factory.getDefaultCut();

    console.log(cut);
  });

// ########################### PIE/Basket ###########################

task("deploy-pie-factory").setAction(async (taskArgs, { ethers, run }) => {
  const signers = await ethers.getSigners();

  const account = await signers[0].getAddress();

  console.log("deploying from:", account);

  const contracts: any[] = [];

  const basketFacet = (await deployContract(
    signers[0],
    BasketFacetArtifact,
    []
  )) as BasketFacet;
  contracts.push({ name: "basketFacet", address: basketFacet.address });
  const erc20Facet = (await deployContract(
    signers[0],
    ERC20FacetArtifact,
    []
  )) as ERC20Facet;
  contracts.push({ name: "erc20Facet", address: erc20Facet.address });
  const callFacet = (await deployContract(
    signers[0],
    CallFacetArtifact,
    []
  )) as CallFacet;
  contracts.push({ name: "callFacet", address: callFacet.address });
  const diamondCutFacet = (await deployContract(
    signers[0],
    DiamondCutFacetArtifact,
    []
  )) as DiamondCutFacet;
  contracts.push({ name: "diamondCutFacet", address: diamondCutFacet.address });
  const diamondLoupeFacet = (await deployContract(
    signers[0],
    DiamondLoupeFacetArtifact,
    []
  )) as DiamondLoupeFacet;
  contracts.push({
    name: "diamondLoupeFacet",
    address: diamondLoupeFacet.address,
  });
  const ownershipFacet = (await deployContract(
    signers[0],
    OwnershipFacetArtifact,
    []
  )) as OwnershipFacet;
  contracts.push({ name: "ownershipFacet", address: ownershipFacet.address });

  console.table(contracts);

  const FacetCutAction = {
    Add: 0,
    Replace: 1,
    Remove: 2,
  };

  const diamondCut = [
    {
      action: FacetCutAction.Add,
      facetAddress: basketFacet.address,
      functionSelectors: getSelectors(basketFacet),
    },
    {
      action: FacetCutAction.Add,
      facetAddress: erc20Facet.address,
      functionSelectors: getSelectors(erc20Facet),
    },
    {
      action: FacetCutAction.Add,
      facetAddress: callFacet.address,
      functionSelectors: getSelectors(callFacet),
    },
    {
      action: FacetCutAction.Add,
      facetAddress: diamondCutFacet.address,
      functionSelectors: getSelectors(diamondCutFacet),
    },
    {
      action: FacetCutAction.Add,
      facetAddress: diamondLoupeFacet.address,
      functionSelectors: getSelectors(diamondLoupeFacet),
    },
    {
      action: FacetCutAction.Add,
      facetAddress: ownershipFacet.address,
      functionSelectors: getSelectors(ownershipFacet),
    },
  ];

  console.log(JSON.stringify(diamondCut));

  console.log("deploying factory");
  const pieFactory = (await deployContract(
    signers[0],
    PieFactoryContractArtifact,
    []
  )) as PieFactoryContract;
  console.log(`Factory deployed at: ${pieFactory.address}`);

  const diamondImplementation = (await deployContract(
    signers[0],
    DiamondArtifact,
    []
  )) as Diamond;
  await diamondImplementation.initialize([], constants.AddressZero);

  console.log(
    `Diamond implementation deployed at: ${diamondImplementation.address}`
  );

  await pieFactory.setDiamondImplementation(diamondImplementation.address);

  // Add default facets
  for (const facet of diamondCut) {
    console.log("adding default facet");
    await (await pieFactory.addFacet(facet)).wait(1);
  }
  return pieFactory.address;
});

task("deploy-pie-from-factory")
  .addParam("allocation", "path to json")
  .addParam(
    "factory",
    "pieFactory address",
    "0xf1e9eC6f1a4D00a24a9F8035C2C5e1D093f9b9aD"
  )
  .setAction(async (taskArgs, { ethers, run }) => {
    const signers = await ethers.getSigners();

    const account = await signers[0].getAddress();

    const factory = PieFactoryContract__factory.connect(
      taskArgs.factory,
      signers[0]
    );
    let allocation;
    try {
      allocation = JSON.parse(taskArgs.allocation);
    } catch (error) {
      allocation = require(taskArgs.allocation);
    }
    const tokens = allocation.tokens;

    for (const token of tokens) {
      const tokenContract = IERC20__factory.connect(token.address, signers[0]);
      const allowance = await tokenContract.allowance(account, factory.address);
      const balance = await tokenContract.balanceOf(account);
      if (balance.lt(token.amount)) {
        throw new Error(`To small balance ${balance.toString()}`);
      }

      if (allowance.lt(token.amount)) {
        console.log(`Approving ${token.name} ${token.address}`);
        await (
          await tokenContract.approve(factory.address, constants.MaxUint256)
        ).wait(1);
      }
    }

    const tx = await factory.bakePie(
      tokens.map((token) => token.address),
      tokens.map((token) => token.amount),
      allocation.initialSupply,
      allocation.symbol,
      allocation.name
    );

    console.log(`Pie hash: ${tx.hash}`);
    const receipt = await tx.wait(1);
    const pieAddress = receipt.events.find(({ event }) => event == "PieCreated")
      .args.pieAddress;
    console.log(`Pie deployed: ${pieAddress}`);
    return pieAddress;
  });

// ########################### REBALANCE MANAGER ###########################

task("deploy-rebalance-manager")
  .addParam("basket", "The address of the basket to manage")
  .addParam("uniswapv2")
  .addOptionalParam("uniswapv3")
  .setAction(async (taskArgs, { ethers, run }) => {
    const signers = await ethers.getSigners();

    let rebalanceManager;
    if (taskArgs.uniswapv3) {
      rebalanceManager = await new RebalanceManager__factory(signers[0]).deploy(
        taskArgs.basket,
        taskArgs.uniswapv2,
        taskArgs.uniswapv3
      );
    } else {
      rebalanceManager = await new RebalanceManagerV2__factory(
        signers[0]
      ).deploy(taskArgs.basket, taskArgs.uniswapv2, taskArgs.uniswapv3);
    }
    console.log(`rebalanceManager deployed at: ${rebalanceManager.address}`);
    return rebalanceManager.address;
  });

task("add-exchange")
  .addParam("rebalancemanager", "The address of the basket to manage")
  .addParam("uniswapv2")
  .setAction(async ({ rebalancemanager, uniswapv2 }, { ethers, run }) => {
    const signers = await ethers.getSigners();

    let rebalanceManager = (await ethers.getContractAt(
      "RebalanceManagerV2",
      rebalancemanager
    )) as RebalanceManagerV2;
    await rebalanceManager.setExchange(uniswapv2, true);
  });

// ########################### SINGLE JOIN/EXIT ###########################

// npx hardhat --network [NETWORK] deploy-single-join-exit --exchange [EXCHANGE] --token [TOKEN_ADDRESS] --weth [NATIVE_TOKEN]
task("deploy-single-join-exit")
  .addParam("exchange", "The address of an exchange like uniswap")
  .addParam("token", "The address of token to trade from (USDC, WETH)")
  .addParam("weth", "The address of token that wraps native token (WETH)")
  .setAction(async ({ exchange, token, weth }, { ethers, run }) => {
    const signers = await ethers.getSigners();
    const singleTokenJoin = (await new SingleTokenJoin__factory(
      signers[0]
    ).deploy(token, exchange)) as SingleTokenJoin;

    const singleEthJoin = (await new EthSingleTokenJoin__factory(
      signers[0]
    ).deploy(weth, exchange)) as EthSingleTokenJoin;

    const singleTokenExit = (await new SingleNativeTokenExit__factory(
      signers[0]
    ).deploy(weth, exchange)) as SingleNativeTokenExit;
    console.log(`SingleTokenJoin deployed at: ${singleTokenJoin.address}`);
    console.log(`EthSingleTokenJoin deployed at: ${singleEthJoin.address}`);
    console.log(
      `SingleNativeTokenExit deployed at: ${singleTokenExit.address}`
    );

    return [
      singleTokenJoin.address,
      singleEthJoin.address,
      singleTokenExit.address,
    ];
  });

// npx hardhat --network [NETWORK] deploy-single-join-exit --exchange [EXCHANGE] --token [TOKEN_ADDRESS] --weth [NATIVE_TOKEN]
task("deploy-single-join-exit-v2")
  .addParam("exchange", "The address of an exchange like uniswap")
  .addParam("token", "The address of token to trade from (USDC, WETH)")
  .addParam("weth", "The address of token that wraps native token (WETH)")
  .setAction(async ({ exchange, token, weth }, { ethers, run }) => {
    const signers = await ethers.getSigners();
    const singleTokenJoin = (await new SingleTokenJoinV2__factory(
      signers[0]
    ).deploy(token, exchange)) as SingleTokenJoinV2;

    const singleEthJoin = (await new EthSingleTokenJoinV2__factory(
      signers[0]
    ).deploy(weth, exchange)) as EthSingleTokenJoinV2;

    const singleTokenExit = (await new SingleNativeTokenExitV2__factory(
      signers[0]
    ).deploy(weth, exchange)) as SingleNativeTokenExitV2;
    console.log(`SingleTokenJoin deployed at: ${singleTokenJoin.address}`);
    console.log(`EthSingleTokenJoin deployed at: ${singleEthJoin.address}`);
    console.log(
      `SingleNativeTokenExit deployed at: ${singleTokenExit.address}`
    );

    return [
      singleTokenJoin.address,
      singleEthJoin.address,
      singleTokenExit.address,
    ];
  });
