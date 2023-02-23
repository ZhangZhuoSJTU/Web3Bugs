import { ZERO_BI } from 'subgraphs-lib/constants'
import { USDC } from '../generated/types/schema'
import { Transfer } from '../generated/types/USDC/ERC20'

function newUser(id: string): USDC {
  const usdc = new USDC(id)
  usdc.balance = ZERO_BI
  return usdc
}

export function handleUSDCTransfer(event: Transfer): void {
  let usdcFrom = USDC.load(event.params.from.toHex())
  if (usdcFrom == null) {
    usdcFrom = newUser(event.params.from.toHex())
  }
  usdcFrom.balance = usdcFrom.balance.minus(event.params.value)
  usdcFrom.save()

  let usdcTo = USDC.load(event.params.to.toHex())
  if (usdcTo == null) {
    usdcTo = newUser(event.params.to.toHex())
  }
  usdcTo.balance = usdcTo.balance.plus(event.params.value)
  usdcTo.save()
}
