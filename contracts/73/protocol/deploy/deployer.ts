import util from "util"
import childProcess from "child_process"
const exec = util.promisify(childProcess.exec)

import {ethers} from "hardhat"
import {DeployOptions, DeployResult, DeploymentsExtension} from "hardhat-deploy/types"
import {deployments} from "hardhat"
import {Controller} from "../typechain"
import {Libraries} from "hardhat/types"

export default class ContractDeployer {
    deploy: (name: string, options: DeployOptions) => Promise<DeployResult>
    deployer: string
    deployments: DeploymentsExtension
    controller: Controller | undefined

    constructor(
        deploy: (name: string, options: DeployOptions) => Promise<DeployResult>,
        deployer: string,
        deployments: DeploymentsExtension
    ) {
        this.deploy = deploy
        this.deployer = deployer
        this.deployments = deployments
        this.controller = undefined
    }

    private async getGitHeadCommitHash(): Promise<string> {
        const {stdout, stderr} = await exec("git rev-parse HEAD")
        if (stderr) {
            throw new Error(stderr)
        }
        return `0x${stdout?.trim()}`
    }

    private contractId(name: string) {
        return ethers.utils.solidityKeccak256(["string"], [name])
    }

    async register(name: string, address: string) {
        const gitHash = await this.getGitHeadCommitHash()
        await this.controller?.setContractInfo(
            this.contractId(name),
            address,
            gitHash
        )
    }

    async deployController(): Promise<Controller> {
        if (this.controller && await deployments.get("Controller")) {
            console.log("Controller already deployed")
        } else {
            const controller = await this.deploy("Controller", {
                from: this.deployer, // msg.sender overwrite, use named account
                args: [], // constructor arguments
                log: true // display the address and gas used in the console (not when run in test though)
            })
            this.controller = (await ethers.getContractAt("Controller", controller.address)) as Controller
        }
        return this.controller
    }

    async deployAndRegister(config: {contract: string, name: string, proxy?: boolean, args: Array<any>, libraries?: Libraries | undefined}): Promise<DeployResult> {
        const {contract, name, proxy, args, libraries} = config
        const targetName = `${name}Target`

        const gitHash = await this.getGitHeadCommitHash()

        const target = await this.deploy(contract, {
            from: this.deployer,
            log: true,
            args: [...args],
            libraries: libraries
        })

        if (proxy) {
            await this.controller?.setContractInfo(this.contractId(targetName), target.address, gitHash)
        } else {
            await this.controller?.setContractInfo(this.contractId(name), target.address, gitHash)
            await deployments.save(name, target)
            return target
        }

        // proxy == true, proceed with proxy deployment and registration
        const managerProxy = await this.deploy("ManagerProxy", {
            from: this.deployer,
            log: true,
            args: [this.controller?.address, this.contractId(targetName)]
        })

        await this.controller?.setContractInfo(this.contractId(name), managerProxy.address, gitHash)
        await deployments.save(`${contract}Target`, target)
        await deployments.save(`${contract}Proxy`, managerProxy)
        await deployments.save(contract, managerProxy)

        return managerProxy
    }
}
