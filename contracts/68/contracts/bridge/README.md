# bridge-safe-sc
smart contracts for safe of amun blockchain bridges
=================

Install
-------
Set correct node version (see `.nvmrc`) with [nvm](https://github.com/nvm-sh/nvm)
```bash
nvm use
```

Install requirements with yarn:
```bash
yarn
yarn compile
```

Quick Start
-----------
### Setup

Create `.env` file to use the commands (see `.env.example` for more info):

- `PRIVATE_KEY` - Credentials for the account that should be used
- `INFURA_PROJECT_ID`- For network that use Infura based RPC

### Tests
```bash
yarn test
```

### Available Tasks

Use `yarn tasks` to get list off available tasks.

Example:
```bash
yarn tasks
```

### Help

Use `yarn tasks help <command>` to get more information about parameters of a command.

Example:
```bash
yarn tasks help deploy-child-wpeco
```

### Deploy 
Deploy a pair of token that can be bridged by matic. A mapping needs to be a and confirmed ([Mapper Matic](https://mapper.matic.today/map))


Deploy the child (matic) side token. This should wrap a basket token. 
```bash
yarn tasks deploy-child-wpeco --basket [BASKET_ADDRESS]
```

Deploy the root (ethereum) side token.

```bash
yarn tasks deploy-root-wpeco
```



