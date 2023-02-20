import { Contract, BigNumber } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { getContractWithAbi, sendTx } from "./base";

export const approve = async (
  hre: HardhatRuntimeEnvironment,
  tokenNameOrAddressOrContract: string | Contract,
  to: string,
  value: BigNumber
) => {
  const { deployer } = await hre.getNamedAccounts();
  const token = await getContractWithAbi(
    hre,
    tokenNameOrAddressOrContract,
    "erc20"
  );
  if ((await token.allowance(deployer, to)).lt(value)) {
    console.log(
      `Approving token \`${
        token.address
      }\` to \`${to}\` with value \`${value.toString()}\``
    );
    await sendTx(hre, await token.populateTransaction.approve(to, value));
  } else {
    console.log(
      `Skipping approve token \`${
        token.address
      }\` to \`${to}\` with value \`${value.toString()}\``
    );
  }
};

export const transfer = async (
  hre: HardhatRuntimeEnvironment,
  tokenNameOrAddressOrContract: string | Contract,
  to: string,
  value: BigNumber
) => {
  const token = await getContractWithAbi(
    hre,
    tokenNameOrAddressOrContract,
    "erc20"
  );
  await sendTx(hre, await token.populateTransaction.transfer(to, value));
};

export const transferFrom = async (
  hre: HardhatRuntimeEnvironment,
  tokenNameOrAddressOrContract: string | Contract,
  from: string,
  to: string,
  value: BigNumber
) => {
  const token = await getContractWithAbi(
    hre,
    tokenNameOrAddressOrContract,
    "erc20"
  );
  await sendTx(
    hre,
    await token.populateTransaction.transferFrom(from, to, value)
  );
};
