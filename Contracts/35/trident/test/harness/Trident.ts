import { BigNumber } from "@ethersproject/bignumber";
import { ContractFactory } from "@ethersproject/contracts";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { utils } from "ethers";
import { ethers } from "hardhat";
import {
  BentoBoxV1,
  ConcentratedLiquidityPool,
  ConcentratedLiquidityPoolFactory,
  ConcentratedLiquidityPoolManager,
  MasterDeployer,
  TickMathTest,
  TridentRouter,
} from "../../types";
import { ERC20Mock } from "../../types/ERC20Mock";
import { getBigNumber, getFactories, randBetween, sortTokens } from "./helpers";

export const TWO_POW_96 = BigNumber.from(2).pow(96);

export class Trident {
  private static _instance: Trident;
  private initialising!: Promise<Trident>;

  private tokenSupply = getBigNumber(10000000);

  public accounts!: SignerWithAddress[];
  public tokens!: ERC20Mock[];
  public tokenMap: [{ string: ERC20Mock }] = {} as [{ string: ERC20Mock }];
  public bento!: BentoBoxV1;
  public masterDeployer!: MasterDeployer;
  public router!: TridentRouter;
  public concentratedPoolManager!: ConcentratedLiquidityPoolManager;
  public concentratedPoolFactory!: ConcentratedLiquidityPoolFactory;
  public concentratedPools!: ConcentratedLiquidityPool[];
  public tickMath!: TickMathTest;

  public static get Instance() {
    return this._instance || (this._instance = new this());
  }

  public async init() {
    if (this.initialising) return this.initialising;

    this.initialising = new Promise<Trident>(async (resolve) => {
      this.accounts = await ethers.getSigners();

      const [ERC20, Bento, Deployer, TridentRouter, ConcentratedPoolManager, TickMath, TickLibrary] = await Promise.all(
        getFactories([
          "ERC20Mock",
          "BentoBoxV1",
          "MasterDeployer",
          "TridentRouter",
          "ConcentratedLiquidityPoolManager",
          "TickMathTest",
          "Ticks",
        ])
      );

      const tickLibrary = await TickLibrary.deploy();
      const clpLibs = {};
      clpLibs["Ticks"] = tickLibrary.address;
      const ConcentratedPoolFactory = await ethers.getContractFactory("ConcentratedLiquidityPoolFactory", { libraries: clpLibs });
      const ConcentratedLiquidityPool = await ethers.getContractFactory("ConcentratedLiquidityPool", { libraries: clpLibs });

      await this.deployTokens(ERC20);
      await this.deployBento(Bento);
      await this.deployTridentPeriphery(Deployer, TridentRouter);
      await this.prepareBento();
      await this.deployConcentratedPeriphery(ConcentratedPoolManager, ConcentratedPoolFactory, TickMath);
      await this.addFactoriesToWhitelist();
      await this.deployConcentratedCore(ConcentratedLiquidityPool);
      resolve(this);
    });

    return this.initialising;
  }

  public async getTokenBalance(tokens: string[], address: string, native: boolean) {
    const promises: Promise<BigNumber>[] = [];
    for (let token of tokens) {
      if (native) {
        promises.push(this.tokenMap[token].balanceOf(address));
      } else {
        promises.push(this.bento.balanceOf(token, address));
      }
    }
    return Promise.all(promises);
  }

  private async deployConcentratedCore(CLP: ContractFactory) {
    const [token0, token1] = sortTokens(this.tokens);
    const concentratedPools: ConcentratedLiquidityPool[] = [];
    const prices: BigNumber[] = [];

    // random price feed
    // prices."push(BigNumber.from(2).pow(96).mul(randBetween(1, 10000000)).div(randBetween(1, 10000000)));

    // stable price feed
    prices.push(TWO_POW_96);

    // low price feed
    prices.push(TWO_POW_96.div(16)); // whats the min and max value we support here??

    // mid price feed
    // prices.push(TWO_POW_96.mul(2));

    // high price feed
    prices.push(TWO_POW_96.mul(16));

    const fees = [5, 30];

    const tickSpacings = [5, 60];

    function data(token0, token1, fee, price, tickSpacing) {
      return utils.defaultAbiCoder.encode(["address", "address", "uint24", "uint160", "uint24"], [token0, token1, fee, price, tickSpacing]);
    }

    for (let i = 0; i < prices.length; i++) {
      for (let j = 0; j < fees.length; j++) {
        for (let k = 0; k < tickSpacings.length; k++) {
          await this.masterDeployer.deployPool(
            this.concentratedPoolFactory.address,
            data(token0.address, token1.address, fees[j], prices[i], tickSpacings[k])
          );
        }
      }
    }

    const poolAddresses = await this.concentratedPoolFactory.getPools(
      token0.address,
      token1.address,
      0,
      fees.length * prices.length * tickSpacings.length
    );

    for (let poolAddress of poolAddresses) {
      concentratedPools.push((await CLP.attach(poolAddress)) as ConcentratedLiquidityPool);
    }

    this.concentratedPools = concentratedPools;
  }

  private async deployTokens(ERC20: ContractFactory) {
    this.tokens = await Promise.all([
      ERC20.deploy("TokenA", "TOK", this.tokenSupply),
      ERC20.deploy("TokenB", "TOK", this.tokenSupply),
    ] as Promise<ERC20Mock>[]);
    this.tokenMap[this.tokens[0].address] = this.tokens[0];
    this.tokenMap[this.tokens[1].address] = this.tokens[1];
    this.tokens = sortTokens(this.tokens);
  }

  private async deployBento(Bento: ContractFactory) {
    this.bento = (await Bento.deploy(this.tokens[0].address)) as BentoBoxV1;
  }

  private async deployTridentPeriphery(Deployer: ContractFactory, TridentRouter: ContractFactory) {
    this.masterDeployer = (await Deployer.deploy(randBetween(1, 9999), this.accounts[1].address, this.bento.address)) as MasterDeployer;
    this.router = (await TridentRouter.deploy(this.bento.address, this.masterDeployer.address, this.tokens[0].address)) as TridentRouter;
  }

  private async deployConcentratedPeriphery(
    ConcentratedPoolManager: ContractFactory,
    ConcentratedPoolFactory: ContractFactory,
    TickMath: ContractFactory
  ) {
    this.concentratedPoolManager = (await ConcentratedPoolManager.deploy(
      this.tokens[0].address,
      this.masterDeployer.address
    )) as ConcentratedLiquidityPoolManager;
    this.concentratedPoolFactory = (await ConcentratedPoolFactory.deploy(this.masterDeployer.address)) as ConcentratedLiquidityPoolFactory;
    // for testing
    this.tickMath = (await TickMath.deploy()) as TickMathTest;
  }

  private async addFactoriesToWhitelist() {
    await Promise.all([this.masterDeployer.addToWhitelist(this.concentratedPoolFactory.address)]);
  }

  private async prepareBento() {
    await Promise.all([
      this.tokens[0].approve(this.bento.address, this.tokenSupply),
      this.tokens[1].approve(this.bento.address, this.tokenSupply),
    ]);
    await Promise.all([
      this.bento.deposit(this.tokens[0].address, this.accounts[0].address, this.accounts[0].address, this.tokenSupply.div(2), 0),
      this.bento.deposit(this.tokens[1].address, this.accounts[0].address, this.accounts[0].address, this.tokenSupply.div(2), 0),
    ]);
    await this.bento.whitelistMasterContract(this.router.address, true);
    await this.bento.setMasterContractApproval(
      this.accounts[0].address,
      this.router.address,
      true,
      "0",
      "0x0000000000000000000000000000000000000000000000000000000000000000",
      "0x0000000000000000000000000000000000000000000000000000000000000000"
    );
  }
}
