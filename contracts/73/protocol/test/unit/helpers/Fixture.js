import RPC from "../../../utils/rpc"
import {contractId} from "../../../utils/helpers"
import {ethers} from "hardhat"

export default class Fixture {
    constructor(web3) {
        this.rpc = new RPC(web3)
        this.commitHash = "0x3031323334353637383930313233343536373839"
    }

    async deploy() {
        const controllerFactory = await ethers.getContractFactory("Controller")

        this.controller = await controllerFactory.deploy()

        await this.deployMocks()
        await this.controller.unpause()
    }

    async deployMocks() {
        const GenericMock = await ethers.getContractFactory("GenericMock")
        const MinterMock = await ethers.getContractFactory("MinterMock")
        const BondingManagerMock = await ethers.getContractFactory(
            "BondingManagerMock"
        )

        this.token = await this.deployAndRegister(GenericMock, "LivepeerToken")
        this.minter = await this.deployAndRegister(MinterMock, "Minter")
        this.bondingManager = await this.deployAndRegister(
            BondingManagerMock,
            "BondingManager"
        )
        this.roundsManager = await this.deployAndRegister(
            GenericMock,
            "RoundsManager"
        )
        this.jobsManager = await this.deployAndRegister(
            GenericMock,
            "JobsManager"
        )
        this.ticketBroker = await this.deployAndRegister(
            GenericMock,
            "TicketBroker"
        )
        this.merkleSnapshot = await this.deployAndRegister(
            GenericMock,
            "MerkleSnapshot"
        )
        // Register TicketBroker with JobsManager contract ID because in a production system the Minter likely will not be upgraded to be
        // aware of the TicketBroker contract ID and it will only be aware of the JobsManager contract ID
        await this.register("JobsManager", this.ticketBroker.address)
        this.verifier = await this.deployAndRegister(GenericMock, "Verifier")
    }

    async register(name, addr) {
        // Use dummy Git commit hash
        await this.controller.setContractInfo(
            contractId(name),
            addr,
            this.commitHash
        )
    }

    async deployAndRegister(contractFactory, name, ...args) {
        const contract = await contractFactory.deploy(...args)
        await contract.deployed()
        await this.register(name, contract.address)
        return contract
    }

    async setUp() {
        this.currentSnapshotId = await this.rpc.snapshot()
    }

    async tearDown() {
        await this.rpc.revert(this.currentSnapshotId)
    }
}
