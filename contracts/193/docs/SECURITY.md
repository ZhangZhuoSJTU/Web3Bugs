# Security considerations

### Rebase/fee-on-transfer tokens

Rebase and fee-on-transfer tokens are not supported by the AMM.
Using these tokens will break the swap curve and liquidity maths.

### Stuck tokens/nfts

There exists no recovery mechanism for tokens that are accidentally transferred to the AMM.
If tokens or NFTs are accidentally sent to the contract, then they cannot be withdrawn.

### Malicious base token or NFT contracts

It's assumed that all NFTs and base token contracts used to create new pairs are honest.
The user must use their own discretion when deciding whether or not to interact with a particular pair contract and check that the NFT and base token contracts are honest.

### Trusted admin

There exists functionality which allows an admin to withdraw NFTs from pairs.
It's assumed that the admin is trusted and legitimate. However, as an additional precaution, there is a one week grace period in which the admin must signal their intent to withdraw before _actually_ withdrawing.
This allows LPs and traders to withdraw their NFTs from the contract prior to the admin.
