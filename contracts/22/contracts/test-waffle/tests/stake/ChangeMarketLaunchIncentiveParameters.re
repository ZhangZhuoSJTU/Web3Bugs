open Globals;
open LetOps;
open Mocha;

let test =
    (
      ~contracts: ref(Helpers.coreContracts),
      ~accounts: ref(array(Ethers.Wallet.t)),
    ) => {
  let marketIndex = 2;
  let period = Helpers.randomInteger();

  describe("changeMarketLaunchIncentiveParameters (external)", () => {
    let initialMultiplier = Helpers.randomInteger();

    let setup = () => {
      let%AwaitThen _ = contracts^.staker->StakerSmocked.InternalMock.setup;

      let%AwaitThen _ =
        contracts^.staker
        ->StakerSmocked.InternalMock.setupFunctionForUnitTesting(
            ~functionName="changeMarketLaunchIncentiveParameters",
          );

      StakerSmocked.InternalMock.mock_changeMarketLaunchIncentiveParametersToReturn();

      contracts^.staker
      ->Staker.Exposed.changeMarketLaunchIncentiveParameters(
          ~marketIndex,
          ~period,
          ~initialMultiplier,
        );
    };

    before_each(() => setup());

    it_skip("calls the onlyAdminModifier", () => {
      // StakerSmocked.InternalMock.onlyAdminCalls()
      // ->Array.length
      // ->Chai.intEqual(1)
      ()
    });

    it(
      "calls _changeMarketLaunchIncentiveParameters with correct arguments", () => {
      StakerSmocked.InternalMock._changeMarketLaunchIncentiveParametersCalls()
      ->Array.getUnsafe(0)
      ->Chai.recordEqualFlat({marketIndex, period, initialMultiplier})
    });

    it("emits MarketLaunchIncentiveParametersChanges event", () => {
      Chai.callEmitEvents(
        ~call=setup(),
        ~contract=contracts^.staker->Obj.magic,
        ~eventName="MarketLaunchIncentiveParametersChanges",
      )
      ->Chai.withArgs3(marketIndex, period, initialMultiplier)
    });
  });

  describe("_changeMarketLaunchIncentiveParameters (internal)", () => {
    let initialMultiplierFine =
      Helpers.randomInteger()->Ethers.BigNumber.mul(CONSTANTS.tenToThe18);
    let initialMultiplierNotFine = CONSTANTS.oneBn;

    let changeMarketLaunchIncentiveParametersCall = ref(None->Obj.magic);

    let setup = (~initialMultiplier) => {
      let%Await deployedContracts =
        Helpers.initialize(
          ~admin=accounts.contents->Array.getUnsafe(0),
          ~exposeInternals=true,
        );
      let {staker} = deployedContracts;
      contracts := deployedContracts;
      changeMarketLaunchIncentiveParametersCall :=
        staker->Staker.Exposed._changeMarketLaunchIncentiveParametersExposed(
          ~marketIndex,
          ~period,
          ~initialMultiplier,
        );
    };

    describe("passing transaction", () => {
      before_each(() => {
        let%AwaitThen _ = setup(~initialMultiplier=initialMultiplierFine);
        changeMarketLaunchIncentiveParametersCall.contents;
      });

      it("mutates marketLaunchIncentive_period", () => {
        let%Await setPeriod =
          contracts^.staker->Staker.marketLaunchIncentive_period(marketIndex);

        period->Chai.bnEqual(setPeriod);
      });

      it("mutates marketLaunchIncentiveMultiplier", () => {
        let%Await setMultiplier =
          contracts^.staker
          ->Staker.marketLaunchIncentive_multipliers(marketIndex);

        initialMultiplierFine->Chai.bnEqual(setMultiplier);
      });
    });

    describe("failing transaction", () => {
      before_once'(() => {
        setup(~initialMultiplier=initialMultiplierNotFine)
      });
      it("reverts if initialMultiplier < 1e18", () => {
        let%Await _ =
          Chai.expectRevert(
            ~transaction=changeMarketLaunchIncentiveParametersCall^,
            ~reason="marketLaunchIncentiveMultiplier must be >= 1e18",
          );
        ();
      });
    });
  });
};
