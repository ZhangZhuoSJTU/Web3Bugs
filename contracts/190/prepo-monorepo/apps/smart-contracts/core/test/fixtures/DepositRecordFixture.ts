import { BigNumber } from 'ethers'
import { ethers } from 'hardhat'
import { MockContract, smock } from '@defi-wonderland/smock'
import { DepositRecord } from '../../typechain'

export async function depositRecordFixture(
  globalDepositCap: BigNumber,
  userDepositCap: BigNumber
): Promise<DepositRecord> {
  const depositRecord = await ethers.getContractFactory('DepositRecord')
  return (await depositRecord.deploy(globalDepositCap, userDepositCap)) as DepositRecord
}

export async function smockDepositRecordFixture(
  globalDepositCap: BigNumber,
  userDepositCap: BigNumber
): Promise<MockContract> {
  const smockDepositRecord = await smock.mock('DepositRecord')
  return (await smockDepositRecord.deploy(globalDepositCap, userDepositCap)) as MockContract
}
