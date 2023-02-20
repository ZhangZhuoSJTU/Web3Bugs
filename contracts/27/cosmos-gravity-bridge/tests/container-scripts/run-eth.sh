#!/bin/bash
# Starts the Ethereum testnet chain in the background

# init the genesis block
geth --identity "GravityTestnet" \
--nodiscover \
--networkid 15 init /gravity/tests/assets/ETHGenesis.json

# etherbase is where rewards get sent
# private key for this address is 0xb1bab011e03a9862664706fc3bbaa1b16651528e5f0e7fbfcbfdd8be302a13e7
geth --identity "GravityTestnet" --nodiscover \
--networkid 15 \
--mine \
--http \
--miner.threads=1 \
--nousb \
--verbosity=5 \
--miner.etherbase=0xBf660843528035a5A4921534E156a27e64B231fE &> /geth.log
