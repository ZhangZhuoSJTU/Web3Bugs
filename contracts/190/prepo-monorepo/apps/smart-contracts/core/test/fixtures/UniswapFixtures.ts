import { FakeContract, smock } from '@defi-wonderland/smock'
import { abi as SWAP_ROUTER_ABI } from '@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json'
import { BaseContract } from 'ethers'

export async function fakeSwapRouterFixture(): Promise<FakeContract<BaseContract>> {
  const fakeContract = await smock.fake(SWAP_ROUTER_ABI)
  return fakeContract
}
