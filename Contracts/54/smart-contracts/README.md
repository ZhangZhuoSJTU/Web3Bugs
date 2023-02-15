# Smart Contracts

See [our docs](https://docs.unlock-protocol.com/developers/smart-contracts-architecture) for an overview of the smart contracts and [the smart-contract-extensions repo](https://github.com/unlock-protocol/unlock/tree/master/smart-contract-extensions) for integration examples. The deployment process itself is [on our wiki](https://github.com/unlock-protocol/unlock/wiki/Releasing-a-new-version-of-the-contracts).

## Run locally

Start hardhat node.

```
yarn install
yarn run hardhat node
```

Then you can deploy the contracts locally

```
yarn run hardhat deploy
```

### Run the tests

```
npx hardhat test
```

To see all emitted events

```
npx hardhat test --logs
```

### Run a mainnet fork

Mainnet [forking with Hardhat](https://hardhat.org/guides/mainnet-forking.html#forking-from-mainnet) relies on alchemy.com to retrieve chain archival data. An API key is required

To test on a mainnet fork, you need to export `RUN_MAINNET_FORK=1` and  `ALCHEMY_API_KEY=<xxx>` to your env

ex .
```
export RUN_MAINNET_FORK=1
export ALCHEMY_API_KEY=<xxx>

npx hardhat node
// Running a mainnet fork...
```

Once you have mainnet running locally, you can run the relevant tests in another terminal:

```
export RUN_MAINNET_FORK=1
yarn hardhat --network localhost test test/UnlockDiscountToken/upgrades.mainnet.js
```

Note that if the var `RUN_MAINNET_FORK` is not set, the mainnet tests are skipped and will be marked as pending on the CI.


### Setup networks

To set up a network for deployment, change `networks.js` to add your networks and/or change the provider used (defaults might be slower/rate limited).

### Setup account

You can create a "global" `accounts.js` that will be used for all networks or customize each network by using `accounts.<NETWORK NAME>.js`.
The format of the file is:

```
module.exports = {
  mnemonic: 'test test test test test test test test test test test junk',
  initialIndex: 0,
}
```
### Run the UDT contract upgrade

Once your network are setup, you can run the UDT contract upgrade

```
npx hardhat run scripts/udt-upgrade.js --network rinkeby
```

## Upgrade a contract

### Prepare and test the new contract on a mainnet node

```
# setup credentials
export RUN_MAINNET_FORK=1
export ALCHEMY_API_KEY=<xxx>

# run the tests
yarn test test/mainnet/udt.js
```

### Unlock

```
$ npx hardhat upgrade --contract contracts/Unlock.sol --network localhost
Deploying new implemntation on mainnet...
Unlock V9 implementation deployed at: <contract-address>

#  verify the implementation contract
ETHERSCAN_API_KEY=<your-api-key> yarn verify <contract-address>
```

### Get implementation address

```
npx hardhat impl --contract contracts/<YourContract.sol>
> implementation address: <address>
```

NB: for Polygon, you need an API key from https://polygonscan.com

### Update PublicLock template

```
# deploy a new template
yarn hardhat deploy:template

# verify the contract
ETHERSCAN_API_KEY=<your api key> yarn verify <template-address>

# Set the template
yarn hardhat set:template --unlock-address <xxx> --public-lock-address <template-address>
```

## Deploy the contracts

### Deploy all

You can setup an entire environment using

```
yarn deploy-all
```

Or deploy different part separately

```
# some sample commands
yarn hardhat deploy:unlock
yarn hardhat deploy:udt
yarn hardhat deploy:weth
yarn hardhat deploy:uniswap --weth-address 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
yarn hardhat deploy:oracle --uniswap-factory-address 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0

# config tasks are also available
yarn hardhat set:unlock-oracle --oracle-address <xxx> \
  --unlock-address <xxx> \
  --udt-address <xxx>
```

see `npx hardhat --help` for a list of all available tasks and deployments


### Update Unlock config

```
yarn hardhat set:unlock-config --unlock-address <xxx> \
  --udt-address <xxx>
  --weth-address <xxx>
  --estimated-gas-for-purchase <xxx>
  --locksmith-u-r-i <xxx>
```

## Governor + Timelock

```
yarn hardhat deploy:governor

Deploying Governor on localhost with the account: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266...
> Timelock w proxy deployed at: 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
> Governor deployed (w proxy) at: 0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9
> Governor added to Timelock as sole proposer.  0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9 is Proposer: true
> Unlock Owner recounced Admin Role.  0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 isAdmin: false
```

### Make a DAO proposal

1. First, create a file in the `proposals` folder to descibe the proposal itself. The file needs to export the following:

```js
{
  contractName, // the contract - ex. UnlockDiscountTokenV2
  functionName, // the function to be executed - ex. 'transfer'
  functionArgs, // args of the function - ex. [ 0x000, 10000 ]
  proposalName, // ex 'wire Worpdress plugin grant`
  proposerAddress // the proposer (you)
}
```

check [`./proposals/000-example.js`](./proposals/000-example.js) for an example.

2. Test you proposal locally

```
# start a node
yarn hardhat node

# from a 2nd terminal, deploy contracts and governor
yarn hardhat deploy --network localhost
yarn hardhat deploy:governor --network localhost

# test your proposal
yarn hardhat gov --proposal proposals/<your-proposal>.js --network localhost
```

3. When things are ready, post it ot the DAO!

```
yarn hardhat gov:submit --proposal proposals/<your-proposal>.js --network mainnet
```

4. Head to [Tally](https://www.withtally.com/governance/unlock) to see your proposal. NB: this may take some time as it requires X block confirmations

## Release a new version of a contract

1. Update the version number in the contract
2. Fix relevant tests
3. Create a PR mentioning the version bump
4. Make you changes
5. Release the new versions of the contracts ABI with the following command

```
yarn workspace @unlock-protocol/smart-contracts hardhat release --contract contracts/<Unlock|PublicLock>.sol
```