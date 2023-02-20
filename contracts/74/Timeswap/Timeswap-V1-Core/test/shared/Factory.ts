import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { ethers } from 'hardhat'
import { Address } from 'hardhat-deploy/types'

import type { TimeswapFactory as Factory } from '../../typechain/TimeswapFactory'
import constants from './Constants'

let signers: SignerWithAddress[]
;(async () => {
  signers = await ethers.getSigners()
})()

export async function factoryInit(
  ownerAddress: Address = signers[10].address,
  fee: BigInt = constants.FEE,
  protocolFee: BigInt = constants.PROTOCOL_FEE
): Promise<Factory> {
  const factoryContractFactory = await ethers.getContractFactory('TimeswapFactory')
  const factory = (await factoryContractFactory.deploy(ownerAddress, fee, protocolFee)) as Factory
  await factory.deployed()
  return factory
}

export default { factoryInit }
