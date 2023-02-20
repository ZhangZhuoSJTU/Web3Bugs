import {keccak256, bufferToHex} from "ethereumjs-util"
import MerkleTree from "../../utils/merkleTree"
import Fixture from "./helpers/Fixture"
import {web3, ethers} from "hardhat"
import chai, {expect, assert} from "chai"
import {solidity} from "ethereum-waffle"
chai.use(solidity)

describe("MerkleSnapshot", () => {
    let fixture
    let merkleSnapshot
    let signers

    before(async () => {
        signers = await ethers.getSigners()
        fixture = new Fixture(web3)
        await fixture.deploy()
        const merkleFac = await ethers.getContractFactory("MerkleSnapshot")
        merkleSnapshot = await merkleFac.deploy(fixture.controller.address)
    })

    beforeEach(async () => {
        await fixture.setUp()
    })

    afterEach(async () => {
        await fixture.tearDown()
    })

    describe("setSnapshot", () => {
        it("reverts when caller is not controller owner", async () => {
            expect(
                merkleSnapshot
                    .connect(signers[1])
                    .setSnapshot(
                        ethers.utils.formatBytes32String("1"),
                        ethers.utils.formatBytes32String("helloworld")
                    )
            ).to.be.revertedWith("caller must be Controller owner")
        })

        it("sets a snapshot root for an snapshot ID", async () => {
            const id = ethers.utils.formatBytes32String("1")
            const root = ethers.utils.formatBytes32String("helloworld")
            await merkleSnapshot.setSnapshot(id, root)
            assert.equal(await merkleSnapshot.snapshot(id), root)
        })
    })

    describe("verify", () => {
        let leaves
        let tree
        const id = bufferToHex(keccak256("LIP-52"))
        before(async () => {
            leaves = ["a", "b", "c", "d"]
            tree = new MerkleTree(leaves)

            await merkleSnapshot.setSnapshot(id, tree.getHexRoot())
        })

        it("returns false when a proof is invalid", async () => {
            const badLeaves = ["d", "e", "f"]
            const badTree = new MerkleTree(badLeaves)
            const badProof = badTree.getHexProof(badLeaves[0])

            const leaf = bufferToHex(keccak256(leaves[0]))

            assert.isFalse(await merkleSnapshot.verify(id, badProof, leaf))
        })

        it("returns false when leaf is not in the tree", async () => {
            const proof = tree.getHexProof(leaves[0])
            const leaf = bufferToHex(keccak256("x"))

            assert.isFalse(await merkleSnapshot.verify(id, proof, leaf))
        })

        it("returns false when a proof is of invalid length", async () => {
            let proof = tree.getHexProof(leaves[0])
            proof = proof.slice(0, proof.length - 1)
            const leaf = bufferToHex(keccak256(leaves[0]))

            assert.isFalse(await merkleSnapshot.verify(id, proof, leaf))
        })

        it("returns true when a proof is valid", async () => {
            const proof = tree.getHexProof(leaves[0])
            const leaf = bufferToHex(keccak256(leaves[0]))
            assert.isTrue(await merkleSnapshot.verify(id, proof, leaf))
        })
    })
})
