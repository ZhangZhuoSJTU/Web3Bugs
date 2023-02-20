![sandclock](brand-assets/Sandclock-Logo-Wordmark.png)

[ethanchor]: https://docs.anchorprotocol.com/ethanchor/ethanchor

## Sandclock Contest details

- $54,000 USDC main award pot
- $0 USDC gas optimization award pot (we have optimizations pipelined)
- Join [C4 Discord](https://discord.gg/code4rena) to register
- Submit findings [using the C4 form](https://code4rena.com/contests/2022-01-sandclock-contest/submit)
- [Read our guidelines for more details](https://docs.code4rena.com/roles/wardens)
- Starts January 6, 2022 00:00 UTC
- Ends January 12, 2022 23:59 UTC

## Audit Scope

The scope includes all the contracts, and any relevant interfaces, in the `sandclock` directory of this repo.
This is a hardhat project with the relevant contracts included, as well as their
test suite.

Contracts and interfaces meant for test purposes only can be safely ignored

Here's a list of the included contracts:

| Name             | LOC | External Contracts Called | Libraries |
| -----            | ----| -------                   | ------    |
| Vault            | 557 | 5                         | 4         |
| SandclockFactory | 58  | 0                         | 0         |
| BaseStratey | 303 | 5                         | 2         |
| NonUSTStrategy | 137 | 6                         | 1         |
| USTStrategy | 37 | 0                         | 0         |
| vault/Claimers   | 122 | 1                         | 1         |
| vault/Depositors | 68  | 1                         | 1         |
| lib/PercentMath | 63  | 0                         | 0         |
| lib/ERC165Query | 55 | 1                         | 0         |

## Focus Areas

### Share allocation / yield distribution

The focus of the vault logic is to allow accounts to deposit an underlying
currency, which will generate yield through an arbitrary strategy. That yield
can be assigned to different beneficiaries, according to an allocation defined
at the moment of deposit.
Ensure that all the calculations around shares and underlying value are correct,
and that no possiblity for loss of funds, hijacking of funds from other
depositors is possible.

### EthAnchor Strategies

Each vault will invest underlying tokens via a strategy, either UST or Non-UST,
depending on which underlying currency is used. The strategy will convert that
underlying to UST (in case of Non-UST strategies) and invest it through
[EthAnchor][ethanchor].
Communication between the vault and strategy must ensure that only the desired
percentage of funds is invested, that all funds are correctly accounted for, and
that no loss of funds occur.

The interaction can be controlled by trusted accounts (defined with the `Trust`
contract). This will allow our backend to ajust investment percentages, and
withdraw funds from the strategy if necessary.

### Positions as NFTs

Both deposits and claims are represented as NFTs. One particularity about this
is that once you own a claim NFT, you cannot receive another one via an NFT
transfer (since a single NFT represents your entire claim across the whole
vault, and the vault would be confused if you owned more than 1).
Transfering NFTs to accounts that don't have any should still be allowed (e.g.: to migrate to a new wallet)

### Deploy Factory

The custom factory allows deploying contracts with a deterministic address
(`CREATE2`) and publish events, which can then be picked up by a subgraph to
dynamically track new vaults.
Ensure each newly created vault is deployed correctly and permissions set as
expected.

### Contact us ☎️

| Name | Timezone | Discord |
| ---- | -------- | ------- |
| Cristiano | UTC | Cristiano#6015 |
| Gabriel | UTC | gabrielpoca#1685 |
| Miguel | UTC | naps62#6355 |
| Milan | UTC+1 | milan#3774 |
| Ryuhei | UTC+9 | svcrypto#4603 |
