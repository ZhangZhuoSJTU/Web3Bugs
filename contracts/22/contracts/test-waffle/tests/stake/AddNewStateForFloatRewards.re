open Globals;
open LetOps;
open Mocha;

let testUnit =
    (
      ~contracts: ref(Helpers.stakerUnitTestContracts),
      ~accounts as _: ref(array(Ethers.Wallet.t)),
    ) => {
  let marketIndex = Helpers.randomJsInteger();
  let (longPrice, shortPrice, longValue, shortValue, timeDeltaGreaterThanZero) =
    Helpers.Tuple.make5(Helpers.randomInteger);

  describe("pushUpdatedMarketPricesToUpdateFloatIssuanceCalculations", () => {
    before_once'(() => {
      contracts.contents.staker
      ->StakerSmocked.InternalMock.setupFunctionForUnitTesting(
          ~functionName=
            "pushUpdatedMarketPricesToUpdateFloatIssuanceCalculations",
        )
    });

    let setup =
        (
          ~stakerTokenShiftIndex_to_longShortMarketPriceSnapshotIndex_mappingIfShiftExecuted,
          ~timeDelta,
        ) => {
      StakerSmocked.InternalMock.mock_calculateTimeDeltaFromLastAccumulativeIssuancePerStakedSynthSnapshotToReturn(
        timeDelta,
      );

      contracts.contents.staker
      ->Staker.pushUpdatedMarketPricesToUpdateFloatIssuanceCalculations(
          ~marketIndex,
          ~longPrice,
          ~shortPrice,
          ~longValue,
          ~shortValue,
          ~stakerTokenShiftIndex_to_longShortMarketPriceSnapshotIndex_mappingIfShiftExecuted,
        );
    };

    describe("modifiers", () =>
      it("calls the onlyLongShort modifier", () => {
        let%Await _ =
          contracts.contents.staker
          ->Staker.pushUpdatedMarketPricesToUpdateFloatIssuanceCalculations(
              ~marketIndex,
              ~longPrice,
              ~shortPrice,
              ~longValue,
              ~shortValue,
              ~stakerTokenShiftIndex_to_longShortMarketPriceSnapshotIndex_mappingIfShiftExecuted=zeroBn,
            );

        StakerSmocked.InternalMock.onlyLongShortModifierLogicCalls()
        ->Array.length
        ->Chai.intEqual(1);
      })
    );

    describe("case timeDelta > 0", () => {
      let stakerTokenShiftIndex_to_longShortMarketPriceSnapshotIndex_mappingIfShiftExecuted =
        Helpers.randomTokenAmount();

      before_once'(() =>
        setup(
          ~timeDelta=timeDeltaGreaterThanZero,
          ~stakerTokenShiftIndex_to_longShortMarketPriceSnapshotIndex_mappingIfShiftExecuted,
        )
      );

      it("calls calculateTimeDelta with correct arguments", () => {
        StakerSmocked.InternalMock._calculateTimeDeltaFromLastAccumulativeIssuancePerStakedSynthSnapshotCalls()
        ->Chai.recordArrayDeepEqualFlat([|{marketIndex: marketIndex}|])
      });

      it(
        "calls setCurrentAccumulativeIssuancePerStakeStakedSynthSnapshot with correct arguments",
        () => {
        StakerSmocked.InternalMock._setCurrentAccumulativeIssuancePerStakeStakedSynthSnapshotCalls()
        ->Chai.recordArrayDeepEqualFlat([|
            {marketIndex, longPrice, shortPrice, longValue, shortValue},
          |])
      });
    });

    describe(
      "case stakerTokenShiftIndex_to_longShortMarketPriceSnapshotIndex_mappingIfShiftExecuted > 0",
      () => {
        let batched_stakerNextTokenShiftIndex = Helpers.randomInteger();
        let latestRewardIndex = Helpers.randomInteger();
        let stakerTokenShiftIndex_to_longShortMarketPriceSnapshotIndex_mappingIfShiftExecuted =
          Helpers.randomInteger();
        let pushUpdatedMarketPricesToUpdateFloatIssuanceCalculationsTxPromise =
          ref("Not set yet"->Obj.magic);

        before_once'(() => {
          let%Await _ =
            contracts.contents.staker
            ->Staker.Exposed.setAddNewStateForFloatRewardsGlobals(
                ~marketIndex,
                ~batched_stakerNextTokenShiftIndex,
                ~latestRewardIndex,
              );

          pushUpdatedMarketPricesToUpdateFloatIssuanceCalculationsTxPromise :=
            setup(
              ~timeDelta=timeDeltaGreaterThanZero,
              ~stakerTokenShiftIndex_to_longShortMarketPriceSnapshotIndex_mappingIfShiftExecuted,
            );

          pushUpdatedMarketPricesToUpdateFloatIssuanceCalculationsTxPromise.
            contents;
        });

        it(
          "updates takerTokenShiftIndex_to_longShortMarketPriceSnapshotIndex_mapping to the 'stakerTokenShiftIndex_to_longShortMarketPriceSnapshotIndex_mappingIfShiftExecuted' value recieved from long short",
          () => {
            let%Await takerTokenShiftIndex_to_longShortMarketPriceSnapshotIndex_mapping =
              contracts.contents.staker
              ->Staker.stakerTokenShiftIndex_to_longShortMarketPriceSnapshotIndex_mapping(
                  batched_stakerNextTokenShiftIndex,
                );
            Chai.bnEqual(
              takerTokenShiftIndex_to_longShortMarketPriceSnapshotIndex_mapping,
              stakerTokenShiftIndex_to_longShortMarketPriceSnapshotIndex_mappingIfShiftExecuted,
            );
          },
        );

        it(
          "increments the stakerTokenShiftIndex_to_accumulativeFloatIssuanceSnapshotIndex_mapping",
          () => {
            let%Await stakerTokenShiftIndex_to_accumulativeFloatIssuanceSnapshotIndex_mapping =
              contracts.contents.staker
              ->Staker.stakerTokenShiftIndex_to_accumulativeFloatIssuanceSnapshotIndex_mapping(
                  batched_stakerNextTokenShiftIndex,
                );
            Chai.bnEqual(
              stakerTokenShiftIndex_to_accumulativeFloatIssuanceSnapshotIndex_mapping,
              latestRewardIndex->add(oneBn),
            );
          },
        );

        it("increments the batched_stakerNextTokenShiftIndex", () => {
          let%Await updatedNextTokenShiftIndex =
            contracts.contents.staker
            ->Staker.batched_stakerNextTokenShiftIndex(marketIndex);
          Chai.bnEqual(
            updatedNextTokenShiftIndex,
            batched_stakerNextTokenShiftIndex->add(oneBn),
          );
        });

        it("emits the SyntheticTokensShifted event", () => {
          Chai.callEmitEvents(
            ~call=
              pushUpdatedMarketPricesToUpdateFloatIssuanceCalculationsTxPromise.
                contents,
            ~contract=contracts.contents.staker->Obj.magic,
            ~eventName="SyntheticTokensShifted",
          )
          ->Chai.withArgs0
        });
      },
    );

    describe("case timeDelta == 0", () => {
      it(
        "doesn't call setCurrentAccumulativeIssuancePerStakeStakedSynthSnapshot",
        () => {
        let%Await _ =
          setup(
            ~timeDelta=CONSTANTS.zeroBn,
            ~stakerTokenShiftIndex_to_longShortMarketPriceSnapshotIndex_mappingIfShiftExecuted=zeroBn,
          );
        StakerSmocked.InternalMock._setCurrentAccumulativeIssuancePerStakeStakedSynthSnapshotCalls()
        ->Chai.recordArrayDeepEqualFlat([||]);
      })
    });
  });
};
