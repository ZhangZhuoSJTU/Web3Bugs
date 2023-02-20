const CoreCollectionABI =
  require('../artifacts/contracts/CoreCollection.sol/CoreCollection.json').abi;

const RoyaltyVaultABI =
  require('../artifacts/contracts/mock/MockRoyaltyVault.sol/MockRoyaltyVault.json').abi;

module.exports = {
  CoreCollectionABI,
  RoyaltyVaultABI,
};
