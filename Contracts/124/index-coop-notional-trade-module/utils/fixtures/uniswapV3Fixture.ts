import DeployHelper from "../deploys";
import { MAX_UINT_256 } from "../constants";
import { BigNumber, BigNumberish, Signer, providers } from "ethers";
import { Address } from "../types";
import { Account } from "../test/types";

import {
  UniswapV3Factory,
  SwapRouter,
  NonfungiblePositionManager,
  UniswapV3Pool,
  Quoter,
  NFTDescriptor
} from "../contracts/uniswapV3";

import { UniswapV3Pool__factory } from "../../typechain/factories/UniswapV3Pool__factory";
import { ether } from "../index";
import { StandardTokenMock } from "../../typechain/StandardTokenMock";
import { WETH9 } from "../../typechain/WETH9";
import { parseEther } from "ethers/lib/utils";

type Token = StandardTokenMock | WETH9;

export class UniswapV3Fixture {

  private _deployer: DeployHelper;
  private _ownerSigner: Signer;

  public factory: UniswapV3Factory;
  public swapRouter: SwapRouter;
  public nftPositionManager: NonfungiblePositionManager;
  public nftDescriptor: NFTDescriptor;
  public quoter: Quoter;

  public wethDaiPool: UniswapV3Pool;
  public wethWbtcPool: UniswapV3Pool;

  /**
   * Instantiates a new UniswapV3Fixture
   *
   * @param provider      the ethers web3 provider to use
   * @param ownerAddress  the address of the owner
   */
  constructor(provider: providers.Web3Provider | providers.JsonRpcProvider, ownerAddress: Address) {
    this._ownerSigner = provider.getSigner(ownerAddress);
    this._deployer = new DeployHelper(this._ownerSigner);
  }

  /**
   * Deploys contracts and creates weth-dai and weth-wbtc pools
   *
   * @param _owner  the owner of the deployed Uniswap V3 system
   * @param _weth   weth address
   * @param _wbtc   wbtc address
   * @param _dai    dai address
   */
  public async initialize(_owner: Account, _weth: Token, _wethPrice: number, _wbtc: Token, _wbtcPrice: number, _dai: Token): Promise<void> {
    this.factory = await this._deployer.external.deployUniswapV3Factory();
    this.swapRouter = await this._deployer.external.deploySwapRouter(this.factory.address, _weth.address);
    this.nftDescriptor = await this._deployer.external.deployNFTDescriptor();
    this.nftPositionManager = await this._deployer.external.deployNftPositionManager(this.factory.address, _weth.address, this.nftDescriptor.address);
    this.quoter = await this._deployer.external.deployQuoter(this.factory.address, _weth.address);

    this.wethDaiPool = await this.createNewPair(_weth, _dai, 3000, _wethPrice);
    this.wethWbtcPool = await this.createNewPair(_weth, _wbtc, 3000, _wethPrice / _wbtcPrice);
  }

  /**
   * Creates and initializes a new pool
   *
   * @param _token0         address of the first token
   * @param _token1         address of the second token
   * @param _fee            fee tier of either 500, 3000, or 10000
   * @param _ratio          the initial price ratio of the pool equal to priceToken0 / priceToken1
   * @returns               a new Uniswap V3 pool
   */
  public async createNewPair(
    _token0: Token,
    _token1: Token,
    _fee: BigNumberish,
    _ratio: number,
  ): Promise<UniswapV3Pool> {


    let ratio = _ratio * (10 ** (await _token1.decimals() - await _token0.decimals()));

    if (_token0.address.toLowerCase() > _token1.address.toLowerCase()) {
      ratio = 1 / ratio;
    }

    const [ token0Ordered, token1Ordered ] = this.getTokenOrder(_token0, _token1);

    const sqrtPrice = this._getSqrtPriceX96(ratio);

    await this.nftPositionManager.createAndInitializePoolIfNecessary(token0Ordered.address, token1Ordered.address, _fee, sqrtPrice);

    return this.getPool(_token0, _token1, _fee);
  }

  /**
   * Adds liquidity across the widest range, emulating a single Uniswap V2 LP
   *
   * @param _token0     address of token 1
   * @param _token1     address of token 2
   * @param _fee        the fee tier of either 500, 3000, or 10000
   * @param _amount0    maximum amount of token 1 used
   * @param _amount1    maximum amount of token 2 used
   * @param _recipient  the recipient of the LP NFT
   */
  public async addLiquidityWide(
    _token0: Token,
    _token1: Token,
    _fee: number,
    _amount0: BigNumber,
    _amount1: BigNumber,
    _recipient: Address
  ): Promise<void> {


    let [ amount0Ordered, amount1Ordered ] = [ _amount0, _amount1 ];
    let [ token0Ordered, token1Ordered ] = [ _token0, _token1 ];

    if (_token0.address.toLowerCase() > _token1.address.toLowerCase()) {
      [ amount0Ordered, amount1Ordered ] = [ _amount1, _amount0 ];
      [ token0Ordered, token1Ordered ] = [ _token1, _token0 ];
    }

    const tickSpacing = _fee / 50;  // ticks can only be initialized if they are a multiple of fee / 50
    const maxTick = 887272;   // the maximum tick index that Uniswap V3 allows
    const maxValidTick = Math.floor(maxTick / tickSpacing) * tickSpacing;   // valid ticks must be a multiple of tickSpacing
    const minValidTick = Math.ceil(-maxTick / tickSpacing) * tickSpacing;   // valid ticks must be a multiple of tickSpacing

    await this.nftPositionManager.connect(this._ownerSigner).mint({
      fee: _fee,
      token0: token0Ordered.address,
      token1: token1Ordered.address,
      tickLower: minValidTick,
      tickUpper: maxValidTick,
      amount0Desired: amount0Ordered,
      amount1Desired: amount1Ordered,
      amount0Min: 0,
      amount1Min: 0,
      deadline: MAX_UINT_256,
      recipient: _recipient,
    });
  }

  /**
   * Fetches a UniswapV3Pool
   *
   * @param _token0   first token
   * @param _token1   second token
   * @param _fee      fee tier of either 500, 3000, or 10000
   * @returns         the UniswapV3Pool
   */
  public async getPool(_token0: Token, _token1: Token, _fee: BigNumberish): Promise<UniswapV3Pool> {
    const [ token0Ordered, token1Ordered ] = this.getTokenOrder(_token0, _token1);
    const poolAddress = await this.factory.getPool(token0Ordered.address, token1Ordered.address, _fee);
    return UniswapV3Pool__factory.connect(poolAddress, this._ownerSigner);
  }

  /**
   * Gets the proper order of the tokens since Uniswap requires that
   * tokens be passed to it in a particular order for many of its functions
   *
   * @param _token0   first token
   * @param _token1   second token
   * @returns         [ first, second ]
   */
  public getTokenOrder(_token0: Token, _token1: Token): [Token, Token] {
    return _token0.address.toLowerCase() < _token1.address.toLowerCase() ? [_token0, _token1] : [_token1, _token0];
  }

  _getSqrtPriceX96(_ratio: number): BigNumber {
    return parseEther(Math.sqrt(_ratio).toFixed(18).toString()).mul(BigNumber.from(2).pow(96)).div(ether(1));
  }
}
