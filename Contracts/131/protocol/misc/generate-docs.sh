#!/bin/bash

read -r -d '' SOLC_SETTINGS <<-EOF
{
  "optimizer": {
    "enabled": true,
    "runs": 200
  },
  "remappings": [
    "OpenZeppelin=$PWD/packages/OpenZeppelin",
    "interfaces=$PWD/interfaces"
  ]
}
EOF

solidity-docgen --solc-settings="$SOLC_SETTINGS"
