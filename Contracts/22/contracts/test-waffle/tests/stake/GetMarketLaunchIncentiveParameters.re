open LetOps;
open Mocha;

let test = (~contracts: ref(Helpers.coreContracts)) => {
  describe("getMarketLaunchParameters", () => {
    let marketIndex = 5;

    let initialMultiplier =
      CONSTANTS.tenToThe18->Ethers.BigNumber.add(Helpers.randomInteger());
    let initialPeriod = Helpers.randomInteger();

    let test =
        (
          ~initialMultiplier,
          ~initialPeriod,
          ~expectedMultiplier,
          ~expectedPeriod,
          (),
        ) => {
      let%AwaitThen _ =
        contracts^.staker
        ->Staker.Exposed.setGetMarketLaunchIncentiveParametersParams(
            ~marketIndex,
            ~multiplier=initialMultiplier,
            ~period=initialPeriod,
          );
      let%Await result =
        contracts^.staker
        ->Staker.Exposed._getMarketLaunchIncentiveParametersExposed(
            ~marketIndex,
          );

      let period = result->Obj.magic->Array.getExn(0);
      let multiplier = result->Obj.magic->Array.getExn(1);
      period->Chai.bnEqual(expectedPeriod);
      multiplier->Chai.bnEqual(expectedMultiplier);
    };

    it(
      "returns kPeriod and kInitialMultiplier correctly for a market once set",
      test(
        ~initialMultiplier,
        ~initialPeriod,
        ~expectedMultiplier=initialMultiplier,
        ~expectedPeriod=initialPeriod,
      ),
    );

    it(
      "if kInitialMultiplier is zero then returns 1e18 as multiplier",
      test(
        ~initialMultiplier=CONSTANTS.zeroBn,
        ~initialPeriod,
        ~expectedMultiplier=CONSTANTS.tenToThe18,
        ~expectedPeriod=initialPeriod,
      ),
    );
  });
};
