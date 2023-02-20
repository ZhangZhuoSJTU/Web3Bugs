// import { Allowlist } from "../../build/typechain/Allowlist"
// import AllowlistArtifact from "../../build/artifacts/contracts/Allowlist.sol/Allowlist.json"
import { BigNumber } from "@ethersproject/bignumber"
// import { BigNumber} from "ethers"

import { GenericERC20 } from "../../build/typechain/GenericERC20"
import GenericERC20Artifact from "../../build/artifacts/contracts/helper/GenericERC20.sol/GenericERC20.json"
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

const INITIAL_A_VALUE = 200
const INITIAL_A2_VALUE = 250
const SWAP_FEE = 4e6 // 4bps
const ADMIN_FEE = 0
const WITHDRAW_FEE = 0
const FRAX_LP_TOKEN_NAME = "Boot FRAX/FXS"
const FRAX_LP_TOKEN_SYMBOL = "BootFRAXFXS"

// Multisig address to own the btc swap pool
// List of signers can be found here: https://docs.saddle.finance/faq#who-controls-saddles-admin-keys
// https://gnosis-safe.io/app/#/safes/0x186B2E003Aa42C9Df56BBB643Bb9550D1a45a360/settings
const MULTISIG_ADDRESS = "0x186B2E003Aa42C9Df56BBB643Bb9550D1a45a360"

// To run this script and deploy the contracts on the mainnet:
//    npx hardhat run deployment/onchain/swap-mainnet.ts --network mainnet
//
// To verify the source code on etherscan:
//    npx hardhat verify --network mainnet DEPLOYED_CONTRACT_ADDRESS [arg0, arg1, ...]

async function deploySwap(): Promise<void> {
  const [deployer]: SignerWithAddress[] = await ethers.getSigners()
  console.log(`Deploying with ${deployer.address}`)

  // Deploy FRAX token
  const fraxToken = (await deployContract(
    deployer,
    GenericERC20Artifact,
    ["Frax", "FRAX", "18"],
  )) as GenericERC20
  await fraxToken.deployed()
  console.log(`FRAX token address: ${fraxToken.address}`)

  // Deploy FRX token
  const fxsToken = (await deployContract(
    deployer,
    GenericERC20Artifact,
    ["Frax Share", "FXS", "18"],
  )) as GenericERC20
  await fxsToken.deployed()
  console.log(`FXS token address: ${fxsToken.address}`)

  // Mint 100 M = 1e26 FRAX tokens
  // await fraxToken.mint(deployer.address, String(BigNumber.from(String(1e26))))
  await fraxToken.mint(deployer.address, BigNumber.from("100000000000000000000000000"))

  // Mint 100 M = 1e26 FXS tokens
  // await fxsToken.mint(deployer.address, String(BigNumber.from(String(1e26))))
  await fxsToken.mint(deployer.address, BigNumber.from("100000000000000000000000000"))

  // for minting to multiple addresses
  // await asyncForEach([deployer, user1, user2], async (signer) => {
  //   const address = await signer.getAddress()
  //   await fraxToken.mint(address, String(1e26))
  //   await fxsToken.mint(address, String(1e26))
  // })


  // Swap.sol constructor parameter values
  const TOKEN_ADDRESSES = [
    fraxToken.address, // Rinkeby FRAX
    fxsToken.address,  // Rinkeby FXS
  ]

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
    [18, 18],
    FRAX_LP_TOKEN_NAME,
    FRAX_LP_TOKEN_SYMBOL,
    INITIAL_A_VALUE,
    INITIAL_A2_VALUE,
    SWAP_FEE,
    ADMIN_FEE,
    WITHDRAW_FEE/*,
    allowlist.address,*/
  ]

  console.log(swapConstructorArgs)

  // Deploy FRAX/FXS swap
  // Estimated deployment cost = 0.004333332 * gwei
  const fraxSwap = (await deployContractWithLibraries(
    deployer,
    SwapArtifact,
    { SwapUtils: swapUtils.address },
    swapConstructorArgs,
  )) as Swap
  await fraxSwap.deployed()

  // Set limits for deposits
  // Total supply limit = 150 FRAX
/*  await allowlist.setPoolCap(
    fraxSwap.address,
    BigNumber.from(10).pow(18).mul(150),
  )
*/  
  // Individual deposit limit = 1 FRAX
/*  await allowlist.setPoolAccountLimit(
    fraxSwap.address,
    BigNumber.from(10).pow(18),
  )
*/
  // await fraxSwap.deployed()
  const fraxLpToken = (await fraxSwap.swapStorage()).lpToken

  console.log(`Tokenized FRAX/FXS swap address: ${fraxSwap.address}`)
  console.log(`Tokenized FRAX/FXS swap token address: ${fraxLpToken}`)

  // Transfer the ownership of the frax/fxs swap and the allowlist to the multisig
  await fraxSwap.transferOwnership(MULTISIG_ADDRESS)
  // await allowlist.transferOwnership(MULTISIG_ADDRESS)
  console.log(
    // `Transferred the ownership of the FRAX swap contract and the allowlist to multisig: ${MULTISIG_ADDRESS}`,
    `Transferred the ownership of the FRAX/FXS swap contract to multisig: ${MULTISIG_ADDRESS}`,
  )
}

deploySwap().then(() => {
  console.log("Successfully deployed contracts to rinkeby network...")
})
