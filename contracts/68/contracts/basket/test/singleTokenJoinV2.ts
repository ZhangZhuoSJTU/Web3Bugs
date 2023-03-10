import chai, { expect } from "chai";
import { deployContract, solidity } from "ethereum-waffle";
import { ethers, run, network } from "hardhat";
import { Signer, constants, utils, Contract, BytesLike, BigNumberish } from "ethers";
import SingleTokenJoinV2Artifact from "../artifacts/contracts/singleJoinExit/SingleTokenJoinV2.sol/SingleTokenJoinV2.json";
import BasketFacetArtifact from "../artifacts/contracts/facets/Basket/BasketFacet.sol/BasketFacet.json";
import Erc20FacetArtifact from "../artifacts/contracts/facets/ERC20/ERC20Facet.sol/ERC20Facet.json";
import MockTokenArtifact from "../artifacts/contracts/test/MockToken.sol/MockToken.json";
import MockPangolinRouterArtifact from "../artifacts/contracts/test/MockPangolinRouter.sol/MockPangolinRouter.json";
import {
  ERC20Facet,
  BasketFacet,
  DiamondFactoryContract,
  MockToken,
  MockPangolinRouter,
} from "../typechain";
import { IExperiPie__factory as IExperiPieFactory } from "../typechain/factories/IExperiPie__factory";
import { IExperiPie } from "../typechain/IExperiPie";
import { SingleTokenJoinV2 } from "../typechain/SingleTokenJoinV2";

import TimeTraveler from "../utils/TimeTraveler";
import { parseEther } from "ethers/lib/utils";

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
const referralCode = constants.Zero;

describe("SingleTokenJoinV2", function () {
  this.timeout(300000000);

  let experiPie: IExperiPie;
  let singleTokenJoin: SingleTokenJoinV2;
  let account: string;
  let signers: Signer[];
  let timeTraveler: TimeTraveler;
  const testTokens: MockToken[] = [];
  let mockWavax: MockToken;
  let mockedPangolinRouter: MockPangolinRouter;
  const getTrades =(inputToken,calcTokenFor)=>{

    const trades: {
      swaps: { exchange: string; path: string[] }[];
      quantity: BigNumberish;
    }[] = [] ;
    calcTokenFor.tokens.forEach((token, index) => {
      trades.push({
        swaps: [
          {
            exchange: mockedPangolinRouter.address,
            path: [inputToken.address, token],
          },
        ],
        quantity: calcTokenFor.amounts[index],
      });
    });
    return trades
  }
  before(async () => {
    signers = await ethers.getSigners();
    account = await signers[0].getAddress();
    timeTraveler = new TimeTraveler(network.provider);

    const diamondFactory = (await run(
      "deploy-diamond-factory"
    )) as DiamondFactoryContract;

    const basketFacet = (await deployContract(
      signers[0],
      BasketFacetArtifact
    )) as BasketFacet;
    const erc20Facet = (await deployContract(
      signers[0],
      Erc20FacetArtifact
    )) as ERC20Facet;
    mockedPangolinRouter = (await deployContract(
      signers[0],
      MockPangolinRouterArtifact
    )) as MockPangolinRouter;

    await diamondFactory.deployNewDiamond(account, [
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
    ]);
    mockWavax = (await deployContract(signers[0], MockTokenArtifact, [
      "Mock",
      "Mock",
    ])) as MockToken;
    const experiPieAddress = await diamondFactory.diamonds(0);
    experiPie = IExperiPieFactory.connect(experiPieAddress, signers[0]);
    singleTokenJoin = (await deployContract(
      signers[0],
      SingleTokenJoinV2Artifact,
      [mockWavax.address, mockedPangolinRouter.address]
    )) as SingleTokenJoinV2;

    for (let i = 0; i < 3; i++) {
      const token = (await deployContract(signers[0], MockTokenArtifact, [
        "Mock",
        "Mock",
      ])) as MockToken;
      await token.mint(parseEther("1000000"), account);
      testTokens.push(token);
    }

    await timeTraveler.snapshot();
  });

  beforeEach(async () => {
    await timeTraveler.revertSnapshot();
  });

  describe("Joining and exiting", async () => {
    beforeEach(async () => {
      for (let token of testTokens) {
        await token.approve(experiPie.address, constants.MaxUint256);
        await token.transfer(experiPie.address, parseEther("10000"));
        const account1 = await signers[1].getAddress();
        await token.mint(parseEther("10000"), account1);
        token
          .connect(signers[1])
          .approve(experiPie.address, constants.MaxUint256);
        await experiPie.addToken(token.address);
      }

      await experiPie.initialize(parseEther("100"), "TEST", "TEST");
      await experiPie.setLock(constants.One);
      await experiPie.setCap(constants.MaxUint256);
    });

    const getBalances = async (address: string) => {
      return {
        t0: await testTokens[0].balanceOf(address),
        t1: await testTokens[1].balanceOf(address),
        t2: await testTokens[2].balanceOf(address),
        pie: await experiPie.balanceOf(address),
      };
    };

    it("Join pool and use complete input amount", async () => {
      const mintAmount = parseEther("1");

      const totalSupplyBefore = await experiPie.totalSupply();
      const userBalancesBefore = await getBalances(account);
      const pieBalancesBefore = await getBalances(experiPie.address);
      const wavaxBalanceBefore = await mockWavax.balanceOf(account);

      const calcTokenFor = await experiPie.calcTokensForAmount(mintAmount);
      const inputToken = (await deployContract(signers[0], MockTokenArtifact, [
        "Mock",
        "Mock",
      ])) as MockToken;
      await inputToken.mint(parseEther("1000000"), account);

      const outputToken = experiPie.address;
      const inputAmount = parseEther("900000");
      await mockedPangolinRouter.setAmountIn(
        inputAmount.div(testTokens.length)
      );
      await mockedPangolinRouter.setAmountOut(inputAmount);

      const outputAmount = parseEther("1").toString();
      const block = await ethers.provider.getBlock(
        await ethers.provider.getBlockNumber()
      );

      const deadline = block.timestamp + 3000;
      const trades: {
        swaps: { exchange: string; path: string[] }[];
        quantity: BigNumberish;
      }[] = getTrades(inputToken, calcTokenFor)
      await inputToken.approve(singleTokenJoin.address, constants.MaxUint256);
      const parameterFroSingleJoin = {
        inputToken: inputToken.address,
        outputBasket: outputToken,
        inputAmount,
        outputAmount,
        trades,
        deadline,
        referral: referralCode,
      };
      await singleTokenJoin.joinTokenSingle(parameterFroSingleJoin);

      const totalSupplyAfter = await experiPie.totalSupply();
      const userBalancesAfter = await getBalances(account);
      const pieBalancesAfter = await getBalances(experiPie.address);
      const wavaxBalanceAfter = await mockWavax.balanceOf(account);

      const expectedTokenAmount = pieBalancesBefore.t0
        .mul(mintAmount)
        .div(totalSupplyBefore);
      calcTokenFor.amounts.forEach((amount) => {
        expect(amount).to.be.eq(expectedTokenAmount);
      });

      expect(totalSupplyAfter).to.eq(totalSupplyBefore.add(mintAmount));

      // Verify user balances
      expect(userBalancesAfter.pie).to.eq(
        userBalancesBefore.pie.add(mintAmount)
      );
      expect(wavaxBalanceAfter).to.eq(wavaxBalanceBefore);

      // Verify pie balances
      expect(pieBalancesAfter.t0).to.eq(
        pieBalancesBefore.t0.add(expectedTokenAmount)
      );
      expect(pieBalancesAfter.t1).to.eq(
        pieBalancesBefore.t1.add(expectedTokenAmount)
      );
      expect(pieBalancesAfter.t2).to.eq(
        pieBalancesBefore.t2.add(expectedTokenAmount)
      );
    });

    it("Join pool with too little input token", async () => {
      const inputToken = (await deployContract(signers[0], MockTokenArtifact, [
        "Mock",
        "Mock",
      ])) as MockToken;
      await inputToken.mint(parseEther("1000000"), account);

      const outputToken = experiPie.address;
      const inputAmount = parseEther("100000");
      await mockedPangolinRouter.setAmountIn(inputAmount);
      await mockedPangolinRouter.setAmountOut(inputAmount);

      const outputAmount = parseEther("1").toString();
      const block = await ethers.provider.getBlock(
        await ethers.provider.getBlockNumber()
      );

      const deadline = block.timestamp + 3000;
      const calcTokenFor = await experiPie.calcTokensForAmount(outputAmount);

      const trades: {
        swaps: { exchange: string; path: string[] }[];
        quantity: BigNumberish;
      }[] = getTrades(inputToken, calcTokenFor)
      await inputToken.approve(singleTokenJoin.address, constants.MaxUint256);
      const parameterFroSingleJoin = {
        inputToken: inputToken.address,
        outputBasket: outputToken,
        inputAmount,
        outputAmount,
        trades,
        deadline,
        referral: referralCode,
      };

      await expect(
        singleTokenJoin.joinTokenSingle(parameterFroSingleJoin)
      ).to.be.revertedWith("ERC20: transfer amount exceeds balance");
    });

    it("Join pool with wavax and use complete input amount", async () => {
      const mintAmount = parseEther("1");

      const totalSupplyBefore = await experiPie.totalSupply();
      const userBalancesBefore = await getBalances(account);
      const pieBalancesBefore = await getBalances(experiPie.address);

      const calcTokenFor = await experiPie.calcTokensForAmount(mintAmount);
      const inputToken = mockWavax;
      await inputToken.mint(parseEther("1000000"), account);

      const outputToken = experiPie.address;
      const inputAmount = parseEther("900000");
      await mockedPangolinRouter.setAmountIn(
        inputAmount.div(testTokens.length)
      );
      await mockedPangolinRouter.setAmountOut(inputAmount);

      const outputAmount = parseEther("1").toString();
      const block = await ethers.provider.getBlock(
        await ethers.provider.getBlockNumber()
      );

      const deadline = block.timestamp + 3000;

      const trades: {
        swaps: { exchange: string; path: string[] }[];
        quantity: BigNumberish;
      }[] = getTrades(inputToken, calcTokenFor)
      await inputToken.approve(singleTokenJoin.address, constants.MaxUint256);

      const parameterFroSingleJoin = {
        inputToken: inputToken.address,
        outputBasket: outputToken,
        inputAmount,
        outputAmount,
        trades,
        deadline,
        referral: referralCode,
      };
      await singleTokenJoin.joinTokenSingle(parameterFroSingleJoin);

      const totalSupplyAfter = await experiPie.totalSupply();
      const userBalancesAfter = await getBalances(account);
      const pieBalancesAfter = await getBalances(experiPie.address);

      const expectedTokenAmount = pieBalancesBefore.t0
        .mul(mintAmount)
        .div(totalSupplyBefore);
      calcTokenFor.amounts.forEach((amount) => {
        expect(amount).to.be.eq(expectedTokenAmount);
      });

      expect(totalSupplyAfter).to.eq(totalSupplyBefore.add(mintAmount));

      // Verify user balances
      expect(userBalancesAfter.pie).to.eq(
        userBalancesBefore.pie.add(mintAmount)
      );

      // Verify pie balances
      expect(pieBalancesAfter.t0).to.eq(
        pieBalancesBefore.t0.add(expectedTokenAmount)
      );
      expect(pieBalancesAfter.t1).to.eq(
        pieBalancesBefore.t1.add(expectedTokenAmount)
      );
      expect(pieBalancesAfter.t2).to.eq(
        pieBalancesBefore.t2.add(expectedTokenAmount)
      );
    });
    it("Join pool with too much wavax as input token", async () => {
      const mintAmount = parseEther("1");

      const totalSupplyBefore = await experiPie.totalSupply();
      const userBalancesBefore = await getBalances(account);
      const pieBalancesBefore = await getBalances(experiPie.address);

      const calcTokenFor = await experiPie.calcTokensForAmount(mintAmount);
      const inputToken = mockWavax;
      await inputToken.mint(parseEther("1000000"), account);

      const outputToken = experiPie.address;
      const inputAmount = parseEther("100000");
      await mockedPangolinRouter.setAmountIn(
        inputAmount.div(testTokens.length + 1)
      );
      await mockedPangolinRouter.setAmountOut(inputAmount);

      const outputAmount = mintAmount.toString();
      const block = await ethers.provider.getBlock(
        await ethers.provider.getBlockNumber()
      );

      const deadline = block.timestamp + 3000;
      const trades: {
        swaps: { exchange: string; path: string[] }[];
        quantity: BigNumberish;
      }[] = getTrades(inputToken, calcTokenFor)
      await inputToken.approve(singleTokenJoin.address, constants.MaxUint256);
      const parameterFroSingleJoin = {
        inputToken: inputToken.address,
        outputBasket: outputToken,
        inputAmount,
        outputAmount,
        trades,
        deadline,
        referral: referralCode,
      };
      await singleTokenJoin.joinTokenSingle(parameterFroSingleJoin);

      const totalSupplyAfter = await experiPie.totalSupply();
      const userBalancesAfter = await getBalances(account);
      const pieBalancesAfter = await getBalances(experiPie.address);

      const expectedTokenAmount = pieBalancesBefore.t0
        .mul(mintAmount)
        .div(totalSupplyBefore);
      calcTokenFor.amounts.forEach((amount) => {
        expect(amount).to.be.eq(expectedTokenAmount);
      });

      expect(totalSupplyAfter).to.eq(totalSupplyBefore.add(mintAmount));

      // Verify user balances
      expect(userBalancesAfter.pie).to.eq(
        userBalancesBefore.pie.add(mintAmount)
      );

      // Verify pie balances
      expect(pieBalancesAfter.t0).to.eq(
        pieBalancesBefore.t0.add(expectedTokenAmount)
      );
      expect(pieBalancesAfter.t1).to.eq(
        pieBalancesBefore.t1.add(expectedTokenAmount)
      );
      expect(pieBalancesAfter.t2).to.eq(
        pieBalancesBefore.t2.add(expectedTokenAmount)
      );
    });
  });
});
