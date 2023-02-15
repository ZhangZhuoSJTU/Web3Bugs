import { ethers } from 'hardhat'
import { DeployFunction } from 'hardhat-deploy/types'
import { IDiamondLoupe } from '../typechain'
import { addFacets, addOrReplaceFacets } from '../utils/diamond'

const func: DeployFunction = async function () {
  const diamondLoupeFacet = await ethers.getContract('DiamondLoupeFacet')
  const ownershipFacet = await ethers.getContract('OwnershipFacet')
  const diamond = await ethers.getContract('LiFiDiamond')

  const loupe = <IDiamondLoupe>(
    await ethers.getContractAt('IDiamondLoupe', diamond.address)
  )

  try {
    await loupe.facets()
  } catch (e) {
    await addFacets([diamondLoupeFacet], diamond.address)
  }

  await addOrReplaceFacets([diamondLoupeFacet, ownershipFacet], diamond.address)
}

export default func
func.id = 'init_facets'
func.tags = ['InitFacets']
func.dependencies = ['InitialFacets', 'LiFiDiamond']
