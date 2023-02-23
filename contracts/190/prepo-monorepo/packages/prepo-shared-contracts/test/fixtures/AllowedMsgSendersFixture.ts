import { ethers } from 'hardhat'
import { AllowedMsgSenders } from '../../types/generated'

export async function allowedMsgSendersFixture(): Promise<AllowedMsgSenders> {
  const factory = await ethers.getContractFactory('AllowedMsgSenders')
  return (await factory.deploy()) as AllowedMsgSenders
}
