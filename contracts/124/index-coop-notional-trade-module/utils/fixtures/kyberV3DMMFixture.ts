import DeployHelper from "../deploys";
import { providers, Signer, BigNumber } from "ethers";
import { Address } from "../types";
import { Account } from "../test/types";

import { StandardTokenMock } from "../contracts";
import {
  DMMPool,
  DMMFactory,
  DMMRouter02
} from "../contracts/kyberV3";

import { ether } from "../common";
import { DMMPool__factory } from "../../typechain/factories/DMMPool__factory";

export class KyberV3DMMFixture {
  private _deployer: DeployHelper;
  private _ownerSigner: Signer;

  public owner: Account;
  public knc: StandardTokenMock;
  public dmmFactory: DMMFactory;
  public dmmRouter: DMMRouter02;

  public kncWethPool: DMMPool;
  public wethDaiPool: DMMPool;
  public wethWbtcPool: DMMPool;

  constructor(provider: providers.Web3Provider | providers.JsonRpcProvider, ownerAddress: Address) {
    this._ownerSigner = provider.getSigner(ownerAddress);
    this._deployer = new DeployHelper(this._ownerSigner);
  }

  public async initialize(_owner: Account, _weth: Address, _wbtc: Address, _dai: Address): Promise<void> {
    this.owner = _owner;
    this.dmmFactory = await this._deployer.external.deployDMMFactory(this.owner.address);
    this.dmmRouter = await this._deployer.external.deployDMMRouter02(this.dmmFactory.address, _weth);
    this.knc = await this._deployer.mocks.deployTokenMock(this.owner.address, ether(100000), 18);
    this.kncWethPool = await this.createNewPool(
      _weth,
      this.knc.address,
      BigNumber.from(19000)   // Amp factor of 1.9 (in BPS) because correlated assets
    );
    this.wethDaiPool = await this.createNewPool(
      _weth,
      _dai,
      BigNumber.from(10000)   // Amp factor of 1 (in BPS) because un-correlated assets
    );
    this.wethWbtcPool = await this.createNewPool(
      _weth,
      _wbtc,
      BigNumber.from(15000)   // Amp factor of 1.5 (in BPS) because correlated assets
    );
  }

  /**
   * Creates new DMM pool. The token addresses are interchangeable.
   * NOTE: There can be at most 1 unamplified pool for a token pair, ie. only 1 pool can exist with ampBps = BPS (10000).
   * Should there already be an existing unamplified pool, attempts to create another one will fail.
   *
   * @param _token0     address of token 1
   * @param _token1     address of token 2
   * @param _ampBps     Amplification factor (in BPS)
   */
  public async createNewPool(_tokenA: Address, _tokenB: Address, _ampBps: BigNumber): Promise<DMMPool> {
    await this.dmmFactory.createPool(_tokenA, _tokenB, _ampBps);
    const poolAddress = await this.dmmFactory.allPools((await this.dmmFactory.allPoolsLength()).sub(1));
    return new DMMPool__factory(this._ownerSigner).attach(poolAddress);
  }

  public getTokenOrder(_tokenOne: Address, _tokenTwo: Address): [Address, Address] {
    return _tokenOne.toLowerCase() < _tokenTwo.toLowerCase() ? [_tokenOne, _tokenTwo] : [_tokenTwo, _tokenOne];
  }
}
