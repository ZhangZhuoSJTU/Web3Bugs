#!/bin/bash

if [ $# -ne 1 ]; then
    echo "usage: $0 <contract-file>"
    exit 1
fi

contract_name=$(basename $1 .sol)
filename=$(mktemp /tmp/$contract_name.XXX.sol)


yarn -s hardhat flatten $1 > $filename
sed -i -e '/SPDX/d' $filename -e '1 i \
// SPDX-License-Identifier: GPL-3.0-or-later'

echo $filename
