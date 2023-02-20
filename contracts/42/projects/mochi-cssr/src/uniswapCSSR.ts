import { parseBlock, Block, rlpEncodeBlock } from './block';
import { rlpEncode, rlpDecode, RlpItem } from './rlp-encoder';
import { providers, Contract, utils, BigNumber } from 'ethers';
import axios from 'axios';
function toRlpDecoded(hex: string): RlpItem {
  const hexed = Uint8Array.from(Buffer.from(hex.substring(2), 'hex'));
  return rlpDecode(hexed);
}
interface Proof {
  accountProof: Uint8Array;
  storageProof: Uint8Array[];
}
interface UniswapProof {
  pair: string;
  blockState: Uint8Array;
  accountProof: Uint8Array;
  reserveProof: Uint8Array;
  price0Proof: Uint8Array;
  price1Proof: Uint8Array;
}

const keyCurrencies = {
  rinkeby: [
    "0xCbaf7951ca2EA8D0792635C487604e620B7ec089", //mock weth
    "0x7c3c7526db71C88Ce9e40A04Ff46af5D466005B7" //mock dai
  ],
  mainnet: [
    "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599", //wbtc
    "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2", //weth
    "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",//usdc
    "0x6b175474e89094c44da98b954eedeac495271d0f",//dai
  ]
}

const SUBGRAPH_URL =
  'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2';

export class UniswapCSSR {
  provider: providers.JsonRpcProvider;

  constructor(provider: providers.JsonRpcProvider) {
    this.provider = provider;
  }

  async getBlock(blockNumber: bigint): Promise<Block> {
    const result = await this.provider.send('eth_getBlockByNumber', [
      '0x' + blockNumber.toString(16),
      false,
    ]);
    if (result === null) throw new Error(`Unknown block number ${blockNumber}`);
    if (result.logsBloom === null)
      throw new Error(`Block ${blockNumber} was missing 'logsBloom' field.`);
    if (result.number === null)
      throw new Error(`Block ${blockNumber} was missing 'number' field.`);
    const block = parseBlock(result);
    return block;
  }

  async getProof(
    blockNumber: bigint,
    address: string,
    slots: bigint[],
  ): Promise<Proof> {
    const res = await this.provider.send('eth_getProof', [
      address,
      slots.map((x) => '0x' + x.toString(16)),
      '0x' + blockNumber.toString(16),
    ]);
    const accountProof = rlpEncode(res.accountProof.map(toRlpDecoded));
    const storageProof = res.storageProof.map((x) =>
      rlpEncode(x.proof.map(toRlpDecoded)),
    );
    return {
      accountProof,
      storageProof,
    };
  }

  async getReserve(token: string, denToken:string): Promise<BigNumber> {
    const tokenIs0 = Number(token) <= Number(denToken);
    let token0 = tokenIs0? token: denToken;
    let token1 = tokenIs0? denToken: token;
    const {
      data: {
        data: { pairs }
      }
    } = await axios.post(SUBGRAPH_URL, {
      query: `
      {
        pairs (where: {
          token0: "${token0.toLowerCase()}",
          token1: "${token1.toLowerCase()}"
        }) {
          reserve0,
          reserve1
        }
      }

      `
    })
    console.log("PAIRS");
    console.log(pairs);
    return tokenIs0?utils.parseUnits(pairs[0].reserve0, "ether") : utils.parseUnits(pairs[0].reserve1, "ether");
  }

  async findDenToken(token: string): Promise<[string, BigNumber]> {
    const network = await this.provider.getNetwork();
    const currencies = network.chainId === 4 ? keyCurrencies.rinkeby : keyCurrencies.mainnet;
    let maxIndex = 0;
    let maxValue = BigNumber.from(0);
    for(let i = 0 ; i<currencies.length; i++){
      if(token.toLowerCase() === currencies[i].toLowerCase()){
        continue;
      }
      try{
        const value = await this.getReserve(token, currencies[i]);
        if(value.gt(maxValue)) {
          maxIndex = i;
          maxValue = value;
        }
      } catch (error) {
        console.error("[UniCSSR] Error while fetching pair for " + token + " and " + currencies[i]);
      }
    }
    return [currencies[maxIndex], maxValue];
  }

  async getPair(token0: string, token1: string): Promise<string> {
    const tokenIs0 = Number(token0) <= Number(token1);
    if(!tokenIs0) {
      const temp = token0;
      token0 = token1;
      token1 = temp;
    }
    const {
      data: {
        data: { pairs }
      }
    } = await axios.post(SUBGRAPH_URL, {
      query: `
      {
        pairs (where: {
          token0: "${token0.toLowerCase()}",
          token1: "${token1.toLowerCase()}"
        }) {
          id
        }
      }

      `
    });
    return pairs[0].id;
  }

  async getStorageAt(
    address: string,
    slot: bigint,
    blockNumber: bigint,
  ): Promise<string> {
    const result = await this.provider.send('eth_getStorageAt', [
      address,
      '0x' + slot.toString(16),
      '0x' + blockNumber.toString(16),
    ]);
    return result;
  }

  async getData(
    blockNumber: bigint,
    token0: string,
    token1: string,
  ): Promise<UniswapProof> {
    const blockState = await this.getBlockState(blockNumber);
    const pair = await this.getPair(token0, token1);
    const proofs = await this.getProof(blockNumber, pair, [8n, 9n, 10n]);

    return {
      pair,
      blockState,
      accountProof: proofs.accountProof,
      reserveProof: proofs.storageProof[0],
      price0Proof: proofs.storageProof[1],
      price1Proof: proofs.storageProof[2],
    };
  }

  getPackedData(denominationToken: string, proof: UniswapProof): string {
    return utils.defaultAbiCoder.encode(
      ['address', 'bytes', 'bytes', 'bytes', 'bytes', 'bytes'],
      [
        denominationToken,
        proof.blockState,
        proof.accountProof,
        proof.reserveProof,
        proof.price0Proof,
        proof.price1Proof,
      ],
    );
  }

  async getBlockState(blockNumber: bigint): Promise<Uint8Array> {
    const block = await this.getBlock(blockNumber);
    return rlpEncodeBlock(block);
  }
}
