import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/dist/src/signers"
import {FakeContract, smock} from "@defi-wonderland/smock"
import {expect, use} from "chai"
import {ethers} from "hardhat"
import {
    ArbitrumLivepeerToken,
    ArbitrumLivepeerToken__factory
} from "../../typechain"

use(smock.matchers)

describe("ArbitrumLivepeerToken", () => {
    let token: ArbitrumLivepeerToken

    let eoa: SignerWithAddress

    let routerMock: FakeContract
    let mockRouterEOA: SignerWithAddress
    let mockGatewayEOA: SignerWithAddress

    beforeEach(async () => {
        ;[eoa, mockRouterEOA, mockGatewayEOA] = await ethers.getSigners()

        const ArbitrumLivepeerToken: ArbitrumLivepeerToken__factory =
            await ethers.getContractFactory("ArbitrumLivepeerToken")
        token = await ArbitrumLivepeerToken.deploy(mockRouterEOA.address)

        routerMock = await smock.fake("IL1GatewayRouter", {
            address: mockRouterEOA.address
        })
    })

    describe("registerGatewayWithRouter", () => {
        it("calls setGateway() on the L1GatewayRouter", async () => {
            const maxGas = 555
            const gasPriceBid = 666
            const maxSubmissionCost = 777
            const creditBackAddr = eoa.address
            const l1CallValue = 100

            const tx = await token.registerGatewayWithRouter(
                mockGatewayEOA.address,
                maxGas,
                gasPriceBid,
                maxSubmissionCost,
                creditBackAddr,
                {value: l1CallValue}
            )

            expect(routerMock.setGateway).to.be.calledOnceWith(
                mockGatewayEOA.address,
                maxGas,
                gasPriceBid,
                maxSubmissionCost,
                creditBackAddr
            )
            await expect(tx).to.changeEtherBalance(routerMock, l1CallValue)
        })
    })
})
