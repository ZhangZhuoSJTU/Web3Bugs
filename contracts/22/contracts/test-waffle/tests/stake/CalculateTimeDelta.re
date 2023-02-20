open LetOps;
open Mocha;

let test = (~contracts: ref(Helpers.coreContracts)) => {
  let marketIndex = Helpers.randomJsInteger();
  let latestMarketIndex = Helpers.randomInteger();

  describe("calculateTimeDelta", () => {
    it(
      "returns the time difference since the last reward state for a market",
      () => {
      let%Await pastTimestamp = Helpers.getRandomTimestampInPast();

      let%AwaitThen _ =
        contracts^.staker
        ->Staker.Exposed.setCalculateTimeDeltaParams(
            ~marketIndex,
            ~latestRewardIndexForMarket=latestMarketIndex,
            ~timestamp=pastTimestamp,
          );

      let%AwaitThen {timestamp: nowTimestampInt} = Helpers.getBlock();

      let expectedDelta =
        nowTimestampInt
        ->Ethers.BigNumber.fromInt
        ->Ethers.BigNumber.sub(pastTimestamp);

      let%Await delta =
        contracts^.staker
        ->Staker.Exposed._calculateTimeDeltaFromLastAccumulativeIssuancePerStakedSynthSnapshotExposed(
            ~marketIndex,
          );

      delta->Chai.bnEqual(expectedDelta);
    })
  });
};
