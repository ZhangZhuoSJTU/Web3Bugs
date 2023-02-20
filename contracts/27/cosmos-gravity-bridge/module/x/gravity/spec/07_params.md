<!--
order: 7
-->

# Parameters

The gravity module contains the following parameters:

| Key                           | Type         | Example        |
|-------------------------------|--------------|----------------|
| gravityId                       | string       | "gravity"        |
| ContractSourceHash            | string       | "special hash" |
| BridgeEthereumAddress         | string       | "0x1"          |
| BridgeChainId                 | uint64       | 4              |
| SignedValsetsWindow           | uint64       | 10_000         |
| SignedBatchesWindow           | uint64       | 10_000         |
| SignedClaimsWindow            | uint64       | 10_000         |
| TargetBatchTimeout            | uint64       | 43_200_000     |
| AverageBlockTime              | uint64       | 5_000          |
| AverageEthereumBlockTime      | uint64       | 15_000         |
| SlashFractionValset           | sdkTypes.Dec | -              |
| SlashFractionBatch            | sdkTypes.Dec | -              |
| SlashFractionClaim            | sdkTypes.Dec | -              |
| SlashFractionConflictingClaim | sdkTypes.Dec | -              |
| UnbondSlashingValsetsWindow   | uint64       | 3              |
| UnbondSlashingBatchWindow     | uint64       | 3              |
