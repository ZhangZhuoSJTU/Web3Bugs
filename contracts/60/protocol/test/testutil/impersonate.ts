import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { BigNumber, BigNumberish } from 'ethers'
import HRE from 'hardhat'
const { ethers } = HRE

export async function impersonate(address: string): Promise<SignerWithAddress> {
  await HRE.network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [address],
  })
  return ethers.getSigner(address)
}

export async function impersonateWithBalance(address: string, balance: BigNumberish): Promise<SignerWithAddress> {
  await HRE.network.provider.request({
    method: 'hardhat_setBalance',
    params: [address, BigNumber.from(balance).toHexString()],
  })
  await HRE.network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [address],
  })
  return ethers.getSigner(address)
}
