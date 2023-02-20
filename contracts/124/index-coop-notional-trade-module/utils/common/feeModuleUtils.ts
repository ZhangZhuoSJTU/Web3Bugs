import { BigNumber } from "ethers";

import { preciseMul, preciseMulCeilInt } from "./mathUtils";
import { ONE_YEAR_IN_SECONDS, PRECISE_UNIT } from "../constants";
import { Address } from "../types";
import { StreamingFeeModule } from "../contracts";

export const getStreamingFee = async(
  feeModule: StreamingFeeModule,
  setToken: Address,
  previousAccrueTimestamp: BigNumber,
  recentAccrueTimestamp: BigNumber,
  streamingFee?: BigNumber
): Promise<BigNumber> => {
  const feeState = await feeModule.feeStates(setToken);
  const accrualRate = streamingFee ? streamingFee : feeState.streamingFeePercentage;

  const timeElapsed = recentAccrueTimestamp.sub(previousAccrueTimestamp);
  return timeElapsed.mul(accrualRate).div(ONE_YEAR_IN_SECONDS);
};

export const getStreamingFeeInflationAmount = (
  inflationPercent: BigNumber,
  totalSupply: BigNumber
): BigNumber => {
  const a = inflationPercent.mul(totalSupply);
  const b = PRECISE_UNIT.sub(inflationPercent);

  return a.div(b);
};

export const getPostFeePositionUnits = (
  preFeeUnits: BigNumber[],
  inflationPercent: BigNumber
): BigNumber[] => {
  const newUnits: BigNumber[] = [];
  for (let i = 0; i < preFeeUnits.length; i++) {
    if (preFeeUnits[i].gte(0)) {
      newUnits.push(preciseMul(preFeeUnits[i], PRECISE_UNIT.sub(inflationPercent)));
    } else {
      newUnits.push(preciseMulCeilInt(preFeeUnits[i], PRECISE_UNIT.sub(inflationPercent)));
    }
  }
  return newUnits;
};
