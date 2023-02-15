module.exports = {
  mocha: {
    grep: '@skip-on-coverage', // Find everything with this tag
    invert: true, // Run the grep's inverse set.
  },
  istanbulFolder: './coverage',
  istanbulReporter: ['html', 'text'],
  skipFiles: [
    'util/ERC20Mock.sol',
    'util/SherDistributionMock.sol',
    'util/SherlockMock.sol',
    'util/SherlockProtocolManagerMock.sol',
    'util/StrategyMock.sol',
    'test/SherlockProtocolManagerTest.sol',
    'test/SherlockTest.sol',
  ],
};
