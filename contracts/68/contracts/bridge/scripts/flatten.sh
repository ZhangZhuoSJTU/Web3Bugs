#!/usr/bin/env bash
set -ex

mkdir -p flats
rm -f flats/*.sol

flat () {
  npx hardhat flatten contracts/$1 \
  | awk '/SPDX-License-Identifier/&&c++>0 {next} 1' \
  | awk '/pragma experimental ABIEncoderV2;/&&c++>0 {next} 1' \
  > "flats/$(basename -- $1)"
}

flat MintableERC20.sol > flats/MintableERC20.sol
