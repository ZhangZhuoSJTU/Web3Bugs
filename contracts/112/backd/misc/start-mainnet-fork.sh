#!/bin/sh

ganache-cli --chain.vmErrorsOnRPCResponse true --chain.chainId 1111 --wallet.totalAccounts 10 --wallet.defaultBalance 100000 --hardfork london --fork.url https://mainnet.infura.io/v3/$WEB3_INFURA_PROJECT_ID --miner.blockGasLimit 12000000 --wallet.mnemonic brownie --server.port 9555 --wallet.unlockedAccounts 0xd24F0164aEdbe5676536deb4867CD3d58b4f5405
