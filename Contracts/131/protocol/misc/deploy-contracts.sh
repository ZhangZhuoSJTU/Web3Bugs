#!/bin/bash

required_variables=(SCRIPT_NAME PORT NETWORK_ID CHAIN_ID LIVE RPC_COMMAND)
for var_name in "${required_variables[@]}"; do
    declare -n var=$var_name
    if [ -z "$var" ]; then
        echo "$var_name not set"
        exit 1
    fi
done


set -e


clean=false

while [[ $# -gt 0 ]]; do
    key="$1"
    case $key in
        -c|--clean)
            clean=true
            shift
            ;;
        *)
            echo "unknown argument $1"
            echo "usage: ./misc/$SCRIPT_NAME.sh [--clean]"
            shift
        ;;
    esac
done


if ! type -t jq > /dev/null; then
    echo "please install jq: https://stedolan.github.io/jq/"
    exit 1
fi

if [ ! -d "scripts" ]; then
    echo "please run this from the project root"
    exit 1
fi

if ! brownie networks list | grep -q $NETWORK_ID; then
    echo -e "$NETWORK_ID not found, please create it with:\nbrownie networks add Ethereum $NETWORK_ID host=http://localhost:$PORT chainid=$CHAIN_ID"
    exit 1
fi

if ! curl -s http://localhost:$PORT/ > /dev/null; then
    echo -e "node not running on port $PORT, run it with:\n$RPC_COMMAND"
    exit 1
fi

if [ "$clean" = "true" ]; then
    echo "cleaning current deployment"
    dir=$PWD
    rm -rf $dir/build/deployments/$CHAIN_ID
    if [ -f $dir/build/deployments/map.json ]; then
        cp $dir/build/deployments/map.json $dir/build/deployments/map.json.bak
        jq 'del(."'$CHAIN_ID'")' $dir/build/deployments/map.json.bak > $dir/build/deployments/map.json
    fi
elif [ -d "build/deployments/$CHAIN_ID" ]; then
    echo "$NETWORK_ID already deployed, run with --clean to clean"
    exit 1
fi

if [ "$LIVE" = "true" ]; then
    brownie run --network $NETWORK_ID scripts/fund_deployer.py 
fi

brownie run --network $NETWORK_ID scripts/deploy_address_provider.py
brownie run --network $NETWORK_ID scripts/deploy_role_manager.py
brownie run --network $NETWORK_ID scripts/deploy_controller.py
brownie run --network $NETWORK_ID scripts/deploy_vault_reserve.py
brownie run --network $NETWORK_ID scripts/deploy_oracle_provider.py
brownie run --network $NETWORK_ID scripts/deploy_swapper_router.py

brownie run --network $NETWORK_ID scripts/deploy_pool_factory.py

brownie run --network $NETWORK_ID scripts/deploy_minter.py
brownie run --network $NETWORK_ID scripts/deploy_bkd_token.py
brownie run --network $NETWORK_ID scripts/deploy_inflation_manager.py

brownie run --network $NETWORK_ID scripts/deploy_implementation.py erc20_pool
brownie run --network $NETWORK_ID scripts/deploy_implementation.py eth_pool
brownie run --network $NETWORK_ID scripts/deploy_implementation.py erc20_vault
brownie run --network $NETWORK_ID scripts/deploy_implementation.py eth_vault
brownie run --network $NETWORK_ID scripts/deploy_implementation.py lp_token
brownie run --network $NETWORK_ID scripts/deploy_implementation.py staker_vault

if [ "$LIVE" = "false" ]; then
    TOKEN_NAME="Dai Stablecoin" TOKEN_SYMBOL="DAI" brownie run --network devnet scripts/deploy_dummy_token.py
    TOKEN_NAME="USD Coin" TOKEN_SYMBOL="USDC" brownie run --network devnet scripts/deploy_dummy_token.py
fi

POOL_NAME="bkddai" brownie run --network $NETWORK_ID scripts/deploy_pool.py
POOL_NAME="bkdeth" brownie run --network $NETWORK_ID scripts/deploy_pool.py
POOL_NAME="bkdusdc" brownie run --network $NETWORK_ID scripts/deploy_pool.py


brownie run --network $NETWORK_ID scripts/deploy_gas_bank.py
brownie run --network $NETWORK_ID scripts/deploy_top_up_handler.py aave
brownie run --network $NETWORK_ID scripts/deploy_top_up_handler.py compound

brownie run --network $NETWORK_ID scripts/deploy_top_up_action.py


LP_TOKEN="bkdDAI" brownie run --network $NETWORK_ID scripts/deploy_lp_gauge.py
LP_TOKEN="bkdETH" brownie run --network $NETWORK_ID scripts/deploy_lp_gauge.py
LP_TOKEN="bkdUSDC" brownie run --network $NETWORK_ID scripts/deploy_lp_gauge.py

LP_TOKEN="bkdDAI" brownie run --network $NETWORK_ID scripts/deploy_keeper_gauge.py
LP_TOKEN="bkdETH" brownie run --network $NETWORK_ID scripts/deploy_keeper_gauge.py
LP_TOKEN="bkdUSDC" brownie run --network $NETWORK_ID scripts/deploy_keeper_gauge.py

if [ "$LIVE" = "false" ]; then
    AMM_TOKEN="dummy" brownie run --network $NETWORK_ID scripts/deploy_amm_gauge.py
fi

INFLATION_FILE="config/inflation/initial_inflation.json" brownie run --network $NETWORK_ID scripts/setup_initial_inflation_weights_testnet.py

if [ "$LIVE" = "true" ]; then
    STRATEGY=dai brownie run --network $NETWORK_ID scripts/deploy_tri_hop_strategy.py
    STRATEGY=usdc brownie run --network $NETWORK_ID scripts/deploy_tri_hop_strategy.py
    brownie run --network $NETWORK_ID scripts/deploy_eth_cvx_strategy.py
fi
