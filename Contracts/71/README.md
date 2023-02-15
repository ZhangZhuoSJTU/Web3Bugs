<img src="https://user-images.githubusercontent.com/40849624/148335534-51637a44-b395-4303-85a0-fff2fa377c04.png" width="500px">

# InsureDAO contest details
- $42,500 USDC + $24,500 INSURE main award pot
- $3,000 USDC + $2,000 INSURE gas optimization award pot
- Join [C4 Discord](https://discord.gg/code4rena) to register
- Submit findings [using the C4 form](https://code4rena.com/contests/2022-01-insuredao-contest/submit)
- [Read our guidelines for more details](https://docs.code4rena.com/roles/wardens)
- Starts January 7, 2022 00:00 UTC
- Ends January 13, 2022 23:59 UTC

# Contest Scope
Representatives from InsureDAO will be available in the Code Arena Discord to answer any questions during the contest period. The focus for the contest is to try and find any logic errors or ways to drain funds from the protocol in a way that is advantageous for an attacker at the expense of users with funds invested in the protocol. Wardens should assume that governance variables are set sensibly (unless they can find a way to change the value of a governance variable, and not counting social engineering approaches for this).

# Contract Overview

|  Contract Name | Overview | Line of Code |
| ---- | ---- | ---- |
|  PoolTemplate.sol  | Insurance Market for arbitrary protocol.<br> aka.Single Pool| 625 |
|  IndexTemplate.sol  | Aggragate multiple Single pools, and leverage the funds.<br> aka.Index Pool | 406 |
|  CDSTemplate.sol  | Reserve pool in case index's leverage was too much and not able to payout for insurance <br> aka.CDS Pool| 214 |
|  Factory.sol  | Contract factory for Templates above| 170 |
|  Vault.sol  | All assets are stored here. | 306 |
|  Parameters.sol  | This manages parameters for pools | 266 |
|  Registry.sol  | Record pools address | 82 |
|  InsureDAOERC20.sol  | LP token of the Templates | 168 |
|  Ownership.sol  | Ownership management | 44 |
|  BondingPremium.sol  | Insurance Premium calculator| 164 |

# Areas of concern for Wardens
Please focus more on the relationship between Single Pool, Index, and Vault, because there is complex calculation related to leverage. 
Also, we put more value for gas optimization of this area.

# System Overview
TLDR <br>
InsureDAO is an open insurance protocol where users can create, buy, and sell insurance of any defi protocols. Insurance buyers pay a premium to an insurance market to get insured by potential incidents, while sellers are able to earn a premium by underwrite their funds.

[Market Overview](https://app.gitbook.com/s/1LzBDG6XOM2hzmw9AjXY/market/market-overview)

<img src="https://user-images.githubusercontent.com/40849624/148342614-e87b4d8a-583c-4c45-8ffd-e1dd037f2dab.png" width="800px">

# Documents
There are three documentations with different level of details.
1. [Landing Page](https://insuredao.fi/): good to understand what InsureDAO is.
2. [General Document](https://insuredao.gitbook.io/insuredao/): InsureDAO functions
3. [Dev Document](https://insuredao.gitbook.io/developers): code specification

Feel free to ask any question on the Code4rena InsureDAO channel!

# Prior Audit Reports
- [Solidified](https://drive.google.com/drive/u/0/folders/1XaLncO353oHYMZaTh1Z28NTehrkNHuJY)
- [QuantStamp](https://drive.google.com/drive/u/0/folders/1XaLncO353oHYMZaTh1Z28NTehrkNHuJY)
- PeckShield (upcoming)


# setup
```
yarn
```

then, create .key and .infuraKey files.

In .key file, input your private key of your address for test
In .infuraKey, input your infura API key


```
npx hardhat test
```

```
npx hardhat coverage
```

