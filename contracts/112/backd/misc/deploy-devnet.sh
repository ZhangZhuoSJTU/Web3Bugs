#!/bin/bash

SCRIPT_NAME=deploy-devnet.sh \
    PORT=9545 \
    NETWORK_ID=devnet \
    CHAIN_ID=1337 \
    LIVE=false \
    RPC_COMMAND="npx ganache-cli --port 9545" \
    ./misc/deploy-contracts.sh $@
