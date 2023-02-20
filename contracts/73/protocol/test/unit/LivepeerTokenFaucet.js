import RPC from "../../utils/rpc"
import chai, {expect, assert} from "chai"
import {solidity} from "ethereum-waffle"
import {ethers} from "hardhat"
chai.use(solidity)

describe("LivepeerTokenFaucet", () => {
    const faucetAmount = 10000000000000
    const requestAmount = 100
    const requestWait = 2

    let rpc
    let token
    let faucet
    let signers

    before(async () => {
        rpc = new RPC(web3)
        signers = await ethers.getSigners()
        const tokenFac = await ethers.getContractFactory("LivepeerToken")
        const faucetFac = await ethers.getContractFactory("LivepeerTokenFaucet")

        token = await tokenFac.deploy()
        faucet = await faucetFac.deploy(
            token.address,
            requestAmount,
            requestWait
        )

        await token.mint(faucet.address, faucetAmount)
    })

    describe("non-whitelisted sender requests", () => {
        it("sends request amount to sender", async () => {
            await faucet.connect(signers[1]).request()

            assert.equal(
                await token.balanceOf(signers[1].address),
                requestAmount,
                "token balance incorrect"
            )
        })

        it("fails if sender does not wait through request time", async () => {
            await expect(faucet.connect(signers[1]).request()).to.be.reverted
        })

        it("sends request amount to sender again after request time", async () => {
            await rpc.increaseTime(2 * 60 * 60)
            await faucet.connect(signers[1]).request()

            assert.equal(
                await token.balanceOf(signers[1].address),
                requestAmount * 2,
                "token balance incorrect"
            )
        })
    })

    describe("whitelisted sender requests", () => {
        it("owner whitelists an address", async () => {
            await faucet.addToWhitelist(signers[2].address)

            assert.equal(
                await faucet.isWhitelisted(signers[2].address),
                true,
                "address is not whitelisted"
            )
        })

        it("sender requests twice without waiting", async () => {
            await faucet.connect(signers[2]).request()
            await faucet.connect(signers[2]).request()

            assert.equal(
                await token.balanceOf(signers[2].address),
                requestAmount * 2,
                "token balance incorrect"
            )
        })

        it("owner removes address from whitelist", async () => {
            await faucet.removeFromWhitelist(signers[2].address)

            assert.equal(
                await faucet.isWhitelisted(signers[2].address),
                false,
                "address is whitelisted"
            )
        })

        it("fails if sender requests twice without waiting", async () => {
            await faucet.connect(signers[2]).request()
            await expect(faucet.connect(signers[2]).request()).to.be.reverted
        })
    })
})
