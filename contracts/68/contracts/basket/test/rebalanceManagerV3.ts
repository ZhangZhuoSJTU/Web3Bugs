import chai, { expect } from "chai";
import { deployContract, solidity } from "ethereum-waffle";
import { ethers, network } from "hardhat";
import { Signer, constants, utils, Contract, BytesLike } from "ethers";

import BasketFacetArtifact from "../artifacts/contracts/facets/Basket/BasketFacet.sol/BasketFacet.json";
import Erc20FacetArtifact from "../artifacts/contracts/facets/ERC20/ERC20Facet.sol/ERC20Facet.json";
import CallFacetArtifact from "../artifacts/contracts/facets/Call/CallFacet.sol/CallFacet.json";
import DiamondCutFacetArtifact from "../artifacts/@pie-dao/diamond/contracts/facets/DiamondCutFacet.sol/DiamondCutFacet.json";
import DiamondLoupeFacetArtifact from "../artifacts/@pie-dao/diamond/contracts/facets/DiamondLoupeFacet.sol/DiamondLoupeFacet.json";
import OwnershipFacetArtifact from "../artifacts/@pie-dao/diamond/contracts/facets/OwnershipFacet.sol/OwnershipFacet.json";

import PieFactoryContractArtifact from "../artifacts/contracts/factories/PieFactoryContract.sol/PieFactoryContract.json";

import RebalanceManagerV3Artifact from "../artifacts/contracts/callManagers/RebalanceManagerV3.sol/RebalanceManagerV3.json";
import DiamondArtifact from "../artifacts/@pie-dao/diamond/contracts/Diamond.sol/Diamond.json";

import {
  ERC20Facet,
  BasketFacet,
  CallFacet,
  DiamondCutFacet,
  DiamondLoupeFacet,
  OwnershipFacet,
  PieFactoryContract,
  RebalanceManager,
  Diamond,
} from "../typechain";

import { IExperiPie } from "../typechain/IExperiPie";
import { IExperiPie__factory as IExperiPieFactory } from "../typechain/factories/IExperiPie__factory";
import { IUniswapV2Router02__factory as IUniswapV2RouterFactory } from "../typechain/factories/IUniswapV2Router02__factory";

import TimeTraveler from "../utils/TimeTraveler";
import { parseEther } from "ethers/lib/utils";
import { IUniswapV2Router02 } from "../typechain/IUniswapV2Router02";
import { IERC20__factory } from "../typechain/factories/IERC20__factory";
import { IERC20 } from "../typechain/IERC20";
import { RebalanceManagerV3 } from "../typechain/RebalanceManagerV3";

chai.use(solidity);

const FacetCutAction = {
  Add: 0,
  Replace: 1,
  Remove: 2,
};

function getSelectors(contract: Contract) {
  const signatures: BytesLike[] = [];
  for (const key of Object.keys(contract.functions)) {
    signatures.push(utils.keccak256(utils.toUtf8Bytes(key)).substr(0, 10));
  }

  return signatures;
}

describe("RebalanceManagerV3", function () {
  this.timeout(300000000);
  const UNISWAP_V2 = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";

  const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
  const DAI = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
  const USDT = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
  const AAVE = "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9";
  const oneUSD = "1000000";
  const tenUSD = "10000000";

  let WETH;
  let targetToken: IERC20;

  let pieFactory: PieFactoryContract;
  let pie: IExperiPie;
  let account: string;
  let signers: Signer[];
  let timeTraveler: TimeTraveler;
  let diamondCut: any[];
  let uniswapV2: IUniswapV2Router02;

  let rebalanceManager: RebalanceManagerV3;
  const testTokens: IERC20[] = [];

  before(async () => {
    signers = await ethers.getSigners();
    account = await signers[0].getAddress();
    timeTraveler = new TimeTraveler(network.provider);

    const basketFacet = (await deployContract(
      signers[0],
      BasketFacetArtifact
    )) as BasketFacet;
    const erc20Facet = (await deployContract(
      signers[0],
      Erc20FacetArtifact
    )) as ERC20Facet;
    const callFacet = (await deployContract(
      signers[0],
      CallFacetArtifact
    )) as CallFacet;
    const diamondCutFacet = (await deployContract(
      signers[0],
      DiamondCutFacetArtifact
    )) as DiamondCutFacet;
    const diamondLoupeFacet = (await deployContract(
      signers[0],
      DiamondLoupeFacetArtifact
    )) as DiamondLoupeFacet;
    const ownershipFacet = (await deployContract(
      signers[0],
      OwnershipFacetArtifact
    )) as OwnershipFacet;

    diamondCut = [
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

    pieFactory = (await deployContract(
      signers[0],
      PieFactoryContractArtifact
    )) as PieFactoryContract;

    const diamondImplementation = (await deployContract(
      signers[0],
      DiamondArtifact
    )) as Diamond;
    await diamondImplementation.initialize([], constants.AddressZero);
    await pieFactory.setDiamondImplementation(diamondImplementation.address);

    // Add default facets
    for (const facet of diamondCut) {
      await pieFactory.addFacet(facet);
    }

    await pieFactory.setDefaultController(account);

    // Deploy uniswapV2
    uniswapV2 = IUniswapV2RouterFactory.connect(
      UNISWAP_V2,
      signers[0]
    ) as IUniswapV2Router02;

    WETH = await uniswapV2.WETH();
    const tokens = [USDC, USDT];
    for (let i = 0; i < tokens.length; i++) {
      await (
        await uniswapV2.swapETHForExactTokens(
          tenUSD,
          [WETH, tokens[i]],
          account,
          new Date().getTime(),
          { value: constants.WeiPerEther }
        )
      ).wait(1);

      const token = IERC20__factory.connect(tokens[i], signers[0]);
      await token.approve(pieFactory.address, constants.MaxUint256);

      testTokens.push(token);
    }
    targetToken = IERC20__factory.connect(AAVE, signers[0]);
    await (
      await uniswapV2.swapETHForExactTokens(
        tenUSD,
        [WETH, AAVE],
        account,
        new Date().getTime(),
        { value: constants.WeiPerEther }
      )
    ).wait(1);

    // deploy pie
    await pieFactory.bakePie(
      testTokens.map(({ address }) => address),
      testTokens.map(() => oneUSD),
      parseEther("100"),
      "PRT",
      "PangolinRebalance"
    );
    const pieAddress = await pieFactory.pies(0);
    pie = (await IExperiPieFactory.connect(
      pieAddress,
      signers[0]
    )) as IExperiPie;

    rebalanceManager = (await deployContract(
      signers[0],
      RebalanceManagerV3Artifact,
      [pie.address, uniswapV2.address, 100]
    )) as RebalanceManagerV3;

    await pie.addCaller(rebalanceManager.address);

    await pie.setLock(constants.One);

    await timeTraveler.snapshot();
  });

  beforeEach(async () => {
    await timeTraveler.revertSnapshot();
  });

  describe("constructor", async () => {
    it("Deploying with correct values should work", async () => {
      expect(pie.address).to.be.eq(await rebalanceManager.basket());
      expect(true).to.be.eq(
        await rebalanceManager.exchanges(uniswapV2.address)
      );
    });
    it("Deploying with an invalid basket should fail", async () => {
      const promise = deployContract(signers[0], RebalanceManagerV3Artifact, [
        constants.AddressZero,
        uniswapV2.address,
        100
      ]);

      await expect(promise).to.be.revertedWith("INVALID_BASKET");
    });

    it("Deploying with an invalid uniswapV2 address should fail", async () => {
      const promise = deployContract(signers[0], RebalanceManagerV3Artifact, [
        pie.address,
        constants.AddressZero,
        100
      ]);
      await expect(promise).to.be.revertedWith("INVALID_UNISWAP_V2");
    });
  });

  describe("rebalance", async () => {
    beforeEach(async () => {
      await targetToken.approve(pie.address, constants.MaxUint256);
      await rebalanceManager.lock();
    });

    it("Switching token should work for (uniswap v2)", async () => {
      const srcToken = testTokens[0];
      const poolSrcTokenBalanceBefore = await srcToken.balanceOf(pie.address);

      const quantity = poolSrcTokenBalanceBefore;
      const minimumReturn = poolSrcTokenBalanceBefore; //one to one
      const poolTokensBefore = await pie.getTokens();

      expect(poolTokensBefore.includes(srcToken.address)).to.be.equal(true);
      expect(poolTokensBefore.includes(targetToken.address)).to.be.equal(false);

      const block = await ethers.provider.getBlock(
        await ethers.provider.getBlockNumber()
      );

      const path = [srcToken.address, WETH, targetToken.address];

      const underlyingTrade = {
        swaps: [
          {
            exchange: uniswapV2.address,
            path,
          },
        ],
        quantity,
        minimumReturn,
      };
      await rebalanceManager.rebalance(
        [underlyingTrade],
        block.timestamp + 3000
      );

      const poolTokensAfter = await pie.getTokens();
      const poolSrcTokenBalanceAfter = await srcToken.balanceOf(pie.address);
      const poolTargetTokenBalanceAfter = await targetToken.balanceOf(
        pie.address
      );

      expect(poolTokensAfter.includes(srcToken.address)).to.be.equal(false);
      expect(poolTokensAfter.includes(targetToken.address)).to.be.equal(true);
      expect(poolSrcTokenBalanceAfter).to.be.equal(0);
      expect(poolTargetTokenBalanceAfter).to.be.gte(minimumReturn);
      const locked = await pie.getLock();
      expect(locked).to.eq(true);
    });

    it("Swapping half of token quantity should work (uniswap v2)", async () => {
      const srcToken = testTokens[0];

      const poolSrcTokenBalanceBefore = await srcToken.balanceOf(pie.address);

      const quantity = poolSrcTokenBalanceBefore.div(2);
      const minimumReturn = poolSrcTokenBalanceBefore; //1/2 to 1
      const poolTokensBefore = await pie.getTokens();
      expect(poolTokensBefore.includes(srcToken.address)).to.be.equal(true);
      expect(poolTokensBefore.includes(targetToken.address)).to.be.equal(false);

      const block = await ethers.provider.getBlock(
        await ethers.provider.getBlockNumber()
      );

      const path = [srcToken.address, WETH, targetToken.address];

      const swapStruct = {
        swaps: [
          {
            exchange: uniswapV2.address,
            path,
          },
        ],
        quantity,
        minimumReturn,
      };
      await rebalanceManager.rebalance([swapStruct], block.timestamp + 3000);

      const poolTokensAfter = await pie.getTokens();
      const poolSrcTokenBalanceAfter = await srcToken.balanceOf(pie.address);
      const poolTargetTokenBalanceAfter = await targetToken.balanceOf(
        pie.address
      );

      expect(poolTokensAfter.includes(srcToken.address)).to.be.equal(true);
      expect(poolTokensAfter.includes(targetToken.address)).to.be.equal(true);
      expect(poolSrcTokenBalanceAfter).to.be.equal(
        poolSrcTokenBalanceBefore.div(2)
      );
      expect(poolTargetTokenBalanceAfter).to.be.gte(minimumReturn);
      const locked = await pie.getLock();
      expect(locked).to.eq(true);
    });

    it("Rebalancing multiple token should work (uniswap v2)", async () => {
      const srcToken = testTokens[0];
      const srcToken2 = testTokens[1];
      const targetToken2 = IERC20__factory.connect(DAI, signers[0]);

      const poolSrcTokenBalanceBefore = await srcToken.balanceOf(pie.address);
      const poolSrcToken2BalanceBefore = await srcToken2.balanceOf(pie.address);

      const minimumReturn = "1000";

      const block = await ethers.provider.getBlock(
        await ethers.provider.getBlockNumber()
      );

      const swapStructs = [
        {
          swaps: [
            {
              exchange: uniswapV2.address,
              path: [srcToken.address, WETH, targetToken.address],
            },
          ],
          quantity: poolSrcTokenBalanceBefore.div(2),
          minimumReturn,
        },
        {
          swaps: [
            {
              exchange: UNISWAP_V2,
              path: [srcToken2.address, WETH, targetToken2.address],
            },
          ],
          quantity: poolSrcToken2BalanceBefore.div(2),
          minimumReturn,
        },
      ];

      await rebalanceManager.rebalance(swapStructs, block.timestamp + 3000);

      const poolTokensAfter = await pie.getTokens();
      const poolSrcTokenBalanceAfter = await srcToken.balanceOf(pie.address);
      const poolSrcToken2BalanceAfter = await srcToken2.balanceOf(pie.address);
      const poolTargetTokenBalanceAfter = await targetToken.balanceOf(
        pie.address
      );
      const poolTargetToken2BalanceAfter = await targetToken2.balanceOf(
        pie.address
      );

      expect(poolTokensAfter.includes(srcToken.address)).to.be.equal(true);
      expect(poolTokensAfter.includes(srcToken2.address)).to.be.equal(true);

      expect(poolTokensAfter.includes(targetToken.address)).to.be.equal(true);
      expect(poolTokensAfter.includes(targetToken2.address)).to.be.equal(true);

      expect(poolSrcTokenBalanceAfter).to.be.equal(
        poolSrcTokenBalanceBefore.div(2)
      );
      expect(poolSrcToken2BalanceAfter).to.be.equal(
        poolSrcTokenBalanceBefore.div(2)
      );

      expect(poolTargetTokenBalanceAfter).to.be.gte(minimumReturn);
      expect(poolTargetToken2BalanceAfter).to.be.gte(minimumReturn);

      const locked = await pie.getLock();
      expect(locked).to.eq(true);
    });

    it("Rebalancing with quantity bigger then hold should fail", async () => {
      const srcToken = testTokens[0];

      const poolSrcTokenBalanceBefore = await srcToken.balanceOf(pie.address);

      const quantity = poolSrcTokenBalanceBefore.add(2);
      const minimumReturn = poolSrcTokenBalanceBefore; //1/2 to 1
      const poolTokensBefore = await pie.getTokens();
      expect(poolTokensBefore.includes(srcToken.address)).to.be.equal(true);
      expect(poolTokensBefore.includes(targetToken.address)).to.be.equal(false);

      const block = await ethers.provider.getBlock(
        await ethers.provider.getBlockNumber()
      );

      const swapStruct = {
        swaps: [
          {
            exchange: UNISWAP_V2,
            path: [srcToken.address, WETH, targetToken.address],
          },
        ],
        quantity,
        minimumReturn,
      };
      await expect(
        rebalanceManager.rebalance([swapStruct], block.timestamp + 3000)
      ).to.be.revertedWith("CALL_FAILED");
    });
    it("Rebalancing as NON rebalancing manager should fail", async () => {
      const srcToken = testTokens[0];

      const poolSrcTokenBalanceBefore = await srcToken.balanceOf(pie.address);

      const quantity = poolSrcTokenBalanceBefore;
      const minimumReturn = poolSrcTokenBalanceBefore;

      const block = await ethers.provider.getBlock(
        await ethers.provider.getBlockNumber()
      );

      const swapStruct = {
        swaps: [
          {
            exchange: UNISWAP_V2,
            path: [srcToken.address, WETH, targetToken.address],
          },
        ],
        quantity,
        minimumReturn,
      };
      await expect(
        rebalanceManager
        .connect(signers[1])
          .rebalance([swapStruct], block.timestamp + 3000)
      ).to.be.revertedWith("NOT_REBALANCE_MANAGER");
    });

    it("Rebalancing as with invalid exchange should fail", async () => {
      const srcToken = testTokens[0];

      const poolSrcTokenBalanceBefore = await srcToken.balanceOf(pie.address);

      const quantity = poolSrcTokenBalanceBefore;
      const minimumReturn = poolSrcTokenBalanceBefore;

      const block = await ethers.provider.getBlock(
        await ethers.provider.getBlockNumber()
      );

      const swapStruct = {
        swaps: [
          {
            exchange: constants.AddressZero,
            path: [srcToken.address, WETH, targetToken.address],
          },
        ],
        quantity,
        minimumReturn,
      };
      await expect(
        rebalanceManager
          .rebalance([swapStruct], block.timestamp + 3000)
      ).to.be.revertedWith("INVALID_EXCHANGE");
    });

    it("Rebalancing as with incorrect internal trade should fail", async () => {
      const srcToken = testTokens[0];

      const poolSrcTokenBalanceBefore = await srcToken.balanceOf(pie.address);

      const quantity = poolSrcTokenBalanceBefore;
      const minimumReturn = poolSrcTokenBalanceBefore;

      const block = await ethers.provider.getBlock(
        await ethers.provider.getBlockNumber()
      );

      const swapStruct = {
        swaps: [
          {
            exchange: UNISWAP_V2,
            path: [srcToken.address, WETH, targetToken.address],
          },
          {
            exchange: UNISWAP_V2,
            path: [srcToken.address, WETH, targetToken.address],
          },
        ],
        quantity,
        minimumReturn,
      };
      await expect(
        rebalanceManager
          .rebalance([swapStruct], block.timestamp + 3000)
      ).to.be.revertedWith("INVALID_INPUT_TOKEN");
    });
    it("Rebalancing as should fail when not locked before", async () => {
      await pie.setLock(constants.One);

      const srcToken = testTokens[0];

      const poolSrcTokenBalanceBefore = await srcToken.balanceOf(pie.address);

      const quantity = poolSrcTokenBalanceBefore;
      const minimumReturn = poolSrcTokenBalanceBefore;

      const block = await ethers.provider.getBlock(
        await ethers.provider.getBlockNumber()
      );

      const swapStruct = {
        swaps: [
          {
            exchange: UNISWAP_V2,
            path: [srcToken.address, WETH, targetToken.address],
          },
        ],
        quantity,
        minimumReturn,
      };
      await expect(
        rebalanceManager
          .rebalance([swapStruct], block.timestamp + 3000)
      ).to.be.revertedWith("REQUIRE_LOCK");
    });
  });
});
