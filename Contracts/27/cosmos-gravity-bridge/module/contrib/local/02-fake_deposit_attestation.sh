#!/bin/bash
set -eu

echo "## Add ETH key"
gravitycli tx gravity update-eth-addr 0xb8662f35f9de8720424e82b232e8c98d15399490adae9ca993f5ef1dc4883690 --from validator  --chain-id=testing -b block -y

echo "## Submit observation"
nonce=$(date +%s)  # use unix timestamp as fake nonce
# chain id: 1
# bridge contract address: 0x8858eeb3dfffa017d4bce9801d340d36cf895ccf
# erc20 token contract address: 0x7c2c195cd6d34b8f845992d380aadb2730bb9c6f
# erc20 symbol: ALX
# amount: 100
# gravitycli tx gravity observed deposit [eth chain id] [eth contract address] [nonce] [cosmos receiver] [amount] [eth erc20 symbol] [eth erc20 contract addr] [eth sender address] [flags]
gravitycli tx gravity observed deposit 1 0x8858eeb3dfffa017d4bce9801d340d36cf895ccf  "$nonce" $(gravitycli keys show validator -a)  1000 ALX 0xc783df8a850f42e7f7e57013759c285caa701eb6 0x7c2c195cd6d34b8f845992d380aadb2730bb9c6f --from validator --chain-id=testing -b block -y

echo "## Query balance"
gravitycli q account $(gravitycli keys show validator -a)
echo "## Query last observed state"
gravitycli q gravity observed nonces -o json