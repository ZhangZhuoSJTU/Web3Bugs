# Timeswap contest details
- $28,500 USDC main award pot
- $1,500 USDC gas optimization award pot
- Join [C4 Discord](https://discord.gg/code4rena) to register
- Submit findings [using the C4 form](https://code4rena.com/contests/2022-03-timeswap-contest/submit)
- [Read our guidelines for more details](https://docs.code4rena.com/roles/wardens)
- Starts March 4, 2022 00:00 UTC
- Ends March 6, 2022 23:59 UTC

## Contracts

| Name | LOC | External Contracts Called | Libraries |
| :--- | :---: | :---: | :---: |
| Timeswap-V1-Core/TimeswapPair.sol | 523 | 2 | 11 |
| Timeswap-V1-Core/TimeswapFactory.sol | 76 | 1 | 0 |
| Timeswap-V1-Convenience/TimeswapConvenience.sol | 625 | 0 | 8 |
| Timeswap-V1-Convenience/Liquidity.sol | 63 | 0 | 2 |
| Timeswap-V1-Convenience/BondPrincipal.sol | 72 | 0 | 2 |
| Timeswap-V1-Convenience/BondInterest.sol | 72 | 0 | 2 |
| Timeswap-V1-Convenience/InsurancePrincipal.sol | 72 | 0 | 2 |
| Timeswap-V1-Convenience/InsuranceInterest .sol | 72 | 0 | 2 |
| Timeswap-V1-Convenience/CollateralizedDebt.sol | 79 | 0 | 3 |

## Describe any novel or unique curve logic or mathematical models implemented in the contracts

The protocol does not use an oracle for collateral factor calculation. Instead, it utilizes a `xyz=k` constant product algorithm to discover both interest rate and collateral factor. x and y determines interest rate, while x and z determines collateral factor. Whenever the ratio of x, y, and z are not up to market rate, then it means it is a favorable price for a lender or borrower.

### Note

This is a follow-up to our January Code4rena contest. Our goal is to review the mitigations we have made since.  The findings from the earlier contest can be found over [here](https://github.com/code-423n4/2022-01-timeswap-findings).

## Does the token conform to the ERC-20 standard? In what specific ways does it differ?

The following token contracts in the Convenience Repository follow the token standard:
- BondPrincipal ERC20, 
- BondInterest ERC20,
- InsurancePrincipal ERC20, 
- InsuranceInterest ERC20, 
- Liquidity ERC20, and 
- Collateralized Debt ERC721

The key difference they have is that they don’t store total supply in the contract, instead the respective claims (bond tokens and insurance tokens), dues, and liquidity balanceOf of those ERC20 and ERC721 contracts are the total supply.

[Timeswap Whitepaper](https://github.com/code-423n4/2022-03-timeswap/files/8180278/Timeswap.Whitepaper.pdf)

[Timeswap V1 Core Product Specification](https://drive.google.com/file/d/1SQ_Hbv_wQVXEcFlDytAFMA03Rbi5dTLu/view?usp=sharing)

[Timeswap V1 Convenience Product Specification](https://drive.google.com/file/d/1fRgY1PABhmEA34BfxxoqM73dsXkHwSCu/view?usp=sharing)

[Timeswap Gitbook Documentation](https://timeswap.gitbook.io/timeswap/)

[Code Walkthrough](https://youtu.be/AEizNC_u_yQ)

