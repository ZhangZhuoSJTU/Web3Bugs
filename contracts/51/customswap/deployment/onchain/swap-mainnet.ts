// import { Allowlist } from "../../build/typechain/Allowlist"
// import AllowlistArtifact from "../../build/artifacts/contracts/Allowlist.sol/Allowlist.json"
import { BigNumber } from "@ethersproject/bignumber"
import { MathUtils } from "../../build/typechain/MathUtils"
import MathUtilsArtifact from "../../build/artifacts/contracts/MathUtils.sol/MathUtils.json"
import { Swap } from "../../build/typechain/Swap"
import SwapArtifact from "../../build/artifacts/contracts/Swap.sol/Swap.json"
import { SwapUtils } from "../../build/typechain/SwapUtils"
import SwapUtilsArtifact from "../../build/artifacts/contracts/SwapUtils.sol/SwapUtils.json"
import { deployContract } from "ethereum-waffle"
import { deployContractWithLibraries } from "../../test/testUtils"
import { ethers } from "hardhat"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address"

// Swap.sol constructor parameter values
const TOKEN_ADDRESSES = [
  "0x8daebade922df735c38c80c7ebd708af50815faa", // Mainnet tbtc
  "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599", // Mainnet wbtc
  "0xeb4c2781e4eba804ce9a9803c67d0893436bb27d", // Mainnet renBTC
  "0xfe18be6b3bd88a2d2a7f928d00292e7a9963cfc6", // Mainnet sBTC proxy
]
const INITIAL_A_VALUE = 200
const INITIAL_A2_VALUE = 250
const SWAP_FEE = 4e6 // 4bps
const ADMIN_FEE = 0
const WITHDRAW_FEE = 0
const BTC_LP_TOKEN_NAME = "Saddle tBTC/WBTC/renBTC/sBTC"
const BTC_LP_TOKEN_SYMBOL = "saddleTWRenSBTC"

// Multisig address to own the btc swap pool
// List of signers can be found here: https://docs.saddle.finance/faq#who-controls-saddles-admin-keys
// https://gnosis-safe.io/app/#/safes/0x3F8E527aF4e0c6e763e8f368AC679c44C45626aE/settings
const MULTISIG_ADDRESS = "0x3F8E527aF4e0c6e763e8f368AC679c44C45626aE"

// To run this script and deploy the contracts on the mainnet:
//    npx hardhat run deployment/onchain/swap-mainnet.ts --network mainnet
//
// To verify the source code on etherscan:
//    npx hardhat verify --network mainnet DEPLOYED_CONTRACT_ADDRESS [arg0, arg1, ...]

async function deploySwap(): Promise<void> {
  const [deployer]: SignerWithAddress[] = await ethers.getSigners()
  console.log(`Deploying with ${deployer.address}`)

  // Deploy Allowlist
  // Estimated deployment cost = 0.00081804 * gwei
/*  const allowlist = (await deployContract(
    deployer,
    AllowlistArtifact,
    // ["0xca0f8c7ee1addcc5fce6a7c989ba3f210db065c36c276b71b8c8253a339318a3"], // test merkle root https://github.com/saddle-finance/saddle-test-addresses
    ["0xc799ec3a26ef7b4c295f6f02d1e6f65c35cef24447ff343076060bfc0eafb24e"], // production merkle root
  )) as Allowlist
  await allowlist.deployed()
  console.log(`Allowlist address: ${allowlist.address}`)
*/
  // Deploy MathUtils
  const mathUtils = (await deployContract(
    deployer,
    MathUtilsArtifact,
  )) as MathUtils
  await mathUtils.deployed()
  console.log(`mathUtils address: ${mathUtils.address}`)

  // Deploy SwapUtils with MathUtils library
  const swapUtils = (await deployContractWithLibraries(
    deployer,
    SwapUtilsArtifact,
    {
      MathUtils: mathUtils.address,
    },
  )) as SwapUtils
  await swapUtils.deployed()
  console.log(`swapUtils address: ${swapUtils.address}`)

  // Deploy Swap with SwapUtils library
  const swapConstructorArgs = [
    TOKEN_ADDRESSES,
    [18, 8, 8, 18],
    BTC_LP_TOKEN_NAME,
    BTC_LP_TOKEN_SYMBOL,
    INITIAL_A_VALUE,
    INITIAL_A2_VALUE,
    SWAP_FEE,
    ADMIN_FEE,
    WITHDRAW_FEE/*,
    allowlist.address,*/
  ]

  console.log(swapConstructorArgs)

  // Deploy BTC swap
  // Estimated deployment cost = 0.004333332 * gwei
  const btcSwap = (await deployContractWithLibraries(
    deployer,
    SwapArtifact,
    { SwapUtils: swapUtils.address },
    swapConstructorArgs,
  )) as Swap
  await btcSwap.deployed()

  // Set limits for deposits
  // Total supply limit = 150 BTC
/*  await allowlist.setPoolCap(
    btcSwap.address,
    BigNumber.from(10).pow(18).mul(150),
  )
*/  
  // Individual deposit limit = 1 BTC
/*  await allowlist.setPoolAccountLimit(
    btcSwap.address,
    BigNumber.from(10).pow(18),
  )
*/
  await btcSwap.deployed()
  const btcLpToken = (await btcSwap.swapStorage()).lpToken

  console.log(`Tokenized BTC swap address: ${btcSwap.address}`)
  console.log(`Tokenized BTC swap token address: ${btcLpToken}`)

  // Transfer the ownership of the btc swap and the allowlist to the multisig
  await btcSwap.transferOwnership(MULTISIG_ADDRESS)
  // await allowlist.transferOwnership(MULTISIG_ADDRESS)
  console.log(
    // `Transferred the ownership of the BTC swap contract and the allowlist to multisig: ${MULTISIG_ADDRESS}`,
    `Transferred the ownership of the BTC swap contract to multisig: ${MULTISIG_ADDRESS}`,
  )
}

deploySwap().then(() => {
  console.log("Successfully deployed contracts to on-chain network...")
})
