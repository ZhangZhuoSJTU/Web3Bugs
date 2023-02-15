




# BadgerDAO Zaps contest details
- $28,500 USDC main award pot
- $1,500 USDC gas optimization award pot
- Join [C4 Discord](https://discord.gg/code4rena) to register
- Submit findings [using the C4 form](https://code423n4.com/2021-11-badgerzaps-contest/submit)
- [Read our guidelines for more details](https://docs.code4rena.com/roles/wardens)
- Starts Nov 14 00:00 UTC
- Ends Nov 16 23:59 UTC

## Intro

ibBTC is a basket of BadgerSettToken (bTokens)
These tokens can be used to mint or redeem from and into ibBTC

These are 4 zaps meant to:
- Facilitate minting of ibBTC
- Facilitate adding ibBTC to a Staking Vault
- Facilitate swapping to tokenized bitcoin and bTokens (Badger Vaults Tokens) to ibBTC via Zaps
- Providing liquidity of ibBTC in the ibBTC Curve Pool

The goal of this contest is to determine if the below listed zaps are:
- Safe to use
- Mathematically will provide the correct amount of tokens given the inputs

Specific care should be put in:
- Economic exploits
- Rug Vectors
- Risks for the users of the zaps
- Risks for the ibBTC Deposits

## Contract Descriptions
1. ibBTC Zap.sol
Allows to mint ibBTC given tokenized bitcoin e.g. renBTC

2. ibBTC VaultZap.sol
Given ibBTC deposit wibBTC (via the wrapper, part of the previous Badger contest) to mint the Curve LP Token for the ibBTC Curve Pool

3. ibBTC CurveZap.vy
Given renBTC, mint ibBTC, use it to provide liquidity in the ibBTC Curve Pool and stake it in the ibBTC Staking Sett

4. SettToRenIbbtcZap.sol
Given a Sett Token (badger vault), use the underlying to mint ibBTC via the renBTC Zap

## Visualization
See this Miro Board: https://miro.com/app/board/o9J_lj8o-EM=/?invite_link_id=980480935731

## Contracts
| Contract              | Link                                                                                                                                  |
|-----------------------|---------------------------------------------------------------------------------------------------------------------------------------|
| 1. ibBTC Zap.sol         | https://github.com/Badger-Finance/ibbtc/blob/d8b95e8d145eb196ba20033267a9ba43a17be02c/contracts/Zap.sol                               |
| 2. ibBTC VaultZap.sol    | https://github.com/Badger-Finance/badger-ibbtc-utility-zaps/blob/6f700995129182fec81b772f97abab9977b46026/contracts/IbbtcVaultZap.sol |
| 3. ibBTC CurveZap.vy   | https://github.com/Badger-Finance/ibbtc-curve-zap/blob/47a9964d17f9c5bea314d21186773aef99012153/contracts/DepositZapibBTC.vy                              |
| 4. SettToRenIbbtcZap.sol | https://github.com/Badger-Finance/badger-ibbtc-utility-zaps/blob/a5c71b72222d84b6414ca0339ed1761dc79fe56e/contracts/SettToRenIbbtcZap.sol                                |


## Additional Information

The wibBTC / sBTC Curve Pool: https://curve.fi/factory/60

The previous Badger Vaults Contest:
https://code423n4.com/reports/2021-09-bvecvx/

The previous Badger Wrapper Contest:
https://github.com/code-423n4/2021-10-badgerdao-findings - !!! Severity Ratings have yet to be judged !!!
