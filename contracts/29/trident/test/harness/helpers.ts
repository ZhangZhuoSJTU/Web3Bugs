import { ethers } from "hardhat";
import { BigNumber, BigNumberish } from "ethers";

export const ZERO = BigNumber.from(0);
export const ONE = BigNumber.from(1);
export const TWO = BigNumber.from(2);
export const E18 = BigNumber.from(10).pow(18);
export const MAX_FEE = BigNumber.from(10000);

export const ADDRESS_ZERO = "0x0000000000000000000000000000000000000000";

export function encodedAddress(account) {
  return ethers.utils.defaultAbiCoder.encode(["address"], [account.address]);
}

// Defaults to e18 using amount * 10^18
export function getBigNumber(amount: BigNumberish, decimals = 18): BigNumber {
  return BigNumber.from(amount).mul(BigNumber.from(10).pow(decimals));
}

export function sqrt(x) {
  let z = x.add(ONE).div(TWO);
  let y = x;
  while (z.sub(y).isNegative()) {
    y = z;
    z = x.div(z).add(z).div(TWO);
  }
  return y;
}

export function randBetween(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}

export function encodedSwapData(tokenIn, to, unwrapBento) {
  return ethers.utils.defaultAbiCoder.encode(
    ["address", "address", "bool"],
    [tokenIn, to, unwrapBento]
  );
}

export function printHumanReadable(arr) {
  console.log(
    arr.map((x) => {
      let paddedX = x.toString().padStart(19, "0");
      paddedX =
        paddedX.substr(0, paddedX.length - 18) +
        "." +
        paddedX.substr(paddedX.length - 18) +
        " ";
      return paddedX;
    })
  );
}
