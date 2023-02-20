# ETH to Cosmos Oracle

As part of operating the Gravity bridge all validators run an `Oracle` this Ethereum oracle is bundled into the `gbt` (Gravity bridge tools) binary along with the [ethereum signer](/docs/design/ethereum-signing.md). For a detailed look at the code involved in this process see [code structure intro](/docs/developer/code-structure.md)

This process connects to an Ethereum node to monitor the Ethereum blockchain for new events involving the `Gravity Contract`.

The `Gravity Contract` assigns every event a monotonically increasing `event_nonce` with no gaps. This nonces is the unique coordinating value for the Oracle. Every event has the `event_nonce` attached, this is used to ensure that when a validator submits a claim stating it has seen a specific event happening on Ethereum the ordering is unambiguous.

- An `Oracle` observes an event on the Ethereum chain, it packages this event into a `Claim` and submits this claim to the cosmos chain as an [Oracle message](/docs/design/messages.md##Oracle-messages)
- Within the Gravity Cosmos module this `Claim` either creates or is added to an existing `Attestation` that matches the details of the `Claim` once more than 66% of the active `Validator` set has made a `Claim` that matches the given `Attestation` the `Attestation` is executed. This may mint tokens, burn tokens, or whatever is appropriate for this particular event.
- Once an event has been executed it is marked as `Observed` this means a particular claim has been agreed upon by 66% of the active validator set and executed as a state change on chain.
- In the event that the validators can not agree >66% on a single `Attestation` the oracle is halted. This means no new events will be relayed from Ethereum until some of the validators change their votes. There is no slashing condition for this, with reasoning outlined in the [slashing spec](/spec/slashing-spec.md)
- It is important to note that if for _any one block_ 66% of the voting power agrees on an event it is executed and a state change is made. So in the case of rapidly changing validator powers strange behavior may occur.
