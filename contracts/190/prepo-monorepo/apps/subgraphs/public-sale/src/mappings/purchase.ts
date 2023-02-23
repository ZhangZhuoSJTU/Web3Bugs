import { Purchase as PurchaseEvent } from '../generated/types/MiniSales/MiniSales'
import { Participant } from '../generated/types/schema'
import { ZERO_BI } from '../utils/constants'

function newParticipant(id: string): Participant {
  const participant = new Participant(id)
  participant.amount = ZERO_BI
  return participant
}

export function handlePurchase(event: PurchaseEvent): void {
  const address = event.params.recipient.toHex()
  let participant = Participant.load(address)
  if (participant === null) participant = newParticipant(address)

  participant.amount = participant.amount.plus(event.params.amount)
  participant.save()
}
