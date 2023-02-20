// import { Allowlist } from "../../build/typechain/Allowlist"
// import AllowlistArtifact from "../../build/artifacts/contracts/Allowlist.sol/Allowlist.json"
import { BigNumber } from "@ethersproject/bignumber"
import { GenericERC20 } from "../../build/typechain/GenericERC20"
import GenericERC20Artifact from "../../build/artifacts/contracts/helper/GenericERC20.sol/GenericERC20.json"
import { MathUtils } from "../../build/typechain/MathUtils"
import MathUtilsArtifact from "../../build/artifacts/contracts/MathUtils.sol/MathUtils.json"
import { Swap } from "../../build/typechain/Swap"
import SwapArtifact from "../../build/artifacts/contracts/Swap.sol/Swap.json"
import { SwapUtils } from "../../build/typechain/SwapUtils"
import SwapUtilsArtifact from "../../build/artifacts/contracts/SwapUtils.sol/SwapUtils.json"
import { Wallet } from "ethers"
import { deployContract } from "ethereum-waffle"
import { asyncForEach, deployContractWithLibraries } from "../../test/testUtils"
import { ethers } from "hardhat"
// import merkleTreeData from "../../test/exampleMerkleTree.json"

// Test Values
const INITIAL_A_VALUE = 50
const INITIAL_A2_VALUE = 70
const SWAP_FEE = 1e7
const ADMIN_FEE = 0
const WITHDRAW_FEE = 5e7
const STABLECOIN_LP_TOKEN_NAME = "Stablecoin LP Token"
const STABLECOIN_LP_TOKEN_SYMBOL = "SLPT"
const BTC_LP_TOKEN_NAME = "BTC LP Token"
const BTC_LP_TOKEN_SYMBOL = "BLPT"

async function deploySwap(): Promise<void> {
  const signers = await ethers.getSigners()

  const owner = signers[0]
  const user1 = signers[1]
  const user2 = signers[2]

  const ownerAddress = await owner.getAddress()
  const user1Address = await user1.getAddress()
  const user2Address = await user2.getAddress()
  const addresses = [ownerAddress, user1Address, user2Address]

  // Deploy dummy tokens
  const daiToken = (await deployContract(
    (owner as unknown) as Wallet,
    GenericERC20Artifact,
    ["Dai", "DAI", "18"],
  )) as GenericERC20
  await daiToken.deployed()

  const usdcToken = (await deployContract(
    (owner as unknown) as Wallet,
    GenericERC20Artifact,
    ["USDC Coin", "USDC", "6"],
  )) as GenericERC20
  await usdcToken.deployed()

  const usdtToken = (await deployContract(
    (owner as unknown) as Wallet,
    GenericERC20Artifact,
    ["Tether", "USDT", "6"],
  )) as GenericERC20
  await usdtToken.deployed()

  const susdToken = (await deployContract(
    (owner as unknown) as Wallet,
    GenericERC20Artifact,
    ["sUSD", "SUSD", "18"],
  )) as GenericERC20
  await susdToken.deployed()

  const tbtcToken = (await deployContract(
    (owner as unknown) as Wallet,
    GenericERC20Artifact,
    ["tBTC", "TBTC", "18"],
  )) as GenericERC20
  await tbtcToken.deployed()

  const wbtcToken = (await deployContract(
    (owner as unknown) as Wallet,
    GenericERC20Artifact,
    ["Wrapped Bitcoin", "WBTC", "8"],
  )) as GenericERC20
  await wbtcToken.deployed()

  const renbtcToken = (await deployContract(
    (owner as unknown) as Wallet,
    GenericERC20Artifact,
    ["renBTC", "RENBTC", "8"],
  )) as GenericERC20
  await renbtcToken.deployed()

  const sbtcToken = (await deployContract(
    (owner as unknown) as Wallet,
    GenericERC20Artifact,
    ["sBTC", "SBTC", "18"],
  )) as GenericERC20
  await sbtcToken.deployed()

  const tokens = [
    daiToken,
    usdcToken,
    usdtToken,
    susdToken,
    tbtcToken,
    wbtcToken,
    renbtcToken,
    sbtcToken,
  ]

  console.table(
    await Promise.all(tokens.map(async (t) => [await t.symbol(), t.address])),
  )

  await asyncForEach(addresses, async (address) => {
    await asyncForEach(tokens, async (token) => {
      const decimals = await token.decimals()
      // Stringifying numbers over 1e20 breaks BigNumber, so get creative
      const amount = "1" + new Array(decimals + 5).fill(0).join("")
      await token.mint(address, amount)
    })
  })

  // Deploy Allowlist
/*  const allowlist = (await deployContract(
    (signers[0] as unknown) as Wallet,
    AllowlistArtifact,
    [merkleTreeData.merkleRoot],
  )) as Allowlist
  await allowlist.deployed()
*/

  // Deploy MathUtils
  const mathUtils = (await deployContract(
    (signers[0] as unknown) as Wallet,
    MathUtilsArtifact,
  )) as MathUtils
  await mathUtils.deployed()

  // Deploy SwapUtils with MathUtils library
  const swapUtils = (await deployContractWithLibraries(
    owner,
    SwapUtilsArtifact,
    {
      MathUtils: mathUtils.address,
    },
  )) as SwapUtils
  await swapUtils.deployed()

  // Deploy Swap with SwapUtils library
  const stablecoinSwap = (await deployContractWithLibraries(
    owner,
    SwapArtifact,
    { SwapUtils: swapUtils.address },
    [
      [
        daiToken.address,
        usdcToken.address,
        usdtToken.address,
        susdToken.address,
      ],
      [18, 6, 6, 18],
      STABLECOIN_LP_TOKEN_NAME,
      STABLECOIN_LP_TOKEN_SYMBOL,
      INITIAL_A_VALUE,
      INITIAL_A2_VALUE,
      SWAP_FEE,
      ADMIN_FEE,
      WITHDRAW_FEE/*,
      allowlist.address,*/
    ],
  )) as Swap
  await stablecoinSwap.deployed()

  const btcSwap = (await deployContractWithLibraries(
    owner,
    SwapArtifact,
    { SwapUtils: swapUtils.address },
    [
      [
        tbtcToken.address,
        wbtcToken.address,
        renbtcToken.address,
        sbtcToken.address,
      ],
      [18, 8, 8, 18],
      BTC_LP_TOKEN_NAME,
      BTC_LP_TOKEN_SYMBOL,
      INITIAL_A_VALUE,
      INITIAL_A2_VALUE,
      SWAP_FEE,
      ADMIN_FEE,
      WITHDRAW_FEE/*,
      allowlist.address,*/
    ],
  )) as Swap
  await btcSwap.deployed()

/*  // update dev limits for stableSwap
  await allowlist.setPoolCap(
    stablecoinSwap.address,
    BigNumber.from(10).pow(18).mul(1000),
  )
  await allowlist.setPoolAccountLimit(
    stablecoinSwap.address,
    BigNumber.from(10).pow(18).mul(1000),
  )

  // update dev limits for btcSwap
  await allowlist.setPoolCap(
    btcSwap.address,
    BigNumber.from(10).pow(18).mul(1000),
  )
  await allowlist.setPoolAccountLimit(
    btcSwap.address,
    BigNumber.from(10).pow(18).mul(1000),
  )
*/
  await stablecoinSwap.deployed()
  const stablecoinLpToken = (await stablecoinSwap.swapStorage()).lpToken
  await btcSwap.deployed()
  const btcLpToken = (await btcSwap.swapStorage()).lpToken

  console.log(`Stablecoin swap address: ${stablecoinSwap.address}`)
  console.log(`Stablecoin swap token address: ${stablecoinLpToken}`)
  console.log(`Tokenized BTC swap address: ${btcSwap.address}`)
  console.log(`Tokenized BTC swap token address: ${btcLpToken}`)
}

deploySwap().then(() => {
  console.log("Successfully deployed contracts locally...")
})
