#!/bin/bash
set -eux
# the directory of this script, useful for allowing this script
# to be run with any PWD
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd $DIR
bash all-up-test.sh
bash all-up-test.sh VALSET_STRESS
bash all-up-test.sh BATCH_STRESS
bash all-up-test.sh HAPPY_PATH_V2
bash all-up-test.sh VALIDATOR_OUT
bash all-up-test.sh LONDON
if [ ! -z "$ALCHEMY_ID" ]; then
    bash all-up-test.sh ARBITRARY_LOGIC $ALCHEMY_ID
    bash all-up-test.sh RELAY_MARKET $ALCHEMY_ID
else
    echo "Alchemy API key not set under variable ALCHEMY_ID, not running ARBITRARY_LOGIC nor RELAY_MARKET"
fi
echo "All tests succeeded!"
