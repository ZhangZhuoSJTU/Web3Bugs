#!/usr/bin/env bash

set -eo pipefail

contract_size() {
	NAME=$1
	ARGS=${@:2}
	# select the filename and the contract in it
	PATTERN=".contracts[\"src/$NAME.sol\"].$NAME"

  dapp build # first, build the contract

	# get the bytecode from the compiled file
	BYTECODE=0x$(jq -r "$PATTERN.evm.bytecode.object" out/dapp.sol.json)
	length=$(echo "$BYTECODE" | wc -m)
	echo $(($length / 2))
}

if [[ -z $contract ]]; then
  if [[ -z ${1} ]];then
    echo '"$contract" env variable is not set. Set it to the name of the contract you want to estimate size for.'
    exit 1
  else
    contract=${1}
  fi
fi

contract_size=$(contract_size ${contract})
echo "Contract Name: ${contract}"
echo "Contract Size: ${contract_size} bytes"
echo
echo "$(( 24576 - ${contract_size} )) bytes left to reach the smart contract size limit of 24576 bytes."
