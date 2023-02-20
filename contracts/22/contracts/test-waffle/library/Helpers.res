open Globals
type markets = {
  paymentToken: ERC20Mock.t,
  oracleManager: OracleManagerMock.t,
  yieldManager: YieldManagerMock.t,
  longSynth: SyntheticToken.t,
  shortSynth: SyntheticToken.t,
  marketIndex: int,
}
type coreContracts = {
  floatCapital_v0: FloatCapital_v0.t,
  tokenFactory: TokenFactory.t,
  treasury: Treasury_v0.t,
  floatToken: FloatToken.t,
  staker: Staker.t,
  longShort: LongShort.t,
  markets: array<markets>,
}

module Tuple = {
  let make2 = fn => (fn(), fn())
  let make3 = fn => (fn(), fn(), fn())
  let make4 = fn => (fn(), fn(), fn(), fn())
  let make5 = fn => (fn(), fn(), fn(), fn(), fn())
  let make6 = fn => (fn(), fn(), fn(), fn(), fn(), fn())
  let make7 = fn => (fn(), fn(), fn(), fn(), fn(), fn(), fn())
  let make8 = fn => (fn(), fn(), fn(), fn(), fn(), fn(), fn(), fn())
}

@ocaml.doc(`Generates random BigNumber between 1 and 2147483647 (max js int)`)
let randomInteger = () => Js.Math.random_int(1, Js.Int.max)->Ethers.BigNumber.fromInt

@ocaml.doc(`Generates a random JS integer between 0 and 2147483647 (max js int)`)
let randomJsInteger = () => Js.Math.random_int(0, Js.Int.max)

let randomRatio1e18 = () =>
  bnFromString(
    Js.Math.random_int(0, 1000000000)->Int.toString ++
      Js.Math.random_int(0, 1000000000)->Int.toString,
  )

let adjustNumberRandomlyWithinRange = (~basisPointsMin, ~basisPointsMax, number) => {
  let numerator = Js.Math.random_int(basisPointsMin, basisPointsMax)->bnFromInt

  number->add(number->mul(numerator)->div(bnFromInt(100000)))
}

@ocaml.doc(`Generates random BigNumber between 0.01 and 21474836.47 of a token (10^18 in BigNumber units)`)
let randomTokenAmount = () =>
  randomInteger()->Ethers.BigNumber.mul(Ethers.BigNumber.fromUnsafe("10000000000000000"))

type mint =
  | Long(Ethers.BigNumber.t)
  | Short(Ethers.BigNumber.t)
  | Both(Ethers.BigNumber.t, Ethers.BigNumber.t)

let randomMintLongShort = () => {
  switch Js.Math.random_int(0, 3) {
  | 0 => Long(randomTokenAmount())
  | 1 => Short(randomTokenAmount())
  | 2
  | _ =>
    Both(randomTokenAmount(), randomTokenAmount())
  }
}

let randomAddress = () => Ethers.Wallet.createRandom().address

let createSyntheticMarket = (
  ~admin,
  ~initialMarketSeedForEachMarketSide=CONSTANTS.tenToThe18,
  ~paymentToken: ERC20Mock.t,
  ~treasury,
  ~marketName,
  ~marketSymbol,
  longShort: LongShort.t,
) => {
  JsPromise.all3((
    OracleManagerMock.make(~admin),
    YieldManagerMock.make(~longShort=longShort.address, ~token=paymentToken.address, ~treasury),
    paymentToken
    ->ERC20Mock.mint(~_to=admin, ~amount=initialMarketSeedForEachMarketSide->mul(bnFromInt(100)))
    ->JsPromise.then(_ =>
      paymentToken->ERC20Mock.approve(
        ~spender=longShort.address,
        ~amount=initialMarketSeedForEachMarketSide->mul(bnFromInt(100)),
      )
    ),
  ))->JsPromise.then(((oracleManager, yieldManager, _)) => {
    let _ignorePromise =
      paymentToken
      ->ERC20Mock.mINTER_ROLE
      ->JsPromise.map(minterRole =>
        paymentToken->ERC20Mock.grantRole(~role=minterRole, ~account=yieldManager.address)
      )
    longShort
    ->LongShort.createNewSyntheticMarket(
      ~syntheticName=marketName,
      ~syntheticSymbol=marketSymbol,
      ~paymentToken=paymentToken.address,
      ~oracleManager=oracleManager.address,
      ~yieldManager=yieldManager.address,
    )
    ->JsPromise.then(_ => longShort->LongShort.latestMarket)
    ->JsPromise.then(marketIndex => {
      longShort->LongShort.initializeMarket(
        ~marketIndex,
        ~kInitialMultiplier=Ethers.BigNumber.fromUnsafe("1000000000000000000"),
        ~kPeriod=Ethers.BigNumber.fromInt(0),
        ~unstakeFee_e18=Ethers.BigNumber.fromInt(50),
        ~initialMarketSeedForEachMarketSide,
        ~balanceIncentiveCurve_exponent=bnFromInt(5),
        ~balanceIncentiveCurve_equilibriumOffset=bnFromInt(0),
        ~marketTreasurySplitGradient_e18=bnFromInt(1),
      )
    })
  })
}

let getAllMarkets = longShort => {
  longShort
  ->LongShort.latestMarket
  ->JsPromise.then(nextMarketIndex => {
    let marketIndex = nextMarketIndex

    Belt.Array.range(1, marketIndex)
    ->Array.map(marketIndex =>
      JsPromise.all5((
        longShort
        ->LongShort.syntheticTokens(marketIndex, true /* long */)
        ->JsPromise.then(SyntheticToken.at),
        longShort
        ->LongShort.syntheticTokens(marketIndex, false /* short */)
        ->JsPromise.then(SyntheticToken.at),
        longShort->LongShort.paymentTokens(marketIndex)->JsPromise.then(ERC20Mock.at),
        longShort->LongShort.oracleManagers(marketIndex)->JsPromise.then(OracleManagerMock.at),
        longShort->LongShort.yieldManagers(marketIndex)->JsPromise.then(YieldManagerMock.at),
      ))->JsPromise.map(((longSynth, shortSynth, paymentToken, oracleManager, yieldManager)) => {
        {
          paymentToken: paymentToken,
          oracleManager: oracleManager,
          yieldManager: yieldManager,
          longSynth: longSynth,
          shortSynth: shortSynth,
          marketIndex: marketIndex,
        }
      })
    )
    ->JsPromise.all
  })
}

let initialize = (~admin: Ethers.Wallet.t, ~exposeInternals: bool) => {
  JsPromise.all6((
    FloatCapital_v0.make(),
    Treasury_v0.make(),
    FloatToken.make(),
    exposeInternals ? Staker.Exposed.make() : Staker.make(),
    exposeInternals ? LongShort.Exposed.make() : LongShort.make(),
    JsPromise.all2((
      ERC20Mock.make(~name="Pay Token 1", ~symbol="PT1"),
      ERC20Mock.make(~name="Pay Token 2", ~symbol="PT2"),
    )),
  ))->JsPromise.then(((
    floatCapital,
    treasury,
    floatToken,
    staker,
    longShort,
    (payToken1, payToken2),
  )) => {
    TokenFactory.make(~longShort=longShort.address)->JsPromise.then(tokenFactory => {
      JsPromise.all4((
        floatToken->FloatToken.initializeFloatToken(
          ~name="Float token",
          ~symbol="FLOAT TOKEN",
          ~stakerAddress=staker.address,
        ),
        treasury->Treasury_v0.initialize(~admin=admin.address),
        longShort->LongShort.initialize(
          ~admin=admin.address,
          ~treasury=treasury.address,
          ~tokenFactory=tokenFactory.address,
          ~staker=staker.address,
        ),
        staker->Staker.initialize(
          ~admin=admin.address,
          ~longShort=longShort.address,
          ~floatToken=floatToken.address,
          ~floatCapital=floatCapital.address,
          // NOTE: for now using the floatCapital address as the float treasury
          ~floatTreasury=floatCapital.address,
          ~floatPercentage=bnFromString("250000000000000000"),
        ),
      ))
      ->JsPromise.then(_ => {
        [payToken1, payToken1, payToken2, payToken1]
        ->Array.reduceWithIndex(JsPromise.resolve(), (previousPromise, paymentToken, index) => {
          previousPromise->JsPromise.then(() =>
            longShort->createSyntheticMarket(
              ~admin=admin.address,
              ~treasury=treasury.address,
              ~paymentToken,
              ~marketName=`Test Market ${index->Int.toString}`,
              ~marketSymbol=`TM${index->Int.toString}`,
            )
          )
        })
        ->JsPromise.then(_ => {
          longShort->getAllMarkets
        })
      })
      ->JsPromise.map(markets => {
        staker: staker,
        longShort: longShort,
        floatToken: floatToken,
        tokenFactory: tokenFactory,
        treasury: treasury,
        markets: markets,
        floatCapital_v0: floatCapital,
      })
    })
  })
}

type stakerUnitTestContracts = {
  staker: Staker.t,
  longShort: LongShort.t,
  floatToken: FloatToken.t,
  syntheticToken: SyntheticToken.t,
  longShortSmocked: LongShortSmocked.t,
  floatTokenSmocked: FloatTokenSmocked.t,
  syntheticTokenSmocked: SyntheticTokenSmocked.t,
}

let initializeStakerUnit = () => {
  JsPromise.all4((
    Staker.Exposed.make(),
    LongShort.make(),
    FloatToken.make(),
    SyntheticToken.make(
      ~name="baseTestSyntheticToken",
      ~symbol="BTST",
      ~longShort=CONSTANTS.zeroAddress,
      ~staker=CONSTANTS.zeroAddress,
      ~marketIndex=0,
      ~isLong=false,
    ),
  ))->JsPromise.then(((staker, longShort, floatToken, syntheticToken)) => {
    JsPromise.all4((
      staker->StakerSmocked.InternalMock.setup,
      longShort->LongShortSmocked.make,
      floatToken->FloatTokenSmocked.make,
      syntheticToken->SyntheticTokenSmocked.make,
    ))->JsPromise.map(((_, longShortSmocked, floatTokenSmocked, syntheticTokenSmocked)) => {
      staker: staker,
      longShort: longShort,
      floatToken: floatToken,
      syntheticToken: syntheticToken,
      longShortSmocked: longShortSmocked,
      floatTokenSmocked: floatTokenSmocked,
      syntheticTokenSmocked: syntheticTokenSmocked,
    })
  })
}

type longShortUnitTestContracts = {
  staker: Staker.t,
  longShort: LongShort.t,
  floatToken: FloatToken.t,
  syntheticToken: SyntheticToken.t,
  tokenFactory: TokenFactory.t,
  yieldManager: YieldManagerAave.t,
  oracleManager: OracleManagerMock.t,
  stakerSmocked: StakerSmocked.t,
  floatTokenSmocked: FloatTokenSmocked.t,
  syntheticTokenSmocked: SyntheticTokenSmocked.t,
  tokenFactorySmocked: TokenFactorySmocked.t,
  yieldManagerSmocked: YieldManagerAaveSmocked.t,
  oracleManagerSmocked: OracleManagerMockSmocked.t,
}

let initializeLongShortUnit = () => {
  ERC20Mock.make(~name="Pay Token 1", ~symbol="PT1")->JsPromise.then(paymentToken =>
    JsPromise.all7((
      LongShort.Exposed.make(),
      Staker.make(),
      FloatToken.make(),
      TokenFactory.make(~longShort=CONSTANTS.zeroAddress),
      YieldManagerAave.make(
        ~longShort=CONSTANTS.zeroAddress,
        ~treasury=CONSTANTS.zeroAddress,
        ~paymentToken=paymentToken.address,
        ~aToken=CONSTANTS.zeroAddress,
        ~lendingPool=randomAddress(),
        ~aaveIncentivesController=randomAddress(),
        ~aaveReferralCode=0,
      ),
      OracleManagerMock.make(~admin=CONSTANTS.zeroAddress),
      SyntheticToken.make(
        ~name="baseTestSyntheticToken",
        ~symbol="BTST",
        ~longShort=CONSTANTS.zeroAddress,
        ~staker=CONSTANTS.zeroAddress,
        ~marketIndex=0,
        ~isLong=false,
      ),
    ))->JsPromise.then(((
      longShort,
      staker,
      floatToken,
      tokenFactory,
      yieldManager,
      oracleManager,
      syntheticToken,
    )) => {
      JsPromise.all7((
        longShort->LongShortSmocked.InternalMock.setup,
        staker->StakerSmocked.make,
        floatToken->FloatTokenSmocked.make,
        syntheticToken->SyntheticTokenSmocked.make,
        tokenFactory->TokenFactorySmocked.make,
        yieldManager->YieldManagerAaveSmocked.make,
        oracleManager->OracleManagerMockSmocked.make,
      ))->JsPromise.map(((
        _,
        stakerSmocked,
        floatTokenSmocked,
        syntheticTokenSmocked,
        tokenFactorySmocked,
        yieldManagerSmocked,
        oracleManagerSmocked,
      )) => {
        staker: staker,
        longShort: longShort,
        floatToken: floatToken,
        syntheticToken: syntheticToken,
        tokenFactory: tokenFactory,
        yieldManager: yieldManager,
        oracleManager: oracleManager,
        stakerSmocked: stakerSmocked,
        floatTokenSmocked: floatTokenSmocked,
        yieldManagerSmocked: yieldManagerSmocked,
        oracleManagerSmocked: oracleManagerSmocked,
        syntheticTokenSmocked: syntheticTokenSmocked,
        tokenFactorySmocked: tokenFactorySmocked,
      })
    })
  )
}

let increaseTime: int => JsPromise.t<
  unit,
> = %raw(`(seconds) => ethers.provider.send("evm_increaseTime", [seconds])`)

type block = {timestamp: int}
let getBlock: unit => JsPromise.t<block> = %raw(`() => ethers.provider.getBlock()`)

let getRandomTimestampInPast = () => {
  getBlock()->JsPromise.then(({timestamp}) => {
    (timestamp - Js.Math.random_int(200, 630720000))->Ethers.BigNumber.fromInt->JsPromise.resolve
  })
}
