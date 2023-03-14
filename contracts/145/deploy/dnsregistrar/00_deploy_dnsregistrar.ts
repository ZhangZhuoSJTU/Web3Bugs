import { ethers } from 'hardhat'
import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, deployments } = hre
  const { deploy } = deployments
  const { deployer } = await getNamedAccounts()

  const registry = await ethers.getContract('ENSRegistry')
  const dnssec = await ethers.getContract('DNSSECImpl')

  const publicSuffixList = await deploy('TLDPublicSuffixList', {
    from: deployer,
    args: [],
    log: true,
  })

  await deploy('DNSRegistrar', {
    from: deployer,
    args: [dnssec.address, publicSuffixList.address, registry.address],
    log: true,
  })
}

func.tags = ['dnsregistrar']
func.dependencies = ['registry', 'dnssec-oracle']

export default func
