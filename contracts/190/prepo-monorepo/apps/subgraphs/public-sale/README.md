# PPO Token Public Sale Subgraph

## What is this?

This is a subgraph boilerplate.

Things that are implemented

- [x] graphprotocol dependencies
- [x] codegen and deploy scripts
- [x] listen to Purchase event and sum all purchase amount for the same user

## Installation

```bash
$ yarn
```

## Testing the subgraph

The most straight forward way to test the subgraph is to deploy to your own subgraph.

1. Go to [the graph hosted service](https://thegraph.com/hosted-service/dashboard) and `Add Subgraph`
2. Fill in the form and you should get an Access key which will grant you permission to deploy to your own subgraph
3. Run this script below and replace ACCESS_KEY with your own access key

```bash
$ graph auth --product hosted-service ACCESS_KEY
```

4. Replace `chrisling-dev/prepo-goerli` in `deploy:testnet` script with your github username and subgraph name (You could get this from your subgraph url slug)
5. Deploy the subgraph

```bash
$ yarn deploy
```

## Folder structure guidelines

```
/abis
/src/mappings
/src/utils
```

### /abis

Cointains all the abis for type generation so we could map events

### /src/mappings

Contains all the logics of events mapped to handler

### /src/utils

Contains utils and constants
