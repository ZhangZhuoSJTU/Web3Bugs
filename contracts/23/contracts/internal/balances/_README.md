# Balances

Maintaining balances is the key to strong smart contract security. All logic related to updating balances is kept in this
module, the only method that can update balance storage is marked `private` on the `BalanceHandler.sol` method.

- `BalanceHandler.sol` contains all logic related to manipulating account balances.
- `TokenHandler.sol` contains all logic related to token transfers, it is the only contract that can transfer tokens.
- `Incentives.sol` contains all logic related to claiming incentives

## Design Considerations

- All internal balances are represented in INTERNAL_TOKEN_PRECISION which may or may not match external tokens. Wherever there is ambiguity, variables are marked as internal or external to denote their precision.
- INTERNAL_TOKEN_PRECISION is selected as 1e8 to match cToken precision
- Transfers (wherever possible) will truncate to INTERNAL_TOKEN_PRECISION decimals to ensure that the contract does not accrue dust balances. This is not entirely possible with tokens that have transfer fees.
- Once listed, tokens can **never** be de-listed
- nTokens are always one to one with a token that is tradable on Notional. Therefore, nToken balances are stored alongside token balances to save a storage slot.
- nTokens are incentivized and their incentives are automatically claimed every time an account balance changes.
- Token balances (whenever possible) are finalized at the very last stage of a transaction to allow for transactions to net off potential transfers with lending and borrowing activity.

## Invariants

- Contract **should never** have underlying token balances, all token balances should be in asset tokens (i.e. cTokens) and never actual underlying.
- Total asset cash balances should always equal the sum of all account balances, market cash balances, reserve balances, and nToken cash holdings
