const WeightedPool2TokensFactory = {
  "abi": [
    {
      "inputs": [
        {
          "internalType": "contract IVault",
          "name": "vault",
          "type": "address"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "constructor"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "pool",
          "type": "address"
        }
      ],
      "name": "PoolCreated",
      "type": "event"
    },
    {
      "inputs": [
        {
          "internalType": "string",
          "name": "name",
          "type": "string"
        },
        {
          "internalType": "string",
          "name": "symbol",
          "type": "string"
        },
        {
          "internalType": "contract IERC20[]",
          "name": "tokens",
          "type": "address[]"
        },
        {
          "internalType": "uint256[]",
          "name": "weights",
          "type": "uint256[]"
        },
        {
          "internalType": "uint256",
          "name": "swapFeePercentage",
          "type": "uint256"
        },
        {
          "internalType": "bool",
          "name": "oracleEnabled",
          "type": "bool"
        },
        {
          "internalType": "address",
          "name": "owner",
          "type": "address"
        }
      ],
      "name": "create",
      "outputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "getPauseConfiguration",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "pauseWindowDuration",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "bufferPeriodDuration",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "getVault",
      "outputs": [
        {
          "internalType": "contract IVault",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "pool",
          "type": "address"
        }
      ],
      "name": "isPoolFromFactory",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    }
  ]
}

module.exports = {
  WeightedPool2TokensFactory: WeightedPool2TokensFactory
}
