import { GenericERC20 } from "../../build/typechain/GenericERC20"
import GenericERC20Artifact from "../../build/artifacts/contracts/helper/GenericERC20.sol/GenericERC20.json"
import { Swap } from "../../build/typechain/Swap"
import SwapArtifact from "../../build/artifacts/contracts/Swap.sol/Swap.json"
import { LPToken } from "../../build/typechain/LPToken"
import LPTokenArtifact from "../../build/artifacts/contracts/LPToken.sol/LPToken.json"
import { ethers, network } from "hardhat"
import dotenv from "dotenv"

// Mainnet Addresses
const SADDLE_BTC_POOL = "0x4f6A43Ad7cba042606dECaCA730d4CE0A57ac62e"
const SADDLE_BTC_LP_TOKEN = "0xC28DF698475dEC994BE00C9C9D8658A548e6304F"

const TBTC = "0x8dAEBADE922dF735c38C80C7eBD708Af50815fAa"
const WBTC = "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599"
const RENBTC = "0xeb4c2781e4eba804ce9a9803c67d0893436bb27d"
const SBTC = "0xfe18be6b3bd88a2d2a7f928d00292e7a9963cfc6"

// forking Mainnet at this block
const BLOCK_NUMBER = 11772093

dotenv.config()

async function forkMainnet(): Promise<void> {
  await network.provider.request({
    method: "hardhat_reset",
    params: [
      {
        forking: {
          jsonRpcUrl: process.env.ALCHEMY_API,
          blockNumber: BLOCK_NUMBER,
        },
      },
    ],
  })

  const tbtcToken = (await ethers.getContractAt(
    GenericERC20Artifact.abi,
    TBTC,
  )) as GenericERC20

  const wbtcToken = (await ethers.getContractAt(
    GenericERC20Artifact.abi,
    WBTC,
  )) as GenericERC20

  const renbtcToken = (await ethers.getContractAt(
    GenericERC20Artifact.abi,
    RENBTC,
  )) as GenericERC20

  const sbtcToken = (await ethers.getContractAt(
    GenericERC20Artifact.abi,
    SBTC,
  )) as GenericERC20

  const btcTokens = [tbtcToken, wbtcToken, renbtcToken, sbtcToken]

  console.table(
    await Promise.all(
      btcTokens.map(async (t) => [await t.symbol(), t.address]),
    ),
  )

  const btcSwap = (await ethers.getContractAt(
    SwapArtifact.abi,
    SADDLE_BTC_POOL,
  )) as Swap

  const btcLpToken = (await ethers.getContractAt(
    LPTokenArtifact.abi,
    SADDLE_BTC_LP_TOKEN,
  )) as LPToken

  console.log(`Tokenized BTC swap address: ${btcSwap.address}`)
  console.log(`Tokenized BTC swap token address: ${btcLpToken.address}`)
}

forkMainnet().then(() => {
  console.log(
    `Successfully forked mainnet @ block ${BLOCK_NUMBER} to local hardhat network...`,
  )
})
