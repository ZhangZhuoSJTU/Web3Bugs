[![Node.js CI](https://github.com/OpenLeverageDev/openleverage-contracts/actions/workflows/node.js.yml/badge.svg?branch=main)](https://github.com/OpenLeverageDev/openleverage-contracts/actions/workflows/node.js.yml)


OpenLeverage Protocol
=================

The OpenLeverage Protocol comprises Smart Contracts in Solidity for permissionless lending and borrowing assets for leverage trading with DEX integration.

- Through provided API, anyone can create a pair of lending pools for a specific token pair.
- LToken, similar to CToken of Compound, is an interest-bearing ERC-20 token to be received by the fund supplier when they *supply* ERC-20 tokens to the lending pools. The LToken contracts track these balances and algorithmically set interest rates with a kinked model for borrowers.
- All margin trades will be executed against the liquidity pool of DEX, like Uniswap.
- Risk is calculated with real-time price from AMM.
- Positions are protected with OnDemand Oracle utilizing TWAP from AMM.

Before starting this repo, please read the [OpenLeverage Documentation](https://docs.openleverage.finance), describing how OpenLeverage works.

Installation
------------
To compile OpenLeverage Smart Contracts, pull the repository from GitHub and install its dependencies. You will need [npm](https://docs.npmjs.com/cli/install) installed.

    git clone https://github.com/OpenLeverageDev/openleverage-contracts.git
    cd openleverage-contracts
    npm install
    truffle compile

Testing
-------
To run the tests, you will need [ganache-cli](https://github.com/trufflesuite/ganache-cli):

    npm install -g ganache-cli

Truffle contract tests are provided under the [tests directory](https://github.com/OpenLeverageDev/openleverage-contracts/tree/main/test). run:
 
    truffle test

Audits
----------
- [Certik Jun 2021](/audits/REP-OpenLeverage-Protocol-2021-06-24.pdf)
- [PeckShield Sep 2021](https://github.com/peckshield/publications/blob/master/audit_reports/PeckShield-Audit-Report-OpenLeverage-v1.0.pdf)
- [PeckShield Dec 2021](https://github.com/peckshield/publications/blob/master/audit_reports/PeckShield-Audit-Report-OpenLeverage-1.0.1.pdf)
- [Code4Rena - Coming in Jan 2021](https://code4rena.com/contests/2022-01-openleverage-contest)

Licensing
----------
The primary license for OpenLeverage is the Business Source License 1.1 (`BUSL-1.1`), see [`LICENSE`](./LICENSE), effectively a time-delayed GPL-2.0-or-later license. The license limits the use of the OpenLeverage source code in a commercial or production setting for up to two years, at which point it will convert to a GPL license into perpetuity.

Discussion
----------

For questions about the protocol, visit us on [Discord](https://discord.gg/openleverage) to discuss.

For security concerns, please visit [OpenLeverage Security](https://docs.openleverage.finance/main/dev/security) or email [security@openleverage.finance](mailto:security@openleverage.finance).

_© Copyright 2021, OpenLeverage Team
