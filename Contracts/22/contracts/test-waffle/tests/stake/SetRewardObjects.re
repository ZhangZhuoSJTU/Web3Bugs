open Globals;
open LetOps;
open StakerHelpers;
open Mocha;

let test =
    (
      ~contracts: ref(Helpers.coreContracts),
      ~accounts: ref(array(Ethers.Wallet.t)),
    ) => {
  let promiseRef: ref(JsPromise.t(ContractHelpers.transaction)) =
    ref(None->Obj.magic);

  let timestampRef: ref(Ethers.BigNumber.t) = ref(CONSTANTS.zeroBn);

  let marketIndex = Helpers.randomJsInteger();

  let (
    longAccum,
    shortAccum,
    latestRewardIndexForMarket,
    longPrice,
    shortPrice,
    longValue,
    shortValue,
  ) =
    Helpers.Tuple.make7(Helpers.randomInteger);

  describe("setCurrentAccumulativeIssuancePerStakeStakedSynthSnapshot", () => {
    before_once'(() => {
      let%AwaitThen _ =
        deployAndSetupStakerToUnitTest(
          ~functionName="setCurrentAccumulativeIssuancePerStakeStakedSynthSnapshot",
          ~contracts,
          ~accounts,
        );
      StakerSmocked.InternalMock.mock_calculateNewCumulativeIssuancePerStakedSynthToReturn(
        longAccum,
        shortAccum,
      );

      let%AwaitThen _ =
        contracts^.staker
        ->Staker.Exposed.setSetRewardObjectsParams(
            ~marketIndex,
            ~latestRewardIndexForMarket,
          );

      let%Await {timestamp} = Helpers.getBlock();

      timestampRef := (timestamp + 1)->Ethers.BigNumber.fromInt; // one second per block

      promiseRef :=
        contracts^.staker
        ->Staker.Exposed._setCurrentAccumulativeIssuancePerStakeStakedSynthSnapshotExposed(
            ~marketIndex,
            ~longPrice,
            ~shortPrice,
            ~longValue,
            ~shortValue,
          );

      let%Await _ = promiseRef^;
      ();
    });

    it(
      "calls calculateNewCumulativeIssuancePerStakedSynth with correct arguments",
      () => {
      StakerSmocked.InternalMock._calculateNewCumulativeIssuancePerStakedSynthCalls()
      ->Array.getExn(0)
      ->Chai.recordEqualFlat({
          marketIndex,
          longPrice,
          shortPrice,
          longValue,
          shortValue,
        })
    });

    let mutatedIndex =
      latestRewardIndexForMarket->Ethers.BigNumber.add(CONSTANTS.oneBn);

    it("mutates latestRewardIndex", () => {
      let%Await latestRewardIndex =
        contracts^.staker->Staker.latestRewardIndex(marketIndex);

      latestRewardIndex->Chai.bnEqual(mutatedIndex);
    });

    it("mutates accumulativeFloatPerSyntheticTokenSnapshots", () => {
      let%Await rewardParams =
        contracts^.staker
        ->Staker.accumulativeFloatPerSyntheticTokenSnapshots(
            marketIndex,
            mutatedIndex,
          );

      rewardParams->Chai.recordEqualFlat({
        timestamp: timestampRef^,
        accumulativeFloatPerSyntheticToken_long: longAccum,
        accumulativeFloatPerSyntheticToken_short: shortAccum,
      });
    });
    it("emits AccumulativeIssuancePerStakedSynthSnapshotCreated event", () => {
      Chai.callEmitEvents(
        ~call=promiseRef^,
        ~contract=contracts^.staker->Obj.magic,
        ~eventName="AccumulativeIssuancePerStakedSynthSnapshotCreated",
      )
      ->Chai.withArgs4(marketIndex, mutatedIndex, longAccum, shortAccum)
    });
  });
};
