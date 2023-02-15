# DebtLocker

[![CircleCI](https://circleci.com/gh/maple-labs/debt-locker/tree/main.svg?style=svg)](https://circleci.com/gh/maple-labs/debt-locker/tree/main) [![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)

**DISCLAIMER: This code has NOT been externally audited and is actively being developed. Please do not use in production without taking the appropriate steps to ensure maximum security.**

DebtLocker is a smart contract that allows Pools to interact with different versions of Loans. 

This contract has the following capabilities:
1. Claim funds from a loan, accounting for interest and principal respectively.
2. Accept terms of refinancing.
3. Perform repossession of funds and collateral from a Loan that is in default, transferring the funds to a Liquidator contract.
4. Set the allowed slippage and minimum price of collateral to be used by the liquidator contract.
4. Claim recovered funds from a liquidation, accounting for the amount that was recovered as principal in the context of the Pool, and registering the shortfall.

### Dependencies/Inheritance
The `DebtLocker` contract is deployed using the `MapleProxyFactory`, which can be found in the modules or on GitHub [here](https://github.com/maple-labs/maple-proxy-factory). 

`MapleProxyFactory` inherits from the generic `ProxyFactory` contract which can be found [here](https://github.com/maple-labs/proxy-factory).

## Testing and Development
#### Setup
```sh
git clone git@github.com:maple-labs/debt-locker.git
cd debt-locker
dapp update
```
#### Running Tests
- To run all tests: `make test` (runs `./test.sh`)
- To run a specific test function: `./test.sh -t <test_name>` (e.g., `./test.sh -t test_setAllowedSlippage`)
- To run tests with a specified number of fuzz runs: `./test.sh -r <runs>` (e.g., `./test.sh -t test_setAllowedSlippage -r 10000`)

This project was built using [dapptools](https://github.com/dapphub/dapptools).

## Roles and Permissions
- **Governor**: Controls all implementation-related logic in the DebtLocker, allowing for new versions of proxies to be deployed from the same factory and upgrade paths between versions to be allowed.
- **Pool Delegate**: Can perform the following actions:
- Claim funds
- Set allowed slippage and minimum price for liquidations
- Trigger default
- Set the auctioneer (dictates price for liquidations) to another contract
- Accept refinance terms
- Set `fundsToCapture`, a variable that represents extra funds in the DebtLocker that should be sent to the Pool and registered as interest.

## About Maple
[Maple Finance](https://maple.finance) is a decentralized corporate credit market. Maple provides capital to institutional borrowers through globally accessible fixed-income yield opportunities.

For all technical documentation related to the currently deployed Maple protocol, please refer to the maple-core GitHub [wiki](https://github.com/maple-labs/maple-core/wiki).

---

<p align="center">
  <img src="https://user-images.githubusercontent.com/44272939/116272804-33e78d00-a74f-11eb-97ab-77b7e13dc663.png" height="100" />
</p>
