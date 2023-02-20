#!/usr/bin/env bash

configsPath="test/evm-versions"

declare -a versions=(
                    "istanbul"
                    "berlin"
                    )

for version in "${versions[@]}"
do
  echo "Building and testing for EVM version: $version"
  rm -rf build
  waffle compile "$configsPath/waffle-$version.json" || {
    echo "Error: build failed for EVM version: $version"
    exit 1
  }
  mocha || {
   echo "Error: tests failed for EVM version: $version"
   exit 1
  }
done
