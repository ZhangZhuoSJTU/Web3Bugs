import { ethers } from "hardhat"
import { Wallet, Signer } from "ethers"
import chai from "chai"
import { deployContract, solidity } from "ethereum-waffle"

import OwnerPausableArtifact from "../build/artifacts/contracts/OwnerPausable.sol/OwnerPausable.json"
import { OwnerPausable } from "../build/typechain/OwnerPausable"

chai.use(solidity)
const { expect } = chai

describe("OwnerPausable", () => {
  let signers: Array<Signer>

  let ownerPausable: OwnerPausable

  beforeEach(async () => {
    signers = await ethers.getSigners()
    ownerPausable = (await deployContract(
      signers[0] as Wallet,
      OwnerPausableArtifact,
    )) as OwnerPausable
  })

  it("Emits an event on pausing", async () => {
    await expect(ownerPausable.pause()).to.emit(ownerPausable, "Paused")
  })

  it("Reverts when pausing if already paused", async () => {
    await ownerPausable.pause()
    await expect(ownerPausable.pause()).to.be.reverted
  })

  it("Reverts when a non-owner tries to pause", async () => {
    await expect(ownerPausable.connect(signers[1] as Wallet).pause()).to.be
      .reverted
  })

  it("Emits an event on unpausing", async () => {
    await ownerPausable.pause()
    await expect(ownerPausable.unpause()).to.emit(ownerPausable, "Unpaused")
  })

  it("Reverts when unpausing if already unpaused", async () => {
    await expect(ownerPausable.unpause()).to.be.reverted
  })

  it("Reverts when a non-owner tries to unpause", async () => {
    await expect(ownerPausable.connect(signers[1] as Wallet).unpause()).to.be
      .reverted
  })
})
