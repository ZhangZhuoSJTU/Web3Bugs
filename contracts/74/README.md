# Timeswap contest details
- $63,750 USDC main award pot
- $3,750 USDC gas optimization award pot
- Join [C4 Discord](https://discord.gg/code4rena) to register
- Submit findings [using the C4 form](https://code4rena.com/contests/2022-01-timeswap-contest/submit)
- [Read our guidelines for more details](https://docs.code4rena.com/roles/wardens)
- Starts January 4, 2022 00:00 UTC
- Ends January 10, 2022 23:59 UTC

## Contracts

| Name | LOC | External Contracts Called | Libraries |
| :--- | :---: | :---: | :---: |
| Timeswap-V1-Core/TimeswapPair.sol | 378 | 2 | 10 |
| Timeswap-V1-Core/TimeswapFactory.sol | 75 | 1 | 0 |
| Timeswap-V1-Convenience/TimeswapConvenience.sol | 567 | 0 | 8 |
| Timeswap-V1-Convenience/Liquidity.sol | 70 | 0 | 2 |
| Timeswap-V1-Convenience/Bond.sol | 69 | 0 | 2 |
| Timeswap-V1-Convenience/Insurance.sol | 71 | 0 | 2 |
| Timeswap-V1-Convenience/CollateralizedDebt.sol | 95 | 0 | 3 |

## Describe any novel or unique curve logic or mathematical models implemented in the contracts

The protocol does not use an oracle for collateral factor calculation. Instead, it utilizes a `xyz=k` constant product algorithm to discover both interest rate and collateral factor. x and y determines interest rate, while x and z determines collateral factor. Whenever the ratio of x, y, and z are not up to market rate, then it means it is a favorable price for a lender or borrower.

## Does the token conform to the ERC-20 standard? In what specific ways does it differ?

The Bond ERC20, Insurance ERC20, Liquidity ERC20, and Collateralized Debt ERC721 in the Convenience repo follows the token standard. The key difference they have is that they don’t store total supply in the contract, instead the respective claims (bond and insurance), dues, and liquidity balanceOf of those ERC20 and ERC721 contracts are the total supply.

[Timeswap Whitepaper](https://drive.google.com/file/d/1i7KqwMiSYrkSmxZE-PMIIGlXFhQi55iw/view?usp=sharing)

[Timeswap V1 Core Product Specification](https://drive.google.com/file/d/1Uu5q28Qbfu9hC1OeOMN0LhJE9Pih1mkf/view?usp=sharing)

[Timeswap V1 Convenience Product Specification](https://drive.google.com/file/d/16fzt841PqYdYPrHU17j5kKtI_vhqQ5BE/view?usp=sharing)

[Timeswap Gitbook Documentation](https://timeswap.gitbook.io/timeswap/)

[Code Walkthrough](https://youtu.be/sHBK5ErtksI)
