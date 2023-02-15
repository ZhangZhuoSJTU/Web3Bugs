# Rolla Finance contest details

- $75,000 USDC main award pot
- $0 USDC gas optimization award pot
- Join [C4 Discord](https://discord.gg/code4rena) to register
- Submit findings [using the C4 form](https://code4rena.com/contests/2022-03-rolla-finance-contest/submit)
- [Read our guidelines for more details](https://docs.code4rena.com/roles/wardens)
- Starts March 17, 2022 00:00 UTC
- Ends March 24, 2022 23:59 UTC

## Contest scope

All solidity files in the `contracts` folder except `interfaces` and `test` folder.

| Name                                               | SLOC | External Contract Calls | Libraries |
| :------------------------------------------------- | :--: | :---------------------: | :-------: |
| Controller.sol                                     | 399  |           15            |     4     |
| QuantConfig.sol                                    | 131  |            0            |     1     |
| QuantCalculator.sol                                | 228  |            3            |     3     |
| options/QToken.sol                                 | 135  |            3            |     3     |
| options/CollateralToken.sol                        | 206  |            2            |     0     |
| options/OptionsFactory.sol                         | 187  |            1            |     1     |
| options/AssetsRegistry.sol                         |  70  |            2            |     0     |
| options/QTokenStringUtils.sol                      | 185  |            1            |     1     |
| pricing/PriceRegistry.sol                          |  92  |            2            |     1     |
| pricing/OracleRegistry.sol                         | 100  |            3            |     0     |
| pricing/oracle/ProviderOracleManager.sol           |  59  |            2            |     0     |
| pricing/oracle/ChainlinkOracleManager.sol          | 244  |            8            |     2     |
| pricing/oracle/ChainlinkFixedTimeOracleManager.sol |  65  |            4            |     0     |
| timelock/TimelockController.sol                    | 259  |            1            |     0     |
| timelock/ConfigTimelockController.sol              | 517  |            1            |     1     |
| utils/EIP712MetaTransaction.sol                    | 157  |            0            |     2     |
| utils/OperateProxy.sol                             |  13  |            1            |     0     |
| external/openzeppelin/ERC1155.sol                  | 357  |            2            |     1     |
| libraries/Actions.sol                              | 133  |            0            |     0     |
| libraries/FundsCalculator.sol                      | 221  |            0            |     1     |
| libraries/OptionsUtils.sol                         | 150  |            9            |     2     |
| libraries/ProtocolValue.sol                        |  16  |            0            |     0     |
| libraries/QuantMath.sol                            | 133  |            0            |     1     |
| libraries/SignedConverter.sol                      |  14  |            0            |     0     |

The following contracts are OpenZeppelin contracts which are in scope but have minimal changes applied to them:

- TimelockController - made abstract and converted some memory parameters to calldata. Added `ignoreMinDelay` parameter.
- ERC1155 - Made token approvals internal (previously private).

The following bugs are not accepted:

- Bugs reported in our previous audit reports (unless the same bug exists in another part of the code)
- Floating pragmas in interfaces
- 3rd party failure e.g. chainlink oracle having an incorrect reading.
- Bugs related to a system deployment with a different deployment configuration - see the deployment configuration in this doc.

## Description

The Quant Protocol is a decentralized options protocol allowing anyone to mint and trade 100% collateralized, cash-settled European options.

The Quant protocol tokenizes options using the ERC20 standard and also tokenizes a receipt of mint known as a "CollateralToken" which uses the ERC1155 standard. Minting an option or spread requires the max loss of the option seller i.e. fully collateralized options. The Collateral Token entitles the option minter to reclaim any excess collateral once the option has expired.

Options are settled using chainlink post-expiry. The settlement price submission is permissionless - anyone can call the function to settle an option and as long as chainlink has a valid price it'll settle.

[Rolla](https://rolla.finance) is a DeFi structured product platform built on the Quant Protocol that allows anyone to get risk-based yield on various cryptocurrencies or stablecoin. This is accomplished via selling out of the money European covered call and put options on the Quant Protocol.

### Examples

#### Call Option

Alice wants to buy a $5000 ETH CALL option expiring on 12/12/2022 from Bob. Bob can mint the option by providing the max loss of the option (1 ETH) to the smart contract which will custody these funds until settlement. He will receive 1 QToken (5000-ETH-C-12-12-2022) and a CollateralToken representing the 1 ETH collateral that was deposited for this option.

Bob can then trade the QToken with Alice for a premium. The method for doing that is beyond the scope of the protocol but can be done via any smart contract trading platform e.g. 0x.

When the 12 December expiry comes around, let's say the ETH price is $4000. The option is settled via a chainlink oracle for the ETH-USD price. Alice's option expires worthless as ETH did not breach (go above) the strike price of $5000. She is entitled to $0 and Bob is entitled to his collateral back. He can exchange his CollateralToken which is burned to claim back his 1 ETH.

Now let's take the same example but imagine the ETH price was $8000 at expiry. Well, in this case, Alice's option expired in the money as it breached (went above) the $5000 strike price. She is entitled to $8000 - $5000 which is $3000. Alice can exercise her QToken to redeem her $3000 (which is paid out in the underlying asset; ETH). So Alice is entitled to $3000 / $8000 = 0.375ETH. Bob is entitled to the collateral put down minus the payout to Alice which is 1 - 0.375 ETH = 0.625ETH. At the time of expiry, this is worth $5000 i.e. the strike price.

The calculation used for an in the money **call** option on expiration is: \
 \
`(ETH Price - Strike Price) / ETH Price`

#### Put Option

Now let's take the example of a put option. Here, the put buyer thinks the price will go below the strike price and will profit if it does.

Alice wants to buy one $3000 ETH PUT option expiring on 12/12/2022 from Bob. Bob can mint the option by providing the max loss of the option (3000 BUSD) to the smart contract which will custody these funds until settlement. He will receive 1 QToken (3000-ETH-P-12-12-2022) and a CollateralToken representing the 3000 BUSD collateral that was deposited for this option.

When the 12 December expiry comes around, let's say the ETH price is $3500. The option is settled via a chainlink oracle for the ETH-USD price. Alice's option expires worthless as ETH did not breach (go below) the strike price of $3000. She is entitled to $0 and Bob is entitled to his collateral back. He can exchange his CollateralToken which is burned to claim back his 3000 BUSD.

Now let's take the same example but imagine the ETH price was $2000 at expiry. Well, in this case, Alice's option expired in the money as it breached (went below) the $3000 strike price. She is entitled to $3000 - $2000 which is $1000. Alice can exercise her QToken to redeem her $1000 (which is paid out in the collateral asset; BUSD). So Alice is entitled to $1000 \* 1 contract = 1000 BUSD. Bob is entitled to the collateral put down minus the payout to Alice which is 3000 BUSD - 1000 BUSD = 2000 BUSD. At the time of expiry, this is worth $2000 i.e. the strike price. \
 \
The calculation used for an in the money **put** option on expiration is: \
 \
`Strike Price - ETH Price`

#### Spreads

The protocol also supports spreads which allow you to use 1 option as collateral for another given it meets a certain criteria. Examples of spreads can be found in our docs here: [https://docs.rolla.finance/rolla/quant-protocol/spreads](https://docs.rolla.finance/rolla/quant-protocol/spreads)

## Documentation

Check out our in-depth documentation [here](https://docs.rolla.finance/rolla/quant-protocol/overview).

We recommend looking specifically at the following sections of our docs before diving into the code:

1. [Overview](https://docs.rolla.finance/rolla/quant-protocol/overview)
2. [Smart contract summary](https://docs.rolla.finance/rolla/quant-protocol/smart-contract-summary)
3. [Contracts overview](https://docs.rolla.finance/rolla/quant-protocol/contracts)
4. [Protocol actions](https://docs.rolla.finance/rolla/web3/action-library)

## Deployment configuration

See the [deployment configuration](https://docs.rolla.finance/rolla/quant-protocol/deployments) for details of roles and configured variables in the config.

Constructor arguments in our deployment conform to the above spec.

Assume chainlink oracle is configured with the correct oracles from the respective chain i.e. for WETH we would use ETHUSD chainlink oracle. Assume we only configure USD feeds that have 8 decimals for chainlink (since this constant is hardcoded in the oracle managers).

For the `ChainlinkFixedTimeOracle` that there is a single fixed time added which is `28800` i.e. 8am UTC. Assume chainlink have configured daily submissions at this time correctly.

Assume `minDelay` for ConfigTimelockController is sensible.

## Quant protocol components

![Quant Protocol](https://3405344147-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2F6bWsvjSvuHlmjaYdDGxA%2Fuploads%2F8BtP6vtfcNbvK0ucnrK9%2Fimage.png?alt=media&token=e645ad64-72e4-4923-882b-5da323112ea7)

## Overview video

Note: Throughout the video we mention USDC as the video was created some time ago when we were planning on deploying to Polygon. However, we are going to deploy to BNB chain with the strike asset as BUSD. Though the protocol should work for any stablecoin strike asset configured.

[Quant Protocol Technical Overview Video](https://www.youtube.com/watch?v=Q_pqQDO1XCk&).

We are open to requests to create videos on specific parts of the code that you feel you need more clarity on. Or if you want to set up a video call to go over something, we can do that.

## Areas of concern

- `Controller` - any potential loss of funds. Calculations are delegated to `QuantCalculator` and `FundsCalculator` logic which calculates collateral required and payout.
- Chainlink submission mechanism (binary search)
- Upgradeability mechanism in the `Controller` and `QuantConfig`
- Meta transaction logic

## Previous Audits

Audits can be found [here](https://docs.rolla.finance/rolla/audit/audit-reports).

We will dispute any bugs that were previously reported in these audits.

## Pre-emptive questions and answers

#### How does math and rounding work in the protocol?

We use a fixed point format in the protocol when doing calculations and convert to uint when using the value from a fixed point calculation. Rounding is intended to favour the protocol always. This means if collateral required has a decimal, we will round up and take more. If we are paying back and own some decimal points we will round down.

#### Why do you float pragmas?

We float pragmas in interfaces only so that the interfaces can be used in other projects. We have fixed pragmas in contracts.

#### What is the operate proxy?

We allow anyone to do arbitrary calls via the controller using the call action. In order to ensure this call is not done from the `Controller` which has priveleges such as minting option tokens, we make these calls via the proxy contract.

## Tests

First you'll need to install Foundry to run a couple of the tests:

`curl -L https://foundry.paradigm.xyz | bash && foundryup`

Then pull the git submodules dependencies for the Foundry tests with:

`git submodule update --init --recursive`

We have an exhaustive test suite which you can run using the following command:

`yarn test`

## Other:

To view historical commits, you can see our main repository here: [https://github.com/RollaProject/quant-protocol](https://github.com/RollaProject/quant-protocol)

## Contacts

Discord contacts

- quantizations | Rolla (quantizations#3869)
- 0xca11.eth | Rolla (0xca11.eth#9656)

We are happy to arrange video calls to go over certain aspects of the protocol if you wish. Message us on discord if you wish to set one up, we're pretty flexible.

## Licensing

The license for Quant Protocol is the Business Source License 1.1 (`BUSL-1.1`), see <code>[LICENSE](https://github.com/RollaProject/quant-protocol/blob/main/LICENSE)</code>.

## Links

[Rolla](https://rolla.finance)

[Twitter](https://twitter.com/RollaFinance)

[Discord](http://discord.gg/DkDw7f5DVj)

[Telegram](https://t.me/RollaANN)
