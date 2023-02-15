import { BigNumberish } from "ethers";

import { Factory } from "fishery";
import { ethers } from "ethers";

const BN = ethers.BigNumber;

export interface ClaimParams {
  pct: BigNumberish;
  beneficiary: string;
  data: any;
}

const percent = (n: number) => BN.from(n).mul(100);

export class ClaimParamsFactory extends Factory<ClaimParams> {
  percent(pct: number) {
    return this.params({
      pct: percent(pct || 100),
    });
  }

  to(addr: string) {
    return this.params({
      beneficiary: addr,
    });
  }
}

export const claimParams = ClaimParamsFactory.define(() => {
  const claim = {
    kind: "0",
    pct: "10000",
    beneficiary: "0x000000000000000000000000000000000000dEaD",
    data: 0,
  };

  return claim;
});
