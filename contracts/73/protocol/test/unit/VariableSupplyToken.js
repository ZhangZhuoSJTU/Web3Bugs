import {ethers} from "hardhat"
import chai, {expect, assert} from "chai"
import {solidity} from "ethereum-waffle"
chai.use(solidity)

describe("VariableSupplyToken", () => {
    let token
    let signers
    before(async () => {
        signers = await ethers.getSigners()
        token = await (
            await ethers.getContractFactory("VariableSupplyToken")
        ).deploy()
    })

    describe("burn", () => {
        it("should reduce the supply and balance of the sender", async () => {
            await token.mint(signers[0].address, 500)

            await token.burn(200)

            const balance = await token.balanceOf(signers[0].address)
            assert.equal(balance, 300, "wrong balance")
            const totalSupply = await token.totalSupply()
            assert.equal(totalSupply, 300, "wrong total supply")
        })

        it("should throw if burn amount is greater than sender balance", async () => {
            await expect(token.burn(400)).to.be.reverted
        })
    })
})
