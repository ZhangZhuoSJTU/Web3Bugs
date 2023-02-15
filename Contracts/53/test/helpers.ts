import { ethers } from "hardhat";
import { BigNumber } from "ethers";
const w3utils = require("web3-utils");

export const appendDecimals = (amount: number) => ethers.utils.parseEther(amount.toString());

export const getETHSpentOnGas = async (tx: any) => {
    const receipt = await tx.wait();
    return receipt.gasUsed.mul(tx.gasPrice);
};

export const displayHoldings = (holdings: any[]) => {
    console.log("Holdings: ");
    holdings.forEach(holding => console.log(holding.token + " " + ethers.utils.formatEther(holding.amount)));
};

export const getTokenName = (address: string, tokens: Record<string, string>) =>
    Object.entries(tokens).find(([_, value]) => value === address)?.[0] || "???";

export const BIG_NUMBER_ZERO = BigNumber.from(0);
export const UINT256_MAX = BigNumber.from(2).pow(256).sub(1);

export const toBytes32 = (key: string) => w3utils.rightPad(w3utils.asciiToHex(key), 64);
export const fromBytes32 = (key: string) => w3utils.hexToAscii(key);

export function getExpectedFees(amount: BigNumber) {
    return amount.div(100);
}
