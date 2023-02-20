let coverageReportOutputDirectory = "coverage-truffle"

let extraFilesToIgnore = []
let isWaffleTest =
  !!process.env.WAFFLE_TEST && process.env.WAFFLE_TEST.toUpperCase() == "TRUE"
if (isWaffleTest) {
  let isUnitTests =
    !!process.env.DONT_RUN_INTEGRATION_TESTS && process.env.DONT_RUN_INTEGRATION_TESTS.toUpperCase() == "TRUE"
  let isIntegrationTests =
    !!process.env.DONT_RUN_UNIT_TESTS && process.env.DONT_RUN_UNIT_TESTS.toUpperCase() == "TRUE"
  if (!isUnitTests && !isIntegrationTests) { // if it is neither then it is both (wierd logic but it works)
    coverageReportOutputDirectory = "coverage-all"
  } else if (isUnitTests) {
    coverageReportOutputDirectory = "coverage-unit"
    extraFilesToIgnore = [
      "FloatToken.sol",
      "SyntheticToken.sol",
      "TokenFactory.sol",
      "Treasury_v0.sol",
    ]
  } else if (isIntegrationTests) {
    coverageReportOutputDirectory = "coverage-integration"
  } else {
    throw Error("Invalid config, don't set both 'DONT_RUN_INTEGRATION_TESTS' and 'DONT_RUN_UNIT_TESTS' to true")
  }
}

module.exports = {
  skipFiles: [
    "Migrations.sol",
    "FloatCapital_v0.sol",
    "Treasury_v0.sol",

    "interfaces/IBandOracle.sol",
    "interfaces/IFloatToken.sol",
    "interfaces/ILongShort.sol",
    "interfaces/IOracleManager.sol",
    "interfaces/IStaker.sol",
    "interfaces/ISyntheticToken.sol",
    "interfaces/ITokenFactory.sol",
    "interfaces/IYieldManager.sol",
    "interfaces/aave/DataTypes.sol",
    "interfaces/aave/ILendingPool.sol",
    "interfaces/aave/ILendingPoolAddressesProvider.sol",
    "interfaces/aave/IAaveIncentivesController.sol",

    "mocks/BandOracleMock.sol",
    "mocks/Dai.sol",
    "mocks/MockERC20.sol",
    "mocks/OracleManagerMock.sol",
    "mocks/YieldManagerMock.sol",
    "mocks/AggregatorV3Mock.sol",
    "mocks/ERC20Mock.sol",
    "mocks/LendingPoolAaveMock.sol",
    "mocks/IAaveIncentivesController.sol",

    "oracles/OracleManagerBand.sol",
    "oracles/OracleManagerChainlink.sol",
    "oracles/OracleManagerEthKiller.sol",
    "oracles/OracleManagerEthKillerChainlink.sol",
    "oracles/OracleManagerEthKillerChainlinkTestnet.sol",
    "oracles/OracleManagerEthVsBtc.sol",
    "oracles/OracleManagerFlippening_V0.sol",

    "testing/StakerInternalStateSetters.sol",
    "testing/LongShortInternalStateSetters.sol",

    "testing/generated/LongShortForInternalMocking.sol",
    "testing/generated/StakerForInternalMocking.sol",
    "testing/generated/LongShortMockable.sol",
    "testing/generated/StakerMockable.sol"
  ].concat(extraFilesToIgnore),
  istanbulFolder: coverageReportOutputDirectory,
};

