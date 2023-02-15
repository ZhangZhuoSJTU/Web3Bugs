# Wild Credit contest details
- $47,500 USDC main award pot
- $2,500 USDC gas optimization award pot
- Join [C4 Discord](https://discord.gg/EY5dvm3evD) to register
- Submit findings [using the C4 form](https://code423n4.com/2021-09-wild-credit-contest/submit)
- [Read our guidelines for more details](https://code423n4.com/compete)
- Starts September 23 2021 00:00 UTC
- Ends September 29 2021 23:59 UTC

[wild.credit](https://wild.credit/) • [@WildCredit](https://twitter.com/WildCredit) • [@0xdev0](https://twitter.com/0xdev0) • [discord](https://discord.gg/emcBDpwf6G) • [GitBook](https://wild-credit.gitbook.io/wild-credit/)
## Contest scoping

Wild Credit is a lending protocol. Unlike Compound or Aave, which are composed of a "basket" of approved tokens, Wild Credit instead has isolated lending pairs. Similar to Uniswap, each pair does not influence the state of any other pair in any way. This allows much better risk management and allows the protocol to list less liquid tokens.

Both tokens in each lending pair can be used either as collateral or the borrowed token. To borrow one token, the borrower must deposit the other token as collateral. Each account can only borrow one of the tokens at the same time. To borrow the other token, the currently borrowed token must be repaid in full and the collateral must be withdrawn. A lender may deposit both tokens at the same time to earn interest.

Borrowers are also able to use their Uniswap V3 positions as collateral.

Please review all contracts in this repository. Special interest could be given to `positionAmounts()` function inside of `UniswapV3Helper.sol` which is used to determine USD value of a position. Another potential source of bugs could be token conversions inside of `LendingPair.sol`. There are a lot of functions accepting tokenA, tokenB, priceA, priceB, converting amounts to shares, shares to amounts, etc.

The **old version** of the protocol can be seen here http://wild.credit/ Note that this UI should only be used to get a basic conceptual understanding of how the protocol works. It uses an old version of contracts which do not support Uniswap V3 positions.

ERC20 difference: `LPTokenMaster.sol` outsources balance tracking & manipulations to the `LendingPair`. Since most balance manipulations are likely to be related to lending and not transfers, this change was made to save gas by reducing external calls from the `LendingPair`.

Please disregard anything currently deployed on mainnet. Subject to review is only the code in this repo and nothing else.

External calls are made by the oracles - Chainlink and Uniswap V3 oracles.

## Compiler notes

The repo uses brownie-style imports for OZ.

Uniswap-related files are on 0.7 since it's not easy to port to 0.8. Rest of the repo is on 0.8.

You can use the following command to compile all contracts: `brownie compile`

To compile this project with hardhat, switch to the `hardhat` branch.

## Links

- https://github.com/code-423n4/2021-07-wildcredit/blob/main/wild_credit_logo.png
- https://twitter.com/wildcredit
- https://twitter.com/0xdev0
- https://discord.gg/emcBDpwf6G
- https://wild.credit/

Docs (old version): https://wild-credit.gitbook.io/wild-credit/
