import { providers, Contract, utils, BigNumber } from 'ethers';
import { SushiswapCSSR } from './sushiswapCSSR';
import { UniswapCSSR } from './uniswapCSSR';

interface DenToken {
  amm: string;
  denToken: string;
}

export class MochiCSSR {
  sushi: SushiswapCSSR;
  uni: UniswapCSSR;

  constructor(provider: providers.JsonRpcProvider) {
    this.sushi = new SushiswapCSSR(provider);
    this.uni = new UniswapCSSR(provider);
  }

  async findDenToken(blockNumber: bigint, address: string): Promise<DenToken> {
    const [uniDen, uniLiquidity] = await this.uni.findDenToken(address);
    const [sushiDen, sushiLiquidity] = await this.sushi.findDenToken(address);
    if(uniLiquidity.gte(sushiLiquidity)){
      return {
        amm: "uni",
        denToken: uniDen
      };
    } else {
      return {
        amm: "sushi",
        denToken: sushiDen
      };
    }
  }

  async getProofOfDen(blockNumber : bigint, address : string, denInfo: DenToken): Promise<string>{
    if(denInfo.amm === "uni") {
      console.log("[MochiCSSR] Using Uni " + denInfo.denToken + " as denToken for " + address);
      const data = await this.uni.getData(blockNumber, address, denInfo.denToken);
      const packed = this.uni.getPackedData(denInfo.denToken, data);
      return utils.defaultAbiCoder.encode(
        ['uint256', 'bytes'],
        [0,packed]
      );
    } else {
      console.log("[MochiCSSR] Using Sushi " + denInfo.denToken + " as denToken for "+address);
      const data = await this.sushi.getData(blockNumber, address, denInfo.denToken);
      const packed = this.sushi.getPackedData(denInfo.denToken, data);
      return utils.defaultAbiCoder.encode(
        ['uint256', 'bytes'],
        [1,packed]
      );
    }
  }

  async getProof(blockNumber: bigint, address: string): Promise<string> {
    const [uniDen, uniLiquidity] = await this.uni.findDenToken(address);
    const [sushiDen, sushiLiquidity] = await this.sushi.findDenToken(address);
    if(uniLiquidity.gte(sushiLiquidity)){
      console.log("[MochiCSSR] Using Uni " + uniDen + " as denToken for " + address);
      const data = await this.uni.getData(blockNumber, address, uniDen);
      const packed = this.uni.getPackedData(uniDen, data);
      return utils.defaultAbiCoder.encode(
        ['uint256', 'bytes'],
        [0,packed]
      );
    } else {
      console.log("[MochiCSSR] Using Sushi " + sushiDen + " as denToken for "+address);
      const data = await this.sushi.getData(blockNumber, address, sushiDen);
      const packed = this.sushi.getPackedData(sushiDen, data);
      return utils.defaultAbiCoder.encode(
        ['uint256', 'bytes'],
        [1,packed]
      );
    }
  }
}
