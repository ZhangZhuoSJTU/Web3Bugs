import { Contract } from '@ethersproject/contracts';

export const call = async (
  contract: Contract,
  functionName: string,
  ...args: (string | undefined)[]
) => {
  return await contract.callStatic[functionName](...args);
};
