import { ContractTransaction } from "ethers";
import { ONE_DAY, ONE_HOUR } from "./constants";
import { getBlockTime } from "./time";

export async function getFethExpectedExpiration(tx: ContractTransaction): Promise<number> {
  const receipt = await tx.wait();
  const timestamp = await getBlockTime(receipt.blockNumber);
  return getFethExpirationFromSeconds(timestamp);
}

export function getFethExpirationFromSeconds(timestampInSeconds: number): number {
  return Math.ceil(timestampInSeconds / ONE_HOUR) * ONE_HOUR + ONE_DAY;
}
