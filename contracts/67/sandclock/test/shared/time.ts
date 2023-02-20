import { BigNumber } from "ethers";
import { time } from "@openzeppelin/test-helpers";

export const getLastBlockTimestamp = async (): Promise<BigNumber> => {
  return BigNumber.from((await time.latest()).toString());
};

export const increaseTime = time.increase;

export const moveForwardTwoWeeks = () => time.increase(time.duration.weeks(2));
