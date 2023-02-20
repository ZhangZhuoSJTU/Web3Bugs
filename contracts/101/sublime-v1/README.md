# Sublime Protocol

## Overview

Sublime is a decentralized protocol for building and accessing credit. Borrowers can use Sublime to create fully-customizable loan pools or credit lines, allowing them to utilize their social capital to borrow undercollateralized loans from lenders that trust them. The protocol has been developed with the idea of trust minimization - a lender’s capital is only utilized by borrowers they trust. Integration with overcollateralized money markets like Compound enables lenders to generate passive yield on their assets for times when users they trust aren’t actively borrowing. Sublime also features a flexible identity verification module which allows users to link their identities to their wallet addresses to bootstrap their on-chain reputation.

For more information, please refer to the [documentation](https://docs.sublime.finance/).

# Installation and Testing Steps
### Requirements
1. node version >12.x
2. npm version >6.x
3. Foundry

### Once the repo is cloned run the command below to install all the dependencies
```bash
npm install --save-dev 
```

### Install foundry

We are using [foundry](https://github.com/foundry-rs/foundry) to build and test the contracts. Install foundry using the instructions on the foundry [repo](https://github.com/foundry-rs/foundry).

### Install git submodules

We are using [forge-std](https://github.com/foundry-rs/forge-std) for testing which is installed as a git submodule.

```bash
git submodule update --init --recursive
```

### Compile contracts

Compile the contracts using the command below
```bash
forge build
```

### Test the contracts
The repo comes with existing tests. To run existing tests run 

```bash
forge test
```

The test files are in [contracts/test](/contracts/test)


