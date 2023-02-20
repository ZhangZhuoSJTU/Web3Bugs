import { BigNumber } from "@ethersproject/bignumber";
import { task, types } from "hardhat/config";
import { Contract } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { createUniV3Vault } from "./uniV3Vaults";
import { createVault, deposit, withdraw } from "./vaults";
import { safeTransferFrom, approve as approve721 } from "./erc721";
import { approve } from "./erc20";
import { resolveAddress, uintToBytes32 } from "./base";

task("create-vault-1", "Mints nft for vault-1 strategy")
  .addParam("token0", "The name of the token0", undefined, types.string)
  .addParam("token1", "The name of the token1", undefined, types.string)
  .addParam("fee", "The name of the token1", 3000, types.int)
  .addParam("lowerTick", "Initial lower tick", undefined, types.string)
  .addParam("upperTick", "Initial upper tick", undefined, types.string)
  .addParam("amount0", "Initial token0 amount for UniV3", "10000", types.string)
  .addParam("amount1", "Initial token1 amount for UniV3", "10000", types.string)
  .addParam(
    "strategist",
    "Address of vault strategist",
    undefined,
    types.string
  )
  .setAction(
    async (
      {
        token0,
        token1,
        fee,
        lowerTick,
        upperTick,
        amount0,
        amount1,
        strategist,
      },
      hre
    ) => {
      await createVault1(
        hre,
        token0,
        token1,
        fee,
        parseInt(lowerTick),
        parseInt(upperTick),
        BigNumber.from(amount0),
        BigNumber.from(amount1),
        strategist
      );
    }
  );

export const createVault1 = async (
  hre: HardhatRuntimeEnvironment,
  token0: string | Contract,
  token1: string | Contract,
  fee: number,
  lowerTick: number,
  upperTick: number,
  amount0: BigNumber,
  amount1: BigNumber,
  strategist: string
) => {
  // const aaveAddress = await resolveAddress(hre, "AaveVaults");
  // const tokenAddress = await resolveAddress(hre, "TokenVaults");
  // const nodeAddress = await resolveAddress(hre, "NodeVaults");
  // const uniAddress = await resolveAddress(hre, "UniV3Vaults");

  // await approve(hre, token0, uniAddress, amount0);
  // await approve(hre, token1, uniAddress, amount1);
  // await approve(hre, token0, nodeAddress, amount0);
  // await approve(hre, token1, nodeAddress, amount1);
  const uniNft = await createUniV3Vault(
    hre,
    token0,
    token1,
    fee,
    lowerTick,
    upperTick,
    amount0,
    amount1,
    BigNumber.from(0),
    BigNumber.from(0),
    1800
  );
  const aaveNft = await createVault(hre, "AaveVaults", [token0, token1]);
  const tokenNft = await createVault(hre, "TokenVaults", [token0, token1]);
  const nodeNft = await createVault(hre, "NodeVaults", [token0, token1]);
  // await deposit(
  //   hre,
  //   "AaveVaults",
  //   aaveNft,
  //   [token0, token1],
  //   [amount0, amount1]
  // );
  // await deposit(
  //   hre,
  //   "TokenVaults",
  //   tokenNft,
  //   [token0, token1],
  //   [amount0, amount1]
  // );

  await moveNftToNodeVaults(hre, "UniV3Vaults", uniNft, strategist, nodeNft);
  await moveNftToNodeVaults(hre, "AaveVaults", aaveNft, strategist, nodeNft);
  await moveNftToNodeVaults(hre, "TokenVaults", tokenNft, strategist, nodeNft);
  // await deposit(
  //   hre,
  //   "NodeVaults",
  //   nodeNft,
  //   [token0, token1],
  //   [amount0, amount1]
  // );
  // await withdraw(
  //   hre,
  //   "NodeVaults",
  //   nodeNft,
  //   (
  //     await hre.getNamedAccounts()
  //   ).deployer,
  //   [token0, token1],
  //   [amount0, amount1]
  // );
};

export const moveNftToNodeVaults = async (
  hre: HardhatRuntimeEnvironment,
  tokenNameOrAddressOrContract: string | Contract,
  nft: BigNumber,
  to: string,
  toVault: BigNumber
) => {
  console.log(
    `Moving nft \`${nft.toString()}\` in contract \`${tokenNameOrAddressOrContract}\` to NodeVaults`
  );
  const { deployer } = await hre.getNamedAccounts();
  const nodeVaultsAddress = await resolveAddress(hre, "NodeVaults");
  await safeTransferFrom(
    hre,
    tokenNameOrAddressOrContract,
    nft,
    deployer,
    nodeVaultsAddress,
    `0x${uintToBytes32(toVault)}`
  );
};
