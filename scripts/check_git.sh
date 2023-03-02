#!/bin/bash

if [ "$#" -ne 1 ]; then
    echo "Usage: ./check_git.sh <web3bugs.dir>"
    exit 1
fi

WEB3BUGS_PATH=$(realpath $1)
if [ "${#WEB3BUGS_PATH}" -eq 0 ]; then
    echo "invalid path: " $1
    exit 1
fi


CONTRACTS_PATH=$WEB3BUGS_PATH/contracts
find $CONTRACTS_PATH -name ".git*"
if [ "$?" -ne 0 ]; then
    echo $CONTRACTS_PATH ": it is an invalid path or some .git files are left there"
    exit 1
fi
