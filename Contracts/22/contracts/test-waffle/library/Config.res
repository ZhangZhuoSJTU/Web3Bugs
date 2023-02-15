@module("dotenv") external configEnv: unit => unit = "config"

configEnv()

@val
external optRunValueSimulations: option<string> = "process.env.RUN_VALUE_SIMULATIONS"
let runValueSimulations =
  optRunValueSimulations->Option.getWithDefault("false")->Js.String2.toLowerCase == "true"

@val
external optDontRunIntegrationTests: option<string> = "process.env.DONT_RUN_INTEGRATION_TESTS"
let dontRunIntegrationTests =
  optDontRunIntegrationTests->Option.getWithDefault("false")->Js.String2.toLowerCase == "true"

@val
external optDontRunUnitTests: option<string> = "process.env.DONT_RUN_UNIT_TESTS"
let dontRunUnitTests =
  optDontRunUnitTests->Option.getWithDefault("false")->Js.String2.toLowerCase == "true"

// The CI flag is set to true by defualt inside gh-actions: https://github.blog/changelog/2020-04-15-github-actions-sets-the-ci-environment-variable-to-true/
@val
external optIsCI: option<string> = "process.env.CI"
let isCI = optIsCI->Option.getWithDefault("false")->Js.String2.toLowerCase == "true"
