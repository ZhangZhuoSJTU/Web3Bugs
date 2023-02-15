#!/bin/env zx
const path = require('path');
const fs = require('fs');

$.verbose = false;

const USAGE = 'flatten.mjs CONTRACT_TO_FLATTEN.sol'
const contractPath = argv._[1];
if (!contractPath) {
    console.error(USAGE);
    process.exit(1);
}
const contractName = path.basename(contractPath).split('.sol')[0];
const outputFile = path.join('flattened', contractName + '.flat');

const lines = (await $`npx hardhat flatten ${contractPath}`).stdout.split('\n');
let licenseCount = 0;

// filter out all license identifiers except the first one
const filteredLines = lines.map(line => {
    let _line = line;
    if (line.startsWith('// SPDX-License-Identifier')) {
        licenseCount += 1;
        if (licenseCount > 1) {
            _line = '';
        }
    }
    return _line;
});

const sourceString = filteredLines.join('\n');
fs.writeFileSync(outputFile, sourceString);

