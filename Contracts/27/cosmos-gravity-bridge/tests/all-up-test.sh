#!/bin/bash
set -eux
# the directory of this script, useful for allowing this script
# to be run with any PWD
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# builds the container containing various system deps
# also builds Gravity once in order to cache Go deps, this container
# must be rebuilt every time you run this test if you want a faster
# solution use start chains and then run tests
bash $DIR/build-container.sh

# Remove existing container instance
set +e
docker rm -f gravity_all_up_test_instance
set -e

NODES=3
set +u
TEST_TYPE=$1
ALCHEMY_ID=$2
set -u

# Run new test container instance
docker run --name gravity_all_up_test_instance --cap-add=NET_ADMIN -t gravity-base /bin/bash /gravity/tests/container-scripts/all-up-test-internal.sh $NODES $TEST_TYPE $ALCHEMY_ID
