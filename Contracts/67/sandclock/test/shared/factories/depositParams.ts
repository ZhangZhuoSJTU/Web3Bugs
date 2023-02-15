import { BigNumberish } from "ethers";
import { Factory } from "fishery";
import { ethers } from "ethers";

import type { ClaimParams } from "./claimParams";
import { claimParams } from "./claimParams";

const { parseUnits } = ethers.utils;
const BN = ethers.BigNumber;

interface DepositParams {
  amount: BigNumberish;
  claims: ClaimParams[];
  lockedUntil: BigNumberish;
}

export const depositParams = Factory.define<DepositParams>(() => {
  return {
    amount: parseUnits("1"),
    claims: [claimParams.build()],
    lockedUntil: 0,
  };
});
