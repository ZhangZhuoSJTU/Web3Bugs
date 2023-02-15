#!/usr/bin/env bash
set -e

while getopts t:r:b:v:c: flag
do
    case "${flag}" in
        t) test=${OPTARG};;
        r) runs=${OPTARG};;
        b) build=${OPTARG};;
        c) config=${OPTARG};;
    esac
done

runs=$([ -z "$runs" ] && echo "1" || echo "$runs")
build=$([ -z "$build" ] && echo "1" || echo "$build")
config=$([ -z "$config" ] && echo "./config/dev.json" || echo "$config")
skip_build=$([ "$build" == "0" ] && echo "1" || echo "0")

export DAPP_SOLC_VERSION=0.8.7
export DAPP_SRC="contracts"
export DAPP_LINK_TEST_LIBRARIES=0
export DAPP_STANDARD_JSON=$config

if [ "$skip_build" = "1" ]; then export DAPP_SKIP_BUILD=1; fi

if [ -z "$test" ]; then match="[contracts/test/*.t.sol]"; dapp_test_verbosity=1; else match=$test; dapp_test_verbosity=2; fi

echo LANG=C.UTF-8 dapp test --match "$match" --verbosity $dapp_test_verbosity --fuzz-runs $runs

LANG=C.UTF-8 dapp test --match "$match" --verbosity $dapp_test_verbosity --fuzz-runs $runs
