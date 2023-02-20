#!/usr/bin/env bash
RPC_URL= # e.g. http://127.0.0.1:8545/
PRIVATE_KEY=

# Global Rate Limited Minter Params
GLOBAL_MAX_RATE_LIMIT_PER_SECOND=100000000000000000000000
PER_ADDRESS_MAX_RATE_LIMIT_PER_SECOND=15000000000000000000000

MAX_BUFFER_CAP=10000000000000000000000000
MAX_BUFFER_CAP_MULTI_RATE_LIMITED=100000000000000000000000000

# First create Core
# Then Global Rate Limited Minter

CORE=$(forge create Core --rpc-url $RPC_URL --private-key $PRIVATE_KEY | grep 'Deployed to:' | awk '{print $NF}')

cast send $CORE "init()" --rpc-url $RPC_URL --private-key $PRIVATE_KEY
VOLT=$(cast call $CORE "volt() external view returns (address)")

echo "Global Rate Limited Minter Params"
echo "$CORE"
echo "$GLOBAL_MAX_RATE_LIMIT_PER_SECOND"
echo "$PER_ADDRESS_MAX_RATE_LIMIT_PER_SECOND"
echo "$MAX_BUFFER_CAP"
echo "$MAX_BUFFER_CAP_MULTI_RATE_LIMITED"

GLOBAL_RATE_LIMITED_MINTER=$(forge create GlobalRateLimitedMinter --constructor-args $CORE $GLOBAL_MAX_RATE_LIMIT_PER_SECOND $PER_ADDRESS_MAX_RATE_LIMIT_PER_SECOND $PER_ADDRESS_MAX_RATE_LIMIT_PER_SECOND $MAX_BUFFER_CAP $MAX_BUFFER_CAP_MULTI_RATE_LIMITED --rpc-url $RPC_URL --private-key $PRIVATE_KEY | grep 'Deployed to:' | awk '{print $NF}')
cast send $CORE "grantMinter(address)" $GLOBAL_RATE_LIMITED_MINTER --rpc-url $RPC_URL --private-key $PRIVATE_KEY

IS_MINTER=$(cast call $CORE "isMinter(address) external view returns (bool)" $GLOBAL_RATE_LIMITED_MINTER)

if [ "$IS_MINTER" == "true" ]; then
    echo " ~~~ Successfully Deployed Contracts ~~~ "
    echo ""
    echo "CORE=$CORE"
    echo "GLOBAL_RATE_LIMITED_MINTER=$GLOBAL_RATE_LIMITED_MINTER"
    echo ""
else
    echo "Contracts Not Deployed Successfully"
fi
