# Malt Protocol Contracts

Run `yarn` to install all the local dependencies.

## Deploying locally
You should already have the UI repo cloned locally in the same directory as this repo (If you do not have access to the UI repo ask for access). Change the `malt-ui` directory to be called `ui`. Your directory structure should look something like this:
```
- Malt
  - protocol
  - ui
```
This is required because when you deploy locally using `scripts/1_local_deploy.ts` it will try to place the artifact files in the `ui` directory for ease of use in the UI code.

1. Inside the protocol directory run `npx hardhat node` to spin up a local hardhat EVM chain.
2. Run `npx hardhat run --network localhost scripts/1_local_deploy.ts` to build and deploy to the hardhat chain. This will also ensure the UI folder has the correct deploy artifacts.
3. Inside the UI folder make sure you have run `yarn` to install the dependencies from npm
4. Inside the UI folder run `yarn start` to build the frontend. This should pop open the browser and show the UI.
5. You should have MetaMask installed in the browser with a network configured with the following options:
  * RPC URL: http://localhost:8545
  * Chain ID: 31337
  * Symbol: ETH
6. Make sure the above network is selected.
7. It may also be convenient to import the main hardhat testing private key `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80` so you have some test ETH available.

## Useful tasks for local development
Inside `tasks/local` there are a handful of useful tasks for local development. The most useful of which are `advance_time` and `advance_epoch`. These can be used to manipulate the time of the local blockchain such that you don't have to wait for entire epochs to try things against the local chain.

`tasks/advance.ts` and `tasks/stabilize.ts` are also useful. They advance the epoch (if applicable) and call the stabilize method on the `StabilizerNode` contract respectively.

To run any of these tasks simply issue the command:
```
npx hardhat --network localhost <script_name>
```

IE
```
npx hardhat --network localhost stabilize
```
or 
```
npx hardhat --network localhost advance
```
