/*
  Put any synchronous global setup that you need done before mocha runs here.
*/

module SeedRandom = {
  type t
  @module external make: string => t = "seedrandom"
}

module Random = {
  type t
  @module("random") external use: SeedRandom.t => unit = "use"

  @module("random") external replaceJsRng: unit => unit = "patch"
}

module Wallet = {
  type mnemonic = {phrase: string}
  type t = {mnemonic: mnemonic}

  @module("ethers") @scope("Wallet") @val
  external createRandom: unit => t = "createRandom"

  @module("ethers") @scope("Wallet") @val
  external fromMnemonic: (string, string, string) => t = "fromMnemonic"

  module Generator = {
    let fromMnemonic = mnemonic => {
      let counter = ref(-1)
      () => {
        counter := counter.contents + 1
        fromMnemonic(mnemonic, `m/44'/60'/${counter.contents->Int.toString}'/0/0`, "en")
      }
    }
  }

  let replaceCreateRandom: (unit => t) => unit = %raw("(fn) => {
    require('ethers').Wallet.createRandom = fn;
  }")
}

let seedTestRng = seed => {
  // Limitation:
  //  if you run only some tests, then you'll
  //  be lucky to get the same random value for a particular random val
  //  as if you ran all of them (number of global calls matters)

  // Replace Math.random with a seeded one.
  Random.use(seed->SeedRandom.make)
  Random.replaceJsRng()

  // Make ethers.Wallet.createRandom use the mnemonic
  Wallet.Generator.fromMnemonic(seed)->Wallet.replaceCreateRandom
}

// called in hardhat.config.js
let mochaSetup = () => {
  // 1. replace rng sources with seeded ones

  let seed =
    Node.Process.process["env"]
    ->Js.Dict.get("TEST_SEED_MNEMONIC") // set this in the shell if wanting to test a particular seed, or hardcode it here
    ->Option.flatMap(str =>
      if str->String.length > 0 {
        Some(str)
      } else {
        None
      }
    )
    ->Option.getWithDefault(Wallet.createRandom().mnemonic.phrase)

  seedTestRng(seed)

  Js.log(`Running tests with random seed: "${seed}"`)
}
