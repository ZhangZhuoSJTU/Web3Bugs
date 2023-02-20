import { rlpEncode, rlpDecode } from './rlp-encoder';
import {
  stripLeadingZeros,
  addressToString,
  unsignedIntegerToUint8Array,
} from './utils';
export function wireEncodeByteArray(bytes: ArrayLike<number>): string {
  let result = '';
  for (let i = 0; i < bytes.length; ++i) {
    result += ('0' + bytes[i].toString(16)).slice(-2);
  }
  return `0x${result}`;
}
export class Bytes extends Uint8Array {
  public static fromByteArray(
    bytes: ArrayLike<number>,
    pad: 'left' | 'right' = 'right',
  ): Bytes {
    const result = new this(bytes.length);
    if (bytes.length > result.length)
      throw new Error(
        `Source bytes are longer (${bytes.length}) than destination bytes (${result.length})\n${bytes}`,
      );
    for (let i = 0; i < bytes.length; ++i) {
      const byte = bytes[i];
      if (byte > 0xff || byte < 0)
        throw new Error(
          `Source array must only include numbers between 0 and ${0xff}.\n${bytes}`,
        );
    }
    result.set(bytes, pad === 'left' ? result.length - bytes.length : 0);
    return result;
  }

  public static fromHexString(hex: string, pad?: 'left' | 'right'): Bytes {
    const match = /^(?:0x)?([a-fA-F0-9]*)$/.exec(hex);
    if (match === null)
      throw new Error(
        `Expected a hex string encoded byte array with an optional '0x' prefix but received ${hex}`,
      );
    const normalized = match[1];
    if (normalized.length % 2)
      throw new Error(
        `Hex string encoded byte array must be an even number of charcaters long.`,
      );
    const bytes = [];
    for (let i = 0; i < normalized.length; i += 2) {
      bytes.push(Number.parseInt(`${normalized[i]}${normalized[i + 1]}`, 16));
    }
    return this.fromByteArray(bytes, pad);
  }

  public static fromStringLiteral(
    literal: string,
    pad32: 'left' | 'right' | 'none' = 'none',
  ): Bytes {
    const encoded = new TextEncoder().encode(literal);
    const padding = new Uint8Array((32 - (encoded.length % 32)) % 32);
    switch (pad32) {
      case 'none':
        return this.fromByteArray(encoded);
      case 'left':
        return this.fromByteArray([...padding, ...encoded]);
      case 'right':
        return this.fromByteArray([...encoded, ...padding]);
      default:
        throw new Error(`Invalid 'pad32' parameter: ${pad32}.`);
    }
  }

  public static fromUnsignedInteger(
    value: bigint | number,
    numberOfBits: number,
  ): Bytes {
    if (numberOfBits % 8)
      throw new Error(`numberOfBits must be a multiple of 8.`);
    if (typeof value === 'number') value = BigInt(value);
    if (value >= 2n ** BigInt(numberOfBits) || value < 0n)
      throw new Error(
        `Cannot fit ${value} into a ${numberOfBits}-bit unsigned integer.`,
      );
    const numberOfBytes = numberOfBits / 8;
    const result = new this(numberOfBytes);
    if (result.length !== numberOfBytes)
      throw new Error(
        `Cannot a ${numberOfBits} value into a ${result.length} byte array.`,
      );
    for (let i = 0; i < result.length; ++i) {
      result[i] = Number((value >> BigInt(numberOfBits - i * 8 - 8)) & 0xffn);
    }
    return result;
  }

  public static fromSignedInteger(
    value: bigint | number,
    numberOfBits: number,
  ): Bytes {
    if (typeof value === 'number') value = BigInt(value);
    if (
      value >= 2n ** BigInt(numberOfBits - 1) ||
      value < -(2n ** BigInt(numberOfBits - 1))
    )
      throw new Error(
        `Cannot fit ${value} into a ${numberOfBits}-bit signed integer.`,
      );
    const unsignedValue = this.twosComplement(value, numberOfBits);
    return this.fromUnsignedInteger(unsignedValue, numberOfBits);
  }

  public readonly toString = () =>
    this.reduce(
      (result: string, byte: number) =>
        result + ('0' + byte.toString(16)).slice(-2),
      '',
    );

  public readonly to0xString = () => wireEncodeByteArray(this);

  public readonly toUnsignedBigint = () => {
    let value = 0n;
    for (let byte of this) {
      value = (value << 8n) + BigInt(byte);
    }
    return value;
  };

  public readonly toSignedBigint = () => {
    const unsignedValue = this.toUnsignedBigint();
    return Bytes.twosComplement(unsignedValue, this.length * 8);
  };

  public readonly equals = (
    other: { length: number; [i: number]: number } | undefined | null,
  ): boolean => {
    if (other === undefined || other === null) return false;
    if (this.length !== other.length) return false;
    for (let i = 0; i < this.length; ++i) {
      if (this[i] !== other[i]) return false;
    }
    return true;
  };

  // this is important TypeScript magic whose provenance and purpose has been lost to time
  public static get [Symbol.species]() {
    return Uint8Array;
  }

  private static twosComplement(value: bigint, numberOfBits: number): bigint {
    const mask = 2n ** (BigInt(numberOfBits) - 1n) - 1n;
    return (value & mask) - (value & ~mask);
  }
}

export type Block = {
  readonly hash: bigint | null;
  readonly number: bigint | null;
  readonly nonce: bigint | null;
  readonly logsBloom: bigint | null;
  readonly parentHash: bigint;
  readonly sha3Uncles: bigint;
  readonly transactionsRoot: bigint;
  readonly stateRoot: bigint;
  readonly receiptsRoot: bigint;
  readonly miner: bigint;
  readonly difficulty: bigint;
  readonly totalDifficulty: bigint;
  readonly extraData: Bytes;
  readonly size: bigint;
  readonly gasLimit: bigint;
  readonly gasUsed: bigint;
  readonly timestamp: bigint;
  readonly baseFeePerGas: bigint;
  readonly mixHash: bigint | null;
  readonly transactions: Array<Transaction | bigint>;
  readonly uncles: Array<bigint>;
};

export function rlpEncodeBlock(block: Block): Uint8Array {
  return rlpEncode([
    unsignedIntegerToUint8Array(block.parentHash, 32),
    unsignedIntegerToUint8Array(block.sha3Uncles, 32),
    unsignedIntegerToUint8Array(block.miner, 20),
    unsignedIntegerToUint8Array(block.stateRoot, 32),
    unsignedIntegerToUint8Array(block.transactionsRoot, 32),
    unsignedIntegerToUint8Array(block.receiptsRoot, 32),
    unsignedIntegerToUint8Array(block.logsBloom, 256),
    stripLeadingZeros(unsignedIntegerToUint8Array(block.difficulty, 32)),
    stripLeadingZeros(unsignedIntegerToUint8Array(block.number, 32)),
    stripLeadingZeros(unsignedIntegerToUint8Array(block.gasLimit, 32)),
    stripLeadingZeros(unsignedIntegerToUint8Array(block.gasUsed, 32)),
    stripLeadingZeros(unsignedIntegerToUint8Array(block.timestamp, 32)),
    stripLeadingZeros(block.extraData),
    ...(block.mixHash !== undefined
      ? [unsignedIntegerToUint8Array(block.mixHash, 32)]
      : []),
    ...(block.nonce !== null && block.nonce !== undefined
      ? [unsignedIntegerToUint8Array(block.nonce, 8)]
      : []),
    stripLeadingZeros(unsignedIntegerToUint8Array(block.baseFeePerGas, 32)),
  ]);
}

export type RawHash = string;
export type RawQuantity = string;
export type RawBlockTag = string;
export type RawAddress = string;
export type RawData = string;

export interface RawTransaction {
  readonly blockHash: RawHash | null;
  readonly blockNumber: RawQuantity | null;
  readonly hash: RawHash;
  readonly transactionIndex: RawQuantity | null;
  readonly from: RawAddress;
  readonly to: RawAddress | null;
  readonly value: RawQuantity;
  readonly input: RawData;
  readonly nonce: RawQuantity;
  readonly gas: RawQuantity;
  readonly gasPrice: RawQuantity;
  readonly r: RawQuantity;
  readonly s: RawQuantity;
  readonly v: RawQuantity;
}

export interface RawBlock {
  readonly hash: RawHash | null;
  readonly number: RawQuantity | null;
  readonly nonce: RawData | null | undefined;
  readonly logsBloom: RawData | null;
  readonly parentHash: RawHash;
  readonly sha3Uncles: RawHash;
  readonly transactionsRoot: RawData;
  readonly stateRoot: RawData;
  readonly receiptsRoot: RawData;
  readonly miner: RawAddress;
  readonly difficulty: RawQuantity;
  readonly totalDifficulty: RawQuantity;
  readonly extraData: RawData;
  readonly size: RawQuantity;
  readonly gasLimit: RawQuantity;
  readonly gasUsed: RawQuantity;
  readonly timestamp: RawQuantity;
  readonly baseFeePerGas: RawQuantity;
  readonly mixHash: RawHash | undefined;
  readonly transactions: Array<RawTransaction | RawHash>;
  readonly uncles: Array<RawHash>;
}
export interface Transaction {
  readonly blockHash: bigint | null;
  readonly blockNumber: bigint | null;
  readonly hash: bigint;
  readonly index: bigint | null;
  readonly from: bigint;
  readonly to: bigint | null;
  readonly value: bigint;
  readonly data: Bytes;
  readonly nonce: bigint;
  readonly gas: bigint;
  readonly gasPrice: bigint;
  readonly r: bigint;
  readonly s: bigint;
  readonly v: bigint;
}
export function parseTransaction(raw: RawTransaction): Transaction {
  const blockHash = raw.blockHash !== null ? BigInt(raw.blockHash) : null;
  const blockNumber = raw.blockNumber !== null ? BigInt(raw.blockNumber) : null;
  const hash = BigInt(raw.hash);
  const index =
    raw.transactionIndex !== null ? BigInt(raw.transactionIndex) : null;
  const rawFrom = BigInt(raw.from);
  const to = raw.to !== null ? BigInt(raw.to) : null;
  const value = BigInt(raw.value);
  const data = Bytes.fromHexString(raw.input);
  const nonce = BigInt(raw.nonce);
  const gas = BigInt(raw.gas);
  const gasPrice = BigInt(raw.gasPrice);
  const r = BigInt(raw.r);
  const s = BigInt(raw.s);
  const v = BigInt(raw.v);
  return {
    blockHash: blockHash,
    blockNumber: blockNumber,
    hash: hash,
    index: index,
    from: rawFrom,
    to: to,
    value: value,
    data: data,
    nonce: nonce,
    gas: gas,
    gasPrice: gasPrice,
    r: r,
    s: s,
    v: v,
  };
}

export function parseBlock(raw: RawBlock): Block {
  const hash = raw.hash !== null ? BigInt(raw.hash) : null;
  const rawNumber =
    raw.number !== null && raw.number ? BigInt(raw.number) : null;
  const nonce =
    raw.nonce !== null && raw.nonce !== undefined ? BigInt(raw.nonce) : null;
  const logsBloom = raw.logsBloom !== null ? BigInt(raw.logsBloom) : null;
  const parentHash = BigInt(raw.parentHash);
  const sha3Uncles = BigInt(raw.sha3Uncles);
  const transactionsRoot = BigInt(raw.transactionsRoot);
  const stateRoot = BigInt(raw.stateRoot);
  const receiptsRoot = BigInt(raw.receiptsRoot);
  const miner = BigInt(raw.miner);
  const difficulty = BigInt(raw.difficulty);
  const totalDifficulty = BigInt(raw.totalDifficulty);
  const extraData = Bytes.fromHexString(raw.extraData);
  const size = BigInt(raw.size);
  const gasLimit = BigInt(raw.gasLimit);
  const gasUsed = BigInt(raw.gasUsed);
  const timestamp = BigInt(raw.timestamp);
  const baseFeePerGas = BigInt(raw.baseFeePerGas);
  const mixHash = raw.mixHash !== undefined ? BigInt(raw.mixHash) : null;
  const transactions = raw.transactions.map((x) =>
    typeof x === 'string' ? BigInt(x) : parseTransaction(x),
  );
  const uncles = raw.uncles.map((x) => BigInt(x));

  return {
    hash: hash,
    number: rawNumber,
    nonce: nonce,
    logsBloom: logsBloom,
    parentHash: parentHash,
    sha3Uncles: sha3Uncles,
    transactionsRoot: transactionsRoot,
    stateRoot: stateRoot,
    receiptsRoot: receiptsRoot,
    miner: miner,
    difficulty: difficulty,
    totalDifficulty: totalDifficulty,
    extraData: extraData,
    size: size,
    gasLimit: gasLimit,
    gasUsed: gasUsed,
    timestamp: timestamp,
    mixHash: mixHash,
    transactions: transactions,
    uncles: uncles,
    baseFeePerGas: baseFeePerGas,
  };
}
