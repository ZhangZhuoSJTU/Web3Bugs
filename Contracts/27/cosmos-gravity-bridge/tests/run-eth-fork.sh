#!/bin/bash
set -eux
# Starts a hardhat RPC backend that is based off of a fork of Ethereum mainnet. This is useful in that we take
# over the account of a major Uniswap liquidity provider and from there we can test many things that are infeasible
# to do with a Geth backend, simply becuase reproducting that state on our testnet would be far too complex to consider
# The tradeoff here is that hardhat is an ETH dev environment and not an actual ETH implementation, as such the outputs
# may be different

# Note: This is very similar to run-solidity-test-fork but has hardhat running on a higher (more recent) block height
# in order to interact with Uniswap's v3 contracts
export ALCHEMY_ID=$1
pushd /gravity/solidity
npm run evm_fork