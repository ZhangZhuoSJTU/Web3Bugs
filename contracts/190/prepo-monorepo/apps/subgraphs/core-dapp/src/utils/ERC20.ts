import { Address, BigInt } from '@graphprotocol/graph-ts'
import { Token } from '../generated/types/schema'
import { ERC20 as ERC20Contract } from '../generated/types/templates/UniswapV3Pool/ERC20'

// keep track of all tokens related to us
export function fetchERC20(tokenAddress: Address, type: string): Token | null {
  let token = Token.load(tokenAddress.toHexString())
  if (token === null) {
    token = new Token(tokenAddress.toHexString())
  }
  const decimalsResult = ERC20Contract.bind(tokenAddress).try_decimals()
  const nameResult = ERC20Contract.bind(tokenAddress).try_name()
  const symbolResult = ERC20Contract.bind(tokenAddress).try_symbol()

  // invalid erc20
  if (decimalsResult.reverted || nameResult.reverted || symbolResult.reverted) return null

  token.decimals = BigInt.fromI32(decimalsResult.value)
  token.name = nameResult.value
  token.symbol = symbolResult.value
  token.type = type

  token.save()
  return token
}
