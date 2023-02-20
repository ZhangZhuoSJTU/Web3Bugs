import { TypedDataField } from '@ethersproject/abstract-signer'
import { BigNumberish, Contract, ContractFactory, Signer, Wallet } from 'ethers'
import { splitSignature } from 'ethers/lib/utils'

export async function deployContract(
  name: string,
  factory: ContractFactory,
  signer: Signer,
  args: Array<any> = [],
): Promise<Contract> {
  const contract = await factory.connect(signer).deploy(...args)
  console.log('Deploying', name)
  console.log('  to', contract.address)
  console.log('  in', contract.deployTransaction.hash)
  return contract.deployed()
}

export const signPermission = async (
  method: string,
  vault: Contract,
  owner: Wallet,
  delegateAddress: string,
  tokenAddress: string,
  amount: BigNumberish,
  vaultNonce: BigNumberish,
  chainId?: BigNumberish,
) => {
  // get chainId
  chainId = chainId || (await vault.provider.getNetwork()).chainId
  // craft permission
  const domain = {
    name: 'UniversalVault',
    version: '1.0.0',
    chainId: chainId,
    verifyingContract: vault.address,
  }
  const types = {} as Record<string, TypedDataField[]>
  types[method] = [
    { name: 'delegate', type: 'address' },
    { name: 'token', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
  ]
  const value = {
    delegate: delegateAddress,
    token: tokenAddress,
    amount: amount,
    nonce: vaultNonce,
  }
  // sign permission
  // todo: add fallback if wallet does not support eip 712 rpc
  const signedPermission = await owner._signTypedData(domain, types, value)
  // return
  return signedPermission
}

export const signPermitEIP2612 = async (
  owner: Wallet,
  token: Contract,
  spenderAddress: string,
  value: BigNumberish,
  deadline: BigNumberish,
  nonce?: BigNumberish,
) => {
  // get nonce
  nonce = nonce || (await token.nonces(owner.address))
  // get chainId
  const chainId = (await token.provider.getNetwork()).chainId
  // get domain
  const domain = {
    name: 'Uniswap V2',
    version: '1',
    chainId: chainId,
    verifyingContract: token.address,
  }
  // get types
  const types = {} as Record<string, TypedDataField[]>
  types['Permit'] = [
    { name: 'owner', type: 'address' },
    { name: 'spender', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ]
  // get values
  const values = {
    owner: owner.address,
    spender: spenderAddress,
    value: value,
    nonce: nonce,
    deadline: deadline,
  }
  // sign permission
  // todo: add fallback if wallet does not support eip 712 rpc
  const signedPermission = await owner._signTypedData(domain, types, values)
  // split signature
  const sig = splitSignature(signedPermission)
  // return
  return [
    values.owner,
    values.spender,
    values.value,
    values.deadline,
    sig.v,
    sig.r,
    sig.s,
  ]
}
