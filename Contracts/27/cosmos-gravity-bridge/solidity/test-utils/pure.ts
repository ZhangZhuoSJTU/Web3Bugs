import { ethers } from "hardhat";
import { BigNumberish } from "ethers";
import { Signer } from "ethers";
import {ContractTransaction, utils} from 'ethers';

export const ZeroAddress: string = "0x0000000000000000000000000000000000000000"

export async function getSignerAddresses(signers: Signer[]) {
  return await Promise.all(signers.map(signer => signer.getAddress()));
}

export function makeCheckpoint(
  validators: string[],
  powers: BigNumberish[],
  valsetNonce: BigNumberish,
  rewardAmount: BigNumberish,
  rewardToken: string,
  gravityId: string
) {
  const methodName = ethers.utils.formatBytes32String("checkpoint");

  let abiEncoded = ethers.utils.defaultAbiCoder.encode(
    ["bytes32", "bytes32", "uint256", "address[]", "uint256[]", "uint256", "address"],
    [gravityId, methodName, valsetNonce, validators, powers, rewardAmount, rewardToken]
  );

  let checkpoint = ethers.utils.keccak256(abiEncoded);

  return checkpoint;
}

export async function signHash(signers: Signer[], hash: string) {
  let v: number[] = [];
  let r: string[] = [];
  let s: string[] = [];

  for (let i = 0; i < signers.length; i = i + 1) {
    const sig = await signers[i].signMessage(ethers.utils.arrayify(hash));
    const address = await signers[i].getAddress();

    const splitSig = ethers.utils.splitSignature(sig);
    v.push(splitSig.v!);
    r.push(splitSig.r);
    s.push(splitSig.s);
  }

  return { v, r, s };
}

export function makeTxBatchHash(
  amounts: number[],
  destinations: string[],
  fees: number[],
  nonces: number[],
  gravityId: string
) {
  const methodName = ethers.utils.formatBytes32String("transactionBatch");

  let abiEncoded = ethers.utils.defaultAbiCoder.encode(
    ["bytes32", "bytes32", "uint256[]", "address[]", "uint256[]", "uint256[]"],
    [gravityId, methodName, amounts, destinations, fees, nonces]
  );

  // console.log(abiEncoded);

  let txHash = ethers.utils.keccak256(abiEncoded);

  return txHash;
}

export async function parseEvent(contract: any, txPromise: Promise<ContractTransaction>, eventOrder: number) {
  const tx = await txPromise
  const receipt = await contract.provider.getTransactionReceipt(tx.hash!)
  let args = (contract.interface as utils.Interface).parseLog(receipt.logs![eventOrder]).args

  // Get rid of weird quasi-array keys
  const acc: any = {}
  args = Object.keys(args).reduce((acc, key) => {
    if (Number.isNaN(parseInt(key, 10)) && key !== 'length') {
      acc[key] = args[key]
    }
    return acc
  }, acc)

  return args
}

export function examplePowers(): number[] {
  return [
    707,
    621,
    608,
    439,
    412,
    407,
    319,
    312,
    311,
    303,
    246,
    241,
    224,
    213,
    194,
    175,
    173,
    170,
    154,
    149,
    139,
    123,
    119,
    113,
    110,
    107,
    105,
    104,
    92,
    90,
    88,
    88,
    88,
    85,
    85,
    84,
    82,
    70,
    67,
    64,
    59,
    58,
    56,
    55,
    52,
    52,
    52,
    50,
    49,
    44,
    42,
    40,
    39,
    38,
    37,
    37,
    36,
    35,
    34,
    33,
    33,
    33,
    32,
    31,
    30,
    30,
    29,
    28,
    27,
    26,
    25,
    24,
    23,
    23,
    22,
    22,
    22,
    21,
    21,
    20,
    19,
    18,
    17,
    16,
    14,
    14,
    13,
    13,
    11,
    10,
    10,
    10,
    10,
    10,
    9,
    8,
    8,
    7,
    7,
    7,
    6,
    6,
    5,
    5,
    5,
    5,
    5,
    5,
    4,
    4,
    3,
    2,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    1
  ];
}
