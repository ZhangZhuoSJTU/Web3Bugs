# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

docker-compose up -d
if [ $? -ne 0 ] ; then
    printf "${RED}docker-compose failed${NC}\n"
    exit -1
fi

echo "Starting Parity integration tests..."
# Wait for parity-integration-tests
PARITY_TEST_EXIT_CODE=`docker wait parity-integration-tests`
# Output parity-integration-tests logs
docker logs parity-integration-tests
# Check parity-integration-tests output
if [ -z ${PARITY_TEST_EXIT_CODE+x} ] || [ "$PARITY_TEST_EXIT_CODE" -ne 0 ] ; then
    printf "${RED}Parity integration tests failed${NC} - Exit Code: $PARITY_TEST_EXIT_CODE\n"
else
    printf "${GREEN}Parity integration tests passed${NC}\n"
fi

echo "Starting Geth integration tests..."
# Wait for geth-integration-tests
GETH_TEST_EXIT_CODE=`docker wait geth-integration-tests`
# Output geth-integration-tests logs
docker logs geth-integration-tests
# Check geth-integration-tests output
if [ -z ${GETH_TEST_EXIT_CODE+x} ] || [ "$GETH_TEST_EXIT_CODE" -ne 0 ] ; then
    printf "${RED}Geth integration tests failed${NC} - Exit Code: $GETH_TEST_EXIT_CODE\n"
else
    printf "${GREEN}Geth integration tests passed${NC}\n"
fi

# Clean up
docker-compose down

# If all tests passed return 0, else return 1
! (( $PARITY_TEST_EXIT_CODE | $GETH_TEST_EXIT_CODE ))
exit $?