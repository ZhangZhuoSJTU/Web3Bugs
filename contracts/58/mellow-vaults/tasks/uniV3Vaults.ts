import { task, types } from "hardhat/config";
import { Contract, BigNumber } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import {
  getContractWithAbi,
  int24ToBytes32,
  sendTx,
  uintToBytes32,
} from "./base";
import { approve } from "./erc20";
import { map, prop, propEq, sortBy } from "ramda";
import { CREATE_CELL_EVENT_HASH } from "./contants";

task("create-uni-v3-cell", "Mints nft for UniV3Vaults")
  .addParam("token0", "The name of the token0", undefined, types.string)
  .addParam("token1", "The name of the token1", undefined, types.string)
  .addParam("fee", "The name of the token1", 3000, types.int)
  .addParam("lowerTick", "Initial lower tick", undefined, types.string)
  .addParam("upperTick", "Initial upper tick", undefined, types.string)
  .addParam(
    "amount0",
    "Initial token0 amount for UniV3",
    undefined,
    types.string
  )
  .addParam(
    "amount1",
    "Initial token1 amount for UniV3",
    undefined,
    types.string
  )
  .addParam(
    "deadline",
    "The time in secs after which transaction is invalid if not executed",
    300,
    types.int
  )
  .setAction(
    async (
      { token0, token1, fee, lowerTick, upperTick, amount0, amount1, deadline },
      hre
    ) => {
      await createUniV3Vault(
        hre,
        token0,
        token1,
        fee,
        parseInt(lowerTick),
        parseInt(upperTick),
        BigNumber.from(amount0),
        BigNumber.from(amount1),
        BigNumber.from(0),
        BigNumber.from(0),
        deadline
      );
    }
  );

export const createUniV3Vault = async (
  hre: HardhatRuntimeEnvironment,
  token0: string | Contract,
  token1: string | Contract,
  fee: number,
  lowerTick: number,
  upperTick: number,
  amount0: BigNumber,
  amount1: BigNumber,
  amount0Min: BigNumber,
  amount1Min: BigNumber,
  deadline: number
): Promise<BigNumber> => {
  const feeBytes = int24ToBytes32(BigNumber.from(fee));
  const lowerTickBytes = int24ToBytes32(BigNumber.from(lowerTick));
  const upperTickBytes = int24ToBytes32(BigNumber.from(upperTick));
  const token0AmountBytes = uintToBytes32(amount0);
  const token1AmountBytes = uintToBytes32(amount1);
  const amount0MinBytes = uintToBytes32(amount0Min);
  const amount1MinBytes = uintToBytes32(amount1Min);
  const deadlineBytes = uintToBytes32(
    BigNumber.from(Math.floor(new Date().getTime() / 1000) + deadline)
  );
  const t0 = await getContractWithAbi(hre, token0, "erc20");
  const t1 = await getContractWithAbi(hre, token1, "erc20");
  const tokens = sortBy(prop("address"), [t0, t1]);
  const params = `0x${feeBytes}${lowerTickBytes}${upperTickBytes}${token0AmountBytes}${token1AmountBytes}${amount0MinBytes}${amount1MinBytes}${deadlineBytes}`;
  const uniV3Vaults = await hre.ethers.getContract("UniV3Vaults");
  await approve(hre, t0, uniV3Vaults.address, amount0);
  await approve(hre, t1, uniV3Vaults.address, amount1);
  console.log(
    `Calling UniV3Vaults#createVault with args ${[
      map(prop("address"), tokens),
      params,
    ]}`
  );
  const receipt = await sendTx(
    hre,
    await uniV3Vaults.populateTransaction.createVault(
      map(prop("address"), tokens),
      params
    )
  );
  for (const log of receipt.logs) {
    if (log.topics[0] === CREATE_CELL_EVENT_HASH) {
      const nft = BigNumber.from(log.topics[2]);
      console.log(`Minted cell nft: ${nft.toString()}`);
      return nft;
    }
  }
  console.log(receipt.logs);

  throw `Could not find nft number in tx logs`;
};
