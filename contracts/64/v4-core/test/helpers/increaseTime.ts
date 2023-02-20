import { providers } from 'ethers';

export async function advanceBlock(provider: providers.JsonRpcProvider) {
  return provider.send("evm_mine", []);
}

export const increaseTime = async (provider: providers.JsonRpcProvider, time: number, advance: Boolean = true) => {
  await provider.send('evm_increaseTime', [time]);
  if (advance) await advanceBlock(provider);
};


export async function setTime(provider: providers.JsonRpcProvider, time: number, advance: Boolean = true) {
  await provider.send("evm_setNextBlockTimestamp", [time]);
  if (advance) await advanceBlock(provider);
}