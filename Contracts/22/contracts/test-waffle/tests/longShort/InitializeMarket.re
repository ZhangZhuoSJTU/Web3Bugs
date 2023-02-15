open LetOps;
open Mocha;
open Globals;

let testUnit =
    (
      ~contracts: ref(Helpers.coreContracts),
      ~accounts: ref(array(Ethers.Wallet.t)),
    ) => {
  describe("initializeMarket", () => {
    let stakerSmockedRef = ref(StakerSmocked.uninitializedValue);
    let longShortRef: ref(LongShort.t) = ref(""->Obj.magic);

    let sampleAddress = Ethers.Wallet.createRandom().address;

    let setup = (~marketIndex, ~marketIndexValue, ~latestMarket) => {
      let {longShort} = contracts^;
      longShortRef := longShort;
      let%Await smocked = StakerSmocked.make(contracts^.staker);
      let _ = smocked->StakerSmocked.mockAddNewStakingFundToReturn;
      stakerSmockedRef := smocked;
      let%Await _ = (longShortRef^)->LongShortSmocked.InternalMock.setup;
      let%Await _ =
        (longShortRef^)
        ->LongShortSmocked.InternalMock.setupFunctionForUnitTesting(
            ~functionName="initializeMarket",
          );

      let _ = LongShortSmocked.InternalMock.mock_seedMarketInitiallyToReturn();

      (longShortRef^)
      ->LongShort.Exposed.setInitializeMarketParams(
          ~marketIndex,
          ~marketIndexValue,
          ~latestMarket,
          ~staker=stakerSmockedRef^.address,
          ~longAddress=sampleAddress,
          ~shortAddress=sampleAddress,
        );
    };

    it(
      "calls all functions (staker.addNewStakingFund, adminOnly, seedMarketInitially) and mutates state (marketExists) correctly",
      () => {
        let%Await _ =
          setup(~marketIndex=1, ~marketIndexValue=false, ~latestMarket=1);
        let%Await _ =
          (longShortRef^)
          ->ContractHelpers.connect(~address=(accounts^)->Array.getUnsafe(0))
          ->LongShort.initializeMarket(
              ~marketIndex=1,
              ~kPeriod=Ethers.BigNumber.fromUnsafe("4"),
              ~kInitialMultiplier=
                Ethers.BigNumber.fromUnsafe("60000000000000000"),
              ~unstakeFee_e18=Ethers.BigNumber.fromUnsafe("5000000000000000"), // 0.5% or 50 basis points
              ~initialMarketSeedForEachMarketSide=CONSTANTS.tenToThe18,
              ~balanceIncentiveCurve_exponent=bnFromInt(5),
              ~balanceIncentiveCurve_equilibriumOffset=bnFromInt(0),
              ~marketTreasurySplitGradient_e18=bnFromInt(1),
            );

        let stakerCalls =
          (stakerSmockedRef^)->StakerSmocked.addNewStakingFundCalls;

        Chai.recordEqualFlatLabeled(
          ~expected=stakerCalls->Array.getExn(0),
          ~actual={
            kInitialMultiplier:
              Ethers.BigNumber.fromUnsafe("60000000000000000"),
            marketIndex: 1,
            longToken: sampleAddress,
            shortToken: sampleAddress,
            kPeriod: Ethers.BigNumber.fromUnsafe("4"),
            unstakeFee_e18: Ethers.BigNumber.fromUnsafe("5000000000000000"), // 0.5% or 50 basis points
            balanceIncentiveCurve_exponent: bnFromInt(5),
            balanceIncentiveCurve_equilibriumOffset: bnFromInt(0),
          },
        );

        let seedMarketInitiallyCalls =
          LongShortSmocked.InternalMock._seedMarketInitiallyCalls();

        Chai.recordEqualFlatLabeled(
          ~actual={
            marketIndex: 1,
            initialMarketSeedForEachMarketSide: CONSTANTS.tenToThe18,
          },
          ~expected=seedMarketInitiallyCalls->Array.getExn(0),
        );

        let%Await isMarket = (longShortRef^)->LongShort.marketExists(1);

        Chai.boolEqual(isMarket, true);
      },
    );
    it("reverts if market exists", () => {
      let%Await _ =
        setup(~marketIndex=1, ~marketIndexValue=true, ~latestMarket=1);
      let%Await _ =
        Chai.expectRevertNoReason(
          ~transaction=
            (longShortRef^)
            ->ContractHelpers.connect(
                ~address=(accounts^)->Array.getUnsafe(0),
              )
            ->LongShort.initializeMarket(
                ~marketIndex=1,
                ~kPeriod=Ethers.BigNumber.fromUnsafe("4"),
                ~kInitialMultiplier=
                  Ethers.BigNumber.fromUnsafe("60000000000000000"),
                ~unstakeFee_e18=
                  Ethers.BigNumber.fromUnsafe("5000000000000000"), // 0.5% or 50 basis points
                ~initialMarketSeedForEachMarketSide=CONSTANTS.tenToThe18,
                ~balanceIncentiveCurve_exponent=bnFromInt(5),
                ~balanceIncentiveCurve_equilibriumOffset=bnFromInt(0),
                ~marketTreasurySplitGradient_e18=bnFromInt(1),
              ),
        );
      ();
    });
    it("reverts if market index is greater than latest market index", () => {
      let%Await _ =
        setup(~marketIndex=1, ~marketIndexValue=false, ~latestMarket=1);
      let%Await _ =
        Chai.expectRevertNoReason(
          ~transaction=
            (longShortRef^)
            ->ContractHelpers.connect(
                ~address=(accounts^)->Array.getUnsafe(0),
              )
            ->LongShort.initializeMarket(
                ~marketIndex=2,
                ~kPeriod=Ethers.BigNumber.fromUnsafe("4"),
                ~kInitialMultiplier=
                  Ethers.BigNumber.fromUnsafe("60000000000000000"),
                ~unstakeFee_e18=
                  Ethers.BigNumber.fromUnsafe("5000000000000000"), // 0.5% or 50 basis points
                ~initialMarketSeedForEachMarketSide=CONSTANTS.tenToThe18,
                ~balanceIncentiveCurve_exponent=bnFromInt(5),
                ~balanceIncentiveCurve_equilibriumOffset=bnFromInt(0),
                ~marketTreasurySplitGradient_e18=bnFromInt(1),
              ),
        );
      ();
    });
  });
};

let testIntegration =
    (
      ~contracts: ref(Helpers.coreContracts),
      ~accounts as _: ref(array(Ethers.Wallet.t)),
    ) => {
  describe("initializeMarket", () => {
    it("Shouldn't allow initialization of a market that doesn't exist", () => {
      let nonExistantMarket = 654654;

      Chai.expectRevert(
        ~transaction=
          contracts.contents.longShort
          ->LongShort.initializeMarket(
              ~marketIndex=nonExistantMarket,
              ~kInitialMultiplier=CONSTANTS.oneBn,
              ~kPeriod=CONSTANTS.oneBn,
              ~unstakeFee_e18=Ethers.BigNumber.fromUnsafe("5000000000000000"), // 0.5% or 50 basis points
              ~initialMarketSeedForEachMarketSide=CONSTANTS.tenToThe18,
              ~balanceIncentiveCurve_exponent=bnFromInt(5),
              ~balanceIncentiveCurve_equilibriumOffset=bnFromInt(0),
              ~marketTreasurySplitGradient_e18=bnFromInt(1),
            ),
        ~reason="index too high",
      );
    });

    it(
      "Shouldn't allow initialization of a market that has already been initialized",
      () => {
      let {longShort, markets} = contracts.contents;
      let {marketIndex} = markets->Array.getUnsafe(0);

      Chai.expectRevert(
        ~transaction=
          longShort->LongShort.initializeMarket(
            ~marketIndex,
            ~kInitialMultiplier=CONSTANTS.oneBn,
            ~kPeriod=CONSTANTS.oneBn,
            ~unstakeFee_e18=Ethers.BigNumber.fromUnsafe("5000000000000000"), // 0.5% or 50 basis points
            ~initialMarketSeedForEachMarketSide=CONSTANTS.tenToThe18,
            ~balanceIncentiveCurve_exponent=bnFromInt(5),
            ~balanceIncentiveCurve_equilibriumOffset=bnFromInt(0),
            ~marketTreasurySplitGradient_e18=bnFromInt(1),
          ),
        ~reason="already initialized",
      );
    });

    it(
      "Shouldn't allow initialization with less than 0.1 eth units of payment token",
      () => {
      let {longShort, markets} = contracts.contents;
      let {paymentToken, oracleManager, yieldManager} =
        markets->Array.getUnsafe(0);

      let%Await _ =
        longShort->LongShort.createNewSyntheticMarket(
          ~syntheticName="Test",
          ~syntheticSymbol="T",
          ~paymentToken=paymentToken.address,
          ~oracleManager=oracleManager.address,
          ~yieldManager=yieldManager.address,
        );
      let%Await latestMarket = longShort->LongShort.latestMarket;

      Chai.expectRevert(
        ~transaction=
          longShort->LongShort.initializeMarket(
            ~marketIndex=latestMarket,
            ~kInitialMultiplier=CONSTANTS.tenToThe18,
            ~kPeriod=CONSTANTS.oneBn,
            ~unstakeFee_e18=Ethers.BigNumber.fromUnsafe("5000000000000000"), // 0.5% or 50 basis points
            ~initialMarketSeedForEachMarketSide=CONSTANTS.oneBn,
            ~balanceIncentiveCurve_exponent=bnFromInt(5),
            ~balanceIncentiveCurve_equilibriumOffset=bnFromInt(0),
            ~marketTreasurySplitGradient_e18=bnFromInt(1),
          ),
        ~reason="Insufficient market seed",
      );
    });
  });
};
