#!/usr/bin/env bash

RPC_URL= # e.g. http://127.0.0.1:8545/
PRIVATE_KEY= 

CURRENT_MONTH_INFLATION_DATA=270000
PREVIOUS_MONTH_INFLATION_DATA=261900

CURRENT_CHANGE_RATE_BASIS_POINTS=309

# Mainnet chainlink data
JOB_ID=0x3666376662346162636564623438356162323765623762623339636166383237
ORACLE_ADDRESS=0x049bd8c3adc3fe7d3fc2a44541d955a537c2a484

# Pay 10 link
CHAINLINK_FEE=10000000000000000000

# First create ScalingPriceOracle
# Then OraclePassThrough

echo "params"
echo "$ORACLE_ADDRESS"
echo "$JOB_ID"
echo "$CHAINLINK_FEE"
echo "$CURRENT_MONTH_INFLATION_DATA"
echo "$PREVIOUS_MONTH_INFLATION_DATA"

SCALING_PRICE_ORACLE=$(forge create ScalingPriceOracle --constructor-args $ORACLE_ADDRESS $JOB_ID $CHAINLINK_FEE $CURRENT_MONTH_INFLATION_DATA $PREVIOUS_MONTH_INFLATION_DATA --rpc-url $RPC_URL --private-key $PRIVATE_KEY | grep 'Deployed to:' | awk '{print $NF}')
echo "1"

echo "SCALING_PRICE_ORACLE: $SCALING_PRICE_ORACLE"

ORACLE_PASS_THROUGH=$(forge create OraclePassThrough --constructor-args $SCALING_PRICE_ORACLE --rpc-url $RPC_URL --private-key $PRIVATE_KEY | grep 'Deployed to:' | awk '{print $NF}')

ACTUAL_CHANGE_RATE_BASIS_POINTS=$(cast call $SCALING_PRICE_ORACLE "getMonthlyAPR() external view returns (uint256)")

if [ "$ACTUAL_CHANGE_RATE_BASIS_POINTS" == "$CURRENT_CHANGE_RATE_BASIS_POINTS" ]; then
    echo " ~~~ Successfully Deployed Contracts ~~~ "
    echo ""
    echo "ORACLE_PASS_THROUGH=$ORACLE_PASS_THROUGH"
    echo "SCALING_PRICE_ORACLE=$SCALING_PRICE_ORACLE"
    echo ""
else
    echo "Contracts Not Deployed Successfully"
fi
