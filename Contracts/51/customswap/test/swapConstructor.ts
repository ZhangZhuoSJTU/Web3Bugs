import { Signer, Wallet } from "ethers"
import { ZERO_ADDRESS, deployContractWithLibraries } from "./testUtils"
import { deployContract, solidity } from "ethereum-waffle"

import GenericERC20Artifact from "../build/artifacts/contracts/helper/GenericERC20.sol/GenericERC20.json"
import { GenericERC20 } from "../build/typechain/GenericERC20"
import { MathUtils } from "../build/typechain/MathUtils"
import MathUtilsArtifact from "../build/artifacts/contracts/MathUtils.sol/MathUtils.json"
import SwapArtifact from "../build/artifacts/contracts/Swap.sol/Swap.json"
import { SwapUtils } from "../build/typechain/SwapUtils"
import SwapUtilsArtifact from "../build/artifacts/contracts/SwapUtils.sol/SwapUtils.json"
import chai from "chai"
import { ethers } from "hardhat"
import merkleTreeData from "../test/exampleMerkleTree.json"

chai.use(solidity)
const { expect } = chai

describe("Swap", () => {
  let signers: Array<Signer>
  let mathUtils: MathUtils
  let swapUtils: SwapUtils
  let firstToken: GenericERC20
  let secondToken: GenericERC20
  let owner: Signer

  // Test Values
  const INITIAL_A_VALUE = 50
  const INITIAL_A2_VALUE = 70
  const SWAP_FEE = 1e7
  const LP_TOKEN_NAME = "Test LP Token Name"
  const LP_TOKEN_SYMBOL = "TESTLP"

  beforeEach(async () => {
    signers = await ethers.getSigners()
    owner = signers[0]

    // Deploy dummy tokens
    firstToken = (await deployContract(owner as Wallet, GenericERC20Artifact, [
      "First Token",
      "FIRST",
      "18",
    ])) as GenericERC20

    secondToken = (await deployContract(owner as Wallet, GenericERC20Artifact, [
      "Second Token",
      "SECOND",
      "18",
    ])) as GenericERC20


    // Deploy MathUtils
    mathUtils = (await deployContract(
      signers[0] as Wallet,
      MathUtilsArtifact,
    )) as MathUtils

    // Deploy SwapUtils with MathUtils library
    swapUtils = (await deployContractWithLibraries(owner, SwapUtilsArtifact, {
      MathUtils: mathUtils.address,
    })) as SwapUtils
    await swapUtils.deployed()
  })

  describe("swapStorage#constructor", () => {
    it("Reverts with '_pooledTokens.length <= 1'", async () => {
      await expect(
        deployContractWithLibraries(
          owner,
          SwapArtifact,
          { SwapUtils: swapUtils.address },
          [
            [],
            [18, 18],
            LP_TOKEN_NAME,
            LP_TOKEN_SYMBOL,
            INITIAL_A_VALUE,
            INITIAL_A2_VALUE,
            SWAP_FEE,
            0,
            0,
          ],
        ),
      ).to.be.revertedWith("_pooledTokens.length <= 1")
    })

    it("Reverts with '_pooledTokens.length > 32'", async () => {
      await expect(
        deployContractWithLibraries(
          owner,
          SwapArtifact,
          { SwapUtils: swapUtils.address },
          [
            Array(33).fill(firstToken.address),
            [18, 18],
            LP_TOKEN_NAME,
            LP_TOKEN_SYMBOL,
            INITIAL_A_VALUE,
            INITIAL_A2_VALUE,
            SWAP_FEE,
            0,
            0,
          ],
        ),
      ).to.be.revertedWith("_pooledTokens.length > 32")
    })

    it("Reverts with '_pooledTokens decimals mismatch'", async () => {
      await expect(
        deployContractWithLibraries(
          owner,
          SwapArtifact,
          { SwapUtils: swapUtils.address },
          [
            [firstToken.address, secondToken.address],
            [18],
            LP_TOKEN_NAME,
            LP_TOKEN_SYMBOL,
            INITIAL_A_VALUE,
            INITIAL_A2_VALUE,
            SWAP_FEE,
            0,
            0,
          ],
        ),
      ).to.be.revertedWith("_pooledTokens decimals mismatch")
    })

    it("Reverts with 'Duplicate tokens'", async () => {
      await expect(
        deployContractWithLibraries(
          owner,
          SwapArtifact,
          { SwapUtils: swapUtils.address },
          [
            [firstToken.address, firstToken.address],
            [18, 18],
            LP_TOKEN_NAME,
            LP_TOKEN_SYMBOL,
            INITIAL_A_VALUE,
            INITIAL_A2_VALUE,
            SWAP_FEE,
            0,
            0,
          ],
        ),
      ).to.be.revertedWith("Duplicate tokens")
    })

    it("Reverts with 'The 0 address isn't an ERC-20'", async () => {
      await expect(
        deployContractWithLibraries(
          owner,
          SwapArtifact,
          { SwapUtils: swapUtils.address },
          [
            [ZERO_ADDRESS, ZERO_ADDRESS],
            [18, 18],
            LP_TOKEN_NAME,
            LP_TOKEN_SYMBOL,
            INITIAL_A_VALUE,
            INITIAL_A2_VALUE,
            SWAP_FEE,
            0,
            0,
          ],
        ),
      ).to.be.revertedWith("The 0 address isn't an ERC-20")
    })

    it("Reverts with 'Token decimals exceeds max'", async () => {
      await expect(
        deployContractWithLibraries(
          owner,
          SwapArtifact,
          { SwapUtils: swapUtils.address },
          [
            [firstToken.address, secondToken.address],
            [19, 18],
            LP_TOKEN_NAME,
            LP_TOKEN_SYMBOL,
            INITIAL_A_VALUE,
            INITIAL_A2_VALUE,
            SWAP_FEE,
            0,
            0,
          ],
        ),
      ).to.be.revertedWith("Token decimals exceeds max")
    })

    it("Reverts with '_a not within the limits'", async () => {
      await expect(
        deployContractWithLibraries(
          owner,
          SwapArtifact,
          { SwapUtils: swapUtils.address },
          [
            [firstToken.address, secondToken.address],
            [18, 18],
            LP_TOKEN_NAME,
            LP_TOKEN_SYMBOL,
            10e6 + 1,
            INITIAL_A2_VALUE,
            SWAP_FEE,
            0,
            0,
          ],
        ),
      ).to.be.revertedWith("_a not within the limits")
    })

    it("Reverts with '_a2 not within the limits'", async () => {
      await expect(
        deployContractWithLibraries(
          owner,
          SwapArtifact,
          { SwapUtils: swapUtils.address },
          [
            [firstToken.address, secondToken.address],
            [18, 18],
            LP_TOKEN_NAME,
            LP_TOKEN_SYMBOL,
            INITIAL_A_VALUE,
            10e6 + 1,
            SWAP_FEE,
            0,
            0,
          ],
        ),
      ).to.be.revertedWith("_a2 not within the limits")
    })

    it("Reverts with '_fee exceeds maximum'", async () => {
      await expect(
        deployContractWithLibraries(
          owner,
          SwapArtifact,
          { SwapUtils: swapUtils.address },
          [
            [firstToken.address, secondToken.address],
            [18, 18],
            LP_TOKEN_NAME,
            LP_TOKEN_SYMBOL,
            INITIAL_A_VALUE,
            INITIAL_A2_VALUE,
            10e8 + 1,
            0,
            0,
          ],
        ),
      ).to.be.revertedWith("_fee exceeds maximum")
    })

    it("Reverts with '_adminFee exceeds maximum'", async () => {
      await expect(
        deployContractWithLibraries(
          owner,
          SwapArtifact,
          { SwapUtils: swapUtils.address },
          [
            [firstToken.address, secondToken.address],
            [18, 18],
            LP_TOKEN_NAME,
            LP_TOKEN_SYMBOL,
            INITIAL_A_VALUE,
            INITIAL_A2_VALUE,
            SWAP_FEE,
            10e10 + 1,
            0,
          ],
        ),
      ).to.be.revertedWith("_adminFee exceeds maximum")
    })

    it("Reverts with '_withdrawFee exceeds maximum'", async () => {
      await expect(
        deployContractWithLibraries(
          owner,
          SwapArtifact,
          { SwapUtils: swapUtils.address },
          [
            [firstToken.address, secondToken.address],
            [18, 18],
            LP_TOKEN_NAME,
            LP_TOKEN_SYMBOL,
            INITIAL_A_VALUE,
            INITIAL_A2_VALUE,
            SWAP_FEE,
            0,
            10e8 + 1,
          ],
        ),
      ).to.be.revertedWith("_withdrawFee exceeds maximum")
    })
  })
})
