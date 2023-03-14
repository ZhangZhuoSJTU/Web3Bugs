import '@nomiclabs/hardhat-ethers'
import '@nomiclabs/hardhat-solhint'
import '@nomiclabs/hardhat-truffle5'
import '@nomiclabs/hardhat-waffle'
import { exec as _exec } from 'child_process'
import dotenv from 'dotenv'
import { existsSync } from 'fs'
import fs from 'fs/promises'
import 'hardhat-abi-exporter'
import 'hardhat-deploy'
import 'hardhat-gas-reporter'
import { HardhatUserConfig, task } from 'hardhat/config'
import { Artifact } from 'hardhat/types'
import { promisify } from 'util'

const exec = promisify(_exec)

const archivedDeploymentPath = './deployments/archive'

// Load environment variables from .env file. Suppress warnings using silent
// if this file is missing. dotenv will never modify any environment variables
// that have already been set.
// https://github.com/motdotla/dotenv
dotenv.config({ debug: false })

task('accounts', 'Prints the list of accounts', async (_, hre) => {
  const accounts = await hre.ethers.getSigners()

  for (const account of accounts) {
    console.log(account.address)
  }
})

task(
  'archive-scan',
  'Scans the deployments for unarchived deployments',
).setAction(async (_, hre) => {
  const network = hre.network.name

  const deployments = await hre.deployments.all()

  for (const deploymentName in deployments) {
    const deployment = deployments[deploymentName]
    if (!deployment.receipt || !deployment.bytecode) continue

    const archiveName = `${deploymentName}_${network}_${deployment.receipt.blockNumber}`
    const archivePath = `${archivedDeploymentPath}/${archiveName}.sol`

    if (existsSync(archivePath)) {
      continue
    }

    let fullName: string
    try {
      await hre.deployments.getArtifact(deploymentName)
      fullName = `${deploymentName}.sol:${deploymentName}`
    } catch (e: any) {
      if (e._isHardhatError && e.number === 701) {
        fullName = e.messageArguments.candidates.split('\n')[1]
      } else {
        throw e
      }
    }

    await hre.run('save', {
      contract: deploymentName,
      block: String(deployment.receipt.blockNumber),
      fullName,
    })
  }
})

task('save', 'Saves a specified contract as a deployed contract')
  .addPositionalParam('contract', 'The contract to save')
  .addPositionalParam('block', 'The block number the contract was deployed at')
  .addOptionalParam(
    'fullName',
    '(Optional) The fully qualified name of the contract (e.g. contracts/resolvers/PublicResolver.sol:PublicResolver)',
  )
  .setAction(
    async (
      {
        contract,
        block,
        fullName,
      }: { contract: string; block: string; fullName?: string },
      hre,
    ) => {
      const network = hre.network.name

      const artifactReference = fullName || contract
      const artifact = await hre.deployments.getArtifact(artifactReference)

      const archiveName = `${contract}_${network}_${block}`
      const archivePath = `${archivedDeploymentPath}/${archiveName}.sol`

      if (existsSync(archivePath)) {
        throw new Error('Archive already exists')
      }

      const newArtifact: Artifact & {
        commitHash: string
        treeHash: string
      } = {
        ...artifact,
        contractName: archiveName,
        sourceName: archivePath.substring(2),
        commitHash: (await exec('git rev-parse HEAD')).stdout.trim(),
        treeHash: (
          await exec(`git rev-parse HEAD:${artifact.sourceName}`)
        ).stdout.trim(),
      }

      await fs.mkdir(archivePath)
      await fs.writeFile(
        `${archivePath}/${archiveName}.json`,
        JSON.stringify(newArtifact, null, 2),
      )
      console.log("Archived contract to '" + archivePath + "'")
    },
  )

let real_accounts = undefined
if (process.env.DEPLOYER_KEY && process.env.OWNER_KEY) {
  real_accounts = [process.env.DEPLOYER_KEY, process.env.OWNER_KEY]
}

const config: HardhatUserConfig = {
  networks: {
    hardhat: {
      saveDeployments: false,
      tags: ['test', 'legacy', 'use_root'],
    },
    localhost: {
      url: 'http://127.0.0.1:8545',
      saveDeployments: false,
      tags: ['test', 'legacy', 'use_root'],
    },
    ropsten: {
      url: `https://ropsten.infura.io/v3/${process.env.INFURA_ID}`,
      tags: ['test', 'legacy', 'use_root'],
      chainId: 3,
      accounts: real_accounts,
    },
    goerli: {
      url: `https://goerli.infura.io/v3/${process.env.INFURA_ID}`,
      tags: ['test', 'legacy', 'use_root'],
      chainId: 5,
      accounts: real_accounts,
    },
    mainnet: {
      url: `https://mainnet.infura.io/v3/${process.env.INFURA_ID}`,
      tags: ['legacy', 'use_root'],
      chainId: 1,
      accounts: real_accounts,
    },
  },
  mocha: {},
  solidity: {
    compilers: [
      {
        version: '0.8.13',
        settings: {
          optimizer: {
            enabled: true,
            runs: 10000,
          },
        },
      },
    ],
  },
  abiExporter: {
    path: './build/contracts',
    runOnCompile: true,
    clear: true,
    flat: true,
    except: [
      'Controllable$',
      'INameWrapper$',
      'SHA1$',
      'Ownable$',
      'NameResolver$',
      'TestBytesUtils$',
      'legacy/*',
    ],
    spacing: 2,
    pretty: true,
  },
  namedAccounts: {
    deployer: {
      default: 0,
    },
    owner: {
      default: 1,
    },
  },
  external: {
    contracts: [
      {
        artifacts: [archivedDeploymentPath],
      },
    ],
  },
}

export default config
