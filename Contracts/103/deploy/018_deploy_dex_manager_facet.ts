import { ethers, network } from 'hardhat'
import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { addOrReplaceFacets } from '../utils/diamond'
import config from '../config/dexs'
import { DexManagerFacet } from '../typechain'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre
  const { deploy } = deployments

  const { deployer } = await getNamedAccounts()

  await deploy('DexManagerFacet', {
    from: deployer,
    log: true,
    deterministicDeployment: true,
  })

  const dexManagerFacet = await ethers.getContract('DexManagerFacet')

  const diamond = await ethers.getContract('LiFiDiamond')

  await addOrReplaceFacets([dexManagerFacet], diamond.address)

  const dexs = config[network.name].map((d) => d.toLowerCase())
  if (dexs && dexs.length) {
    console.log('Adding DEXs to whitelist...')
    const dexMgr = <DexManagerFacet>(
      await ethers.getContractAt('DexManagerFacet', diamond.address)
    )
    const approvedDEXs = (await dexMgr.approvedDexs()).map((d) =>
      d.toLowerCase()
    )

    if (JSON.stringify(approvedDEXs) === JSON.stringify(dexs)) {
      console.log('DEXs already whitelisted.')
    } else {
      await dexMgr.batchAddDex(dexs)
    }
    console.log('Done!')
  }
}
export default func
func.id = 'deploy_dex_manager_facet'
func.tags = ['DeployDexManagerFacet']
func.dependencies = ['InitialFacets', 'LiFiDiamond', 'InitFacets']
