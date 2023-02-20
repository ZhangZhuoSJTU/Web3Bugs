#!bin/bash

echo starting verify contact network $1.

truffle run verify ControllerV1 --network  $1
truffle run verify EthDexAggregatorV1 --network $1
truffle run verify LPool --network  $1
truffle run verify LPoolDepositor --network $1
truffle run verify OpenLevV1 --network  $1
truffle run verify QueryHelper --network $1
truffle run verify Timelock --network $1
truffle run verify XOLE --network $1
truffle run verify ControllerDelegator --network  $1
truffle run verify DexAggregatorDelegator --network $1
truffle run verify LPoolDelegator --network $1
truffle run verify OpenLevDelegator --network $1
truffle run verify XOLEDelegator --network $1



truffle run verify OLEToken --network  $1
truffle run verify GovernorAlpha --network  $1
truffle run verify Reserve --network  $1
truffle run verify TreasuryDelegator --network  $1
truffle run verify Treasury --network  $1
truffle run verify OLETokenLock --network  $1
truffle run verify FarmingPool --network  $1

echo finished verify contact network $1.
