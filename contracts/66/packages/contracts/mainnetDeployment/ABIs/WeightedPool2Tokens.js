const WeightedPool2Tokens = {
  "abi": [
    {
      "inputs": [
        {
          "components": [
            {
              "internalType": "contract IVault",
              "name": "vault",
              "type": "address"
            },
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
              "internalType": "contract IERC20",
              "name": "token0",
              "type": "address"
            },
            {
              "internalType": "contract IERC20",
              "name": "token1",
              "type": "address"
            },
            {
              "internalType": "uint256",
              "name": "normalizedWeight0",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "normalizedWeight1",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "swapFeePercentage",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "pauseWindowDuration",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "bufferPeriodDuration",
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
          "internalType": "struct WeightedPool2Tokens.NewPoolParams",
          "name": "params",
          "type": "tuple"
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
          "name": "owner",
          "type": "address"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "spender",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "value",
          "type": "uint256"
        }
      ],
      "name": "Approval",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": false,
          "internalType": "bool",
          "name": "enabled",
          "type": "bool"
        }
      ],
      "name": "OracleEnabledChanged",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": false,
          "internalType": "bool",
          "name": "paused",
          "type": "bool"
        }
      ],
      "name": "PausedStateChanged",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "swapFeePercentage",
          "type": "uint256"
        }
      ],
      "name": "SwapFeePercentageChanged",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "from",
          "type": "address"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "to",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "value",
          "type": "uint256"
        }
      ],
      "name": "Transfer",
      "type": "event"
    },
    {
      "inputs": [],
      "name": "DOMAIN_SEPARATOR",
      "outputs": [
        {
          "internalType": "bytes32",
          "name": "",
          "type": "bytes32"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "owner",
          "type": "address"
        },
        {
          "internalType": "address",
          "name": "spender",
          "type": "address"
        }
      ],
      "name": "allowance",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "spender",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "amount",
          "type": "uint256"
        }
      ],
      "name": "approve",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "account",
          "type": "address"
        }
      ],
      "name": "balanceOf",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "decimals",
      "outputs": [
        {
          "internalType": "uint8",
          "name": "",
          "type": "uint8"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "spender",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "amount",
          "type": "uint256"
        }
      ],
      "name": "decreaseAllowance",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "enableOracle",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "bytes4",
          "name": "selector",
          "type": "bytes4"
        }
      ],
      "name": "getActionId",
      "outputs": [
        {
          "internalType": "bytes32",
          "name": "",
          "type": "bytes32"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "getAuthorizer",
      "outputs": [
        {
          "internalType": "contract IAuthorizer",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "getInvariant",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "getLargestSafeQueryWindow",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "pure",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "getLastInvariant",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "enum IPriceOracle.Variable",
          "name": "variable",
          "type": "uint8"
        }
      ],
      "name": "getLatest",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "getMiscData",
      "outputs": [
        {
          "internalType": "int256",
          "name": "logInvariant",
          "type": "int256"
        },
        {
          "internalType": "int256",
          "name": "logTotalSupply",
          "type": "int256"
        },
        {
          "internalType": "uint256",
          "name": "oracleSampleCreationTimestamp",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "oracleIndex",
          "type": "uint256"
        },
        {
          "internalType": "bool",
          "name": "oracleEnabled",
          "type": "bool"
        },
        {
          "internalType": "uint256",
          "name": "swapFeePercentage",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "getNormalizedWeights",
      "outputs": [
        {
          "internalType": "uint256[]",
          "name": "",
          "type": "uint256[]"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "getOwner",
      "outputs": [
        {
          "internalType": "address",
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
          "components": [
            {
              "internalType": "enum IPriceOracle.Variable",
              "name": "variable",
              "type": "uint8"
            },
            {
              "internalType": "uint256",
              "name": "ago",
              "type": "uint256"
            }
          ],
          "internalType": "struct IPriceOracle.OracleAccumulatorQuery[]",
          "name": "queries",
          "type": "tuple[]"
        }
      ],
      "name": "getPastAccumulators",
      "outputs": [
        {
          "internalType": "int256[]",
          "name": "results",
          "type": "int256[]"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "getPausedState",
      "outputs": [
        {
          "internalType": "bool",
          "name": "paused",
          "type": "bool"
        },
        {
          "internalType": "uint256",
          "name": "pauseWindowEndTime",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "bufferPeriodEndTime",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "getPoolId",
      "outputs": [
        {
          "internalType": "bytes32",
          "name": "",
          "type": "bytes32"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "getRate",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "index",
          "type": "uint256"
        }
      ],
      "name": "getSample",
      "outputs": [
        {
          "internalType": "int256",
          "name": "logPairPrice",
          "type": "int256"
        },
        {
          "internalType": "int256",
          "name": "accLogPairPrice",
          "type": "int256"
        },
        {
          "internalType": "int256",
          "name": "logBptPrice",
          "type": "int256"
        },
        {
          "internalType": "int256",
          "name": "accLogBptPrice",
          "type": "int256"
        },
        {
          "internalType": "int256",
          "name": "logInvariant",
          "type": "int256"
        },
        {
          "internalType": "int256",
          "name": "accLogInvariant",
          "type": "int256"
        },
        {
          "internalType": "uint256",
          "name": "timestamp",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "getSwapFeePercentage",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "components": [
            {
              "internalType": "enum IPriceOracle.Variable",
              "name": "variable",
              "type": "uint8"
            },
            {
              "internalType": "uint256",
              "name": "secs",
              "type": "uint256"
            },
            {
              "internalType": "uint256",
              "name": "ago",
              "type": "uint256"
            }
          ],
          "internalType": "struct IPriceOracle.OracleAverageQuery[]",
          "name": "queries",
          "type": "tuple[]"
        }
      ],
      "name": "getTimeWeightedAverage",
      "outputs": [
        {
          "internalType": "uint256[]",
          "name": "results",
          "type": "uint256[]"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "getTotalSamples",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "pure",
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
          "name": "spender",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "addedValue",
          "type": "uint256"
        }
      ],
      "name": "increaseAllowance",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "name",
      "outputs": [
        {
          "internalType": "string",
          "name": "",
          "type": "string"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "owner",
          "type": "address"
        }
      ],
      "name": "nonces",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "bytes32",
          "name": "poolId",
          "type": "bytes32"
        },
        {
          "internalType": "address",
          "name": "sender",
          "type": "address"
        },
        {
          "internalType": "address",
          "name": "recipient",
          "type": "address"
        },
        {
          "internalType": "uint256[]",
          "name": "balances",
          "type": "uint256[]"
        },
        {
          "internalType": "uint256",
          "name": "lastChangeBlock",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "protocolSwapFeePercentage",
          "type": "uint256"
        },
        {
          "internalType": "bytes",
          "name": "userData",
          "type": "bytes"
        }
      ],
      "name": "onExitPool",
      "outputs": [
        {
          "internalType": "uint256[]",
          "name": "",
          "type": "uint256[]"
        },
        {
          "internalType": "uint256[]",
          "name": "",
          "type": "uint256[]"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "bytes32",
          "name": "poolId",
          "type": "bytes32"
        },
        {
          "internalType": "address",
          "name": "sender",
          "type": "address"
        },
        {
          "internalType": "address",
          "name": "recipient",
          "type": "address"
        },
        {
          "internalType": "uint256[]",
          "name": "balances",
          "type": "uint256[]"
        },
        {
          "internalType": "uint256",
          "name": "lastChangeBlock",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "protocolSwapFeePercentage",
          "type": "uint256"
        },
        {
          "internalType": "bytes",
          "name": "userData",
          "type": "bytes"
        }
      ],
      "name": "onJoinPool",
      "outputs": [
        {
          "internalType": "uint256[]",
          "name": "amountsIn",
          "type": "uint256[]"
        },
        {
          "internalType": "uint256[]",
          "name": "dueProtocolFeeAmounts",
          "type": "uint256[]"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "components": [
            {
              "internalType": "enum IVault.SwapKind",
              "name": "kind",
              "type": "uint8"
            },
            {
              "internalType": "contract IERC20",
              "name": "tokenIn",
              "type": "address"
            },
            {
              "internalType": "contract IERC20",
              "name": "tokenOut",
              "type": "address"
            },
            {
              "internalType": "uint256",
              "name": "amount",
              "type": "uint256"
            },
            {
              "internalType": "bytes32",
              "name": "poolId",
              "type": "bytes32"
            },
            {
              "internalType": "uint256",
              "name": "lastChangeBlock",
              "type": "uint256"
            },
            {
              "internalType": "address",
              "name": "from",
              "type": "address"
            },
            {
              "internalType": "address",
              "name": "to",
              "type": "address"
            },
            {
              "internalType": "bytes",
              "name": "userData",
              "type": "bytes"
            }
          ],
          "internalType": "struct IPoolSwapStructs.SwapRequest",
          "name": "request",
          "type": "tuple"
        },
        {
          "internalType": "uint256",
          "name": "balanceTokenIn",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "balanceTokenOut",
          "type": "uint256"
        }
      ],
      "name": "onSwap",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "owner",
          "type": "address"
        },
        {
          "internalType": "address",
          "name": "spender",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "value",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "deadline",
          "type": "uint256"
        },
        {
          "internalType": "uint8",
          "name": "v",
          "type": "uint8"
        },
        {
          "internalType": "bytes32",
          "name": "r",
          "type": "bytes32"
        },
        {
          "internalType": "bytes32",
          "name": "s",
          "type": "bytes32"
        }
      ],
      "name": "permit",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "bytes32",
          "name": "poolId",
          "type": "bytes32"
        },
        {
          "internalType": "address",
          "name": "sender",
          "type": "address"
        },
        {
          "internalType": "address",
          "name": "recipient",
          "type": "address"
        },
        {
          "internalType": "uint256[]",
          "name": "balances",
          "type": "uint256[]"
        },
        {
          "internalType": "uint256",
          "name": "lastChangeBlock",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "protocolSwapFeePercentage",
          "type": "uint256"
        },
        {
          "internalType": "bytes",
          "name": "userData",
          "type": "bytes"
        }
      ],
      "name": "queryExit",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "bptIn",
          "type": "uint256"
        },
        {
          "internalType": "uint256[]",
          "name": "amountsOut",
          "type": "uint256[]"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "bytes32",
          "name": "poolId",
          "type": "bytes32"
        },
        {
          "internalType": "address",
          "name": "sender",
          "type": "address"
        },
        {
          "internalType": "address",
          "name": "recipient",
          "type": "address"
        },
        {
          "internalType": "uint256[]",
          "name": "balances",
          "type": "uint256[]"
        },
        {
          "internalType": "uint256",
          "name": "lastChangeBlock",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "protocolSwapFeePercentage",
          "type": "uint256"
        },
        {
          "internalType": "bytes",
          "name": "userData",
          "type": "bytes"
        }
      ],
      "name": "queryJoin",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "bptOut",
          "type": "uint256"
        },
        {
          "internalType": "uint256[]",
          "name": "amountsIn",
          "type": "uint256[]"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "bool",
          "name": "paused",
          "type": "bool"
        }
      ],
      "name": "setPaused",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "swapFeePercentage",
          "type": "uint256"
        }
      ],
      "name": "setSwapFeePercentage",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "symbol",
      "outputs": [
        {
          "internalType": "string",
          "name": "",
          "type": "string"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "totalSupply",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "recipient",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "amount",
          "type": "uint256"
        }
      ],
      "name": "transfer",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "sender",
          "type": "address"
        },
        {
          "internalType": "address",
          "name": "recipient",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "amount",
          "type": "uint256"
        }
      ],
      "name": "transferFrom",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "function"
    }
  ]
}

module.exports = {
    WeightedPool2Tokens: WeightedPool2Tokens
}
