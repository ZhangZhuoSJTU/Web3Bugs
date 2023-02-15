import { providers } from "ethers";

export const increaseTime = async (provider: providers.JsonRpcProvider, time: number) => {
  await provider.send("evm_increaseTime", [time]);
  await provider.send("evm_mine", []);
};

export const setTime = async (provider: providers.JsonRpcProvider, time: number) => {
  await provider.send("evm_setNextBlockTimestamp", [time]);
  await provider.send("evm_mine", []);
};
