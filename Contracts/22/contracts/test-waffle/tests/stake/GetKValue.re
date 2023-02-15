open Globals;
open LetOps;
open StakerHelpers;
open Mocha;

let test =
    (
      ~contracts: ref(Helpers.coreContracts),
      ~accounts: ref(array(Ethers.Wallet.t)),
    ) => {
  let marketIndex = 2;

  let prom: ref(JsPromise.t(Staker.Exposed._getKValueExposedReturn)) =
    ref(None->Obj.magic);

  let multiplier =
    Helpers.randomInteger()->Ethers.BigNumber.add(CONSTANTS.tenToThe18);
  describe("getKValue", () => {
    let diffRef = ref(CONSTANTS.zeroBn);
    let periodRef = ref(CONSTANTS.zeroBn);
    let setup = (~multiplier, ~periodShouldBeOver) => {
      let%AwaitThen _ =
        deployAndSetupStakerToUnitTest(
          ~functionName="getKValue",
          ~contracts,
          ~accounts,
        );

      let%AwaitThen pastTimestamp = Helpers.getRandomTimestampInPast();
      let%AwaitThen {timestamp: nowTimestamp} = Helpers.getBlock();

      diffRef :=
        (nowTimestamp + 1) // will be called one sec in future
        ->Ethers.BigNumber.fromInt
        ->Ethers.BigNumber.sub(pastTimestamp);

      let period =
        (diffRef^)
        ->(
            diff =>
              if (periodShouldBeOver) {
                diff->Ethers.BigNumber.sub(20->Ethers.BigNumber.fromInt);
              } else {
                diff->Ethers.BigNumber.add(20->Ethers.BigNumber.fromInt);
              }
          );

      periodRef := period;

      let%Await _ =
        contracts^.staker
        ->Staker.Exposed.setGetKValueParams(
            ~marketIndex,
            ~timestamp=pastTimestamp,
          );
      StakerSmocked.InternalMock.mock_getMarketLaunchIncentiveParametersToReturn(
        period,
        multiplier,
      );

      prom :=
        contracts^.staker->Staker.Exposed._getKValueExposed(~marketIndex);
    };

    it(
      "returns  kInitialMultiplier -
                (((kInitialMultiplier - 1e18) *
                    (block.timestamp - initialTimestamp)) / kPeriod) if kPeriod isn't over",
      () => {
        let%AwaitThen _ = setup(~multiplier, ~periodShouldBeOver=false);
        let%Await returnVal = prom^;
        returnVal->Chai.bnEqual(
          multiplier->Ethers.BigNumber.sub(
            (diffRef^)
            ->Ethers.BigNumber.mul(
                multiplier->Ethers.BigNumber.sub(CONSTANTS.tenToThe18),
              )
            ->Ethers.BigNumber.div(periodRef^),
          ),
        );
      },
    );

    it("reverts if kInitialMultiplier less than 1e18", () => {
      let%Await _ =
        setup(~multiplier=CONSTANTS.oneBn, ~periodShouldBeOver=true);
      Chai.expectRevertNoReason(~transaction=(prom^)->Obj.magic);
    });
    describe("", () => {
      // TESTING TWO THINGS
      before_once'(() => {setup(~multiplier, ~periodShouldBeOver=true)});

      it(
        "returns 1e18 if more seconds have passed than the kPeriod since the staking fund for the market was added",
        () => {
          let%Await returnVal = prom^;
          returnVal->Chai.bnEqual(CONSTANTS.tenToThe18);
        },
      );

      it("calls getMarketLaunchIncentiveParameters with correct arguments", () => {
        StakerSmocked.InternalMock._getMarketLaunchIncentiveParametersCalls()
        ->Array.getExn(0)
        ->Chai.recordEqualFlat({marketIndex: marketIndex})
      });
    });
  });
};
