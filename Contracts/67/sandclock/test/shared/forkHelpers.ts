import assert from "assert";
import { ethers, network } from "hardhat";
import { BigNumber } from "ethers";
import type { Contract } from "ethers";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

assert(process.env.ALCHEMY_API_ENDPOINT);

export async function forkToMainnet(block?: number) {
  await network.provider.request({
    method: "hardhat_reset",
    params: [
      {
        forking: {
          jsonRpcUrl: process.env.ALCHEMY_API_ENDPOINT!,
          blockNumber: block,
        },
      },
    ],
  });
}

const { keccak256, defaultAbiCoder } = ethers.utils;

export function impersonate(accounts: string[]) {
  return Promise.all(
    accounts.map((a) =>
      network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [a],
      })
    )
  );
}

export async function unfork() {
  await network.provider.request({
    method: "hardhat_reset",
    params: [],
  });
}

export async function mintToken(
  token: Contract,
  account: SignerWithAddress | Contract,
  amount: BigNumber | number | string
) {
  const index = await bruteForceTokenBalanceSlotIndex(token.address);

  const slot = dirtyFix(
    keccak256(encodeSlot(["address", "uint"], [account.address, index]))
  );

  const prevAmount = await network.provider.send("eth_getStorageAt", [
    token.address,
    slot,
    "latest",
  ]);

  await network.provider.send("hardhat_setStorageAt", [
    token.address,
    slot,
    encodeSlot(["uint"], [dirtyFix(BigNumber.from(amount).add(prevAmount))]),
  ]);
}

export async function setTokenBalance(
  token: Contract,
  account: SignerWithAddress | Contract,
  newBalance: BigNumber | number | string
) {
  const index = await bruteForceTokenBalanceSlotIndex(token.address);

  const slot = dirtyFix(
    keccak256(encodeSlot(["address", "uint"], [account.address, index]))
  );

  await network.provider.send("hardhat_setStorageAt", [
    token.address,
    slot,
    encodeSlot(["uint"], [dirtyFix(BigNumber.from(newBalance))]),
  ]);
}

function encodeSlot(types: string[], values: any[]) {
  return defaultAbiCoder.encode(types, values);
}

// source:  https://blog.euler.finance/brute-force-storage-layout-discovery-in-erc20-contracts-with-hardhat-7ff9342143ed
async function bruteForceTokenBalanceSlotIndex(
  tokenAddress: string
): Promise<number> {
  const account = ethers.constants.AddressZero;

  const probeA = encodeSlot(["uint"], [1]);
  const probeB = encodeSlot(["uint"], [2]);

  const token = await ethers.getContractAt("ERC20", tokenAddress);

  for (let i = 0; i < 100; i++) {
    let probedSlot = keccak256(encodeSlot(["address", "uint"], [account, i])); // remove padding for JSON RPC
    while (probedSlot.startsWith("0x0"))
      probedSlot = "0x" + probedSlot.slice(3);
    const prev = await network.provider.send("eth_getStorageAt", [
      tokenAddress,
      probedSlot,
      "latest",
    ]);

    // make sure the probe will change the slot value
    const probe = prev === probeA ? probeB : probeA;

    await network.provider.send("hardhat_setStorageAt", [
      tokenAddress,
      probedSlot,
      probe,
    ]);

    const balance = await token.balanceOf(account); // reset to previous value
    await network.provider.send("hardhat_setStorageAt", [
      tokenAddress,
      probedSlot,
      prev,
    ]);

    if (balance.eq(ethers.BigNumber.from(probe))) return i;
  }
  throw "Balances slot not found!";
}

// WTF
// https://github.com/nomiclabs/hardhat/issues/1585
const dirtyFix = (s: string | BigNumber): string => {
  return s.toString().replace(/0x0+/, "0x");
};
