import { Contract, BigNumber } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { getContractWithAbi, sendTx } from "./base";

export const approve = async (
  hre: HardhatRuntimeEnvironment,
  tokenNameOrAddressOrContract: string | Contract,
  nft: BigNumber,
  to: string
) => {
  const token = await getContractWithAbi(
    hre,
    tokenNameOrAddressOrContract,
    "erc721"
  );
  if ((await token.getApproved(nft)).toLowerCase() === to.toLowerCase()) {
    console.log(
      `Skipping approve nft \`${nft}\` at token \`${token.address}\` to \`${to}\``
    );
  } else {
    console.log(
      `Approving nft \`${nft}\` at token \`${token.address}\` to \`${to}\``
    );
    await sendTx(hre, await token.populateTransaction.approve(to, nft));
  }
};

export const safeTransferFrom = async (
  hre: HardhatRuntimeEnvironment,
  tokenNameOrAddressOrContract: string | Contract,
  nft: BigNumber,
  from: string,
  to: string,
  params?: string
) => {
  const token = await getContractWithAbi(
    hre,
    tokenNameOrAddressOrContract,
    "erc721"
  );
  await sendTx(
    hre,
    await token.populateTransaction[
      "safeTransferFrom(address,address,uint256,bytes)"
    ](from, to, nft, params || [])
  );
};
