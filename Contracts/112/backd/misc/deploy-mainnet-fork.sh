#!/bin/bash


SCRIPT_NAME=deploy-mainnet-fork.sh \
    PORT=9555 \
    NETWORK_ID=live-mainnet-fork \
    CHAIN_ID=1111 \
    LIVE=true \
    RPC_COMMAND=./misc/start-mainnet-fork.sh \
    ./misc/deploy-contracts.sh $@
