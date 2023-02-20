#!/bin/bash
TEST_TYPE=$1
set -eu

set +u
OPTIONAL_KEY=""
if [ ! -z $2 ];
    then OPTIONAL_KEY="$2"
fi
set -u

# Run test entry point script
docker exec gravity_test_instance /bin/sh -c "pushd /gravity/ && tests/container-scripts/integration-tests.sh 1 $TEST_TYPE $OPTIONAL_KEY"
