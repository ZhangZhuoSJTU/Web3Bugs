open Globals;
open LetOps;
open StakerHelpers;
open Mocha;

let test =
    (
      ~contracts: ref(Helpers.coreContracts),
      ~accounts: ref(array(Ethers.Wallet.t)),
    ) => {
  describe("mintAccumulatedFloat", () => {
    let marketIndex = Helpers.randomJsInteger();

    let (floatToMintLong, floatToMintShort, latestRewardIndexForMarket) =
      Helpers.Tuple.make3(Helpers.randomTokenAmount);

    let user = Helpers.randomAddress();

    let promiseRef: ref(JsPromise.t(ContractHelpers.transaction)) =
      ref(None->Obj.magic);

    let setup = (~floatToMintLong, ~floatToMintShort) => {
      let%AwaitThen _ =
        deployAndSetupStakerToUnitTest(
          ~functionName="mintAccumulatedFloat",
          ~contracts,
          ~accounts,
        );

      StakerSmocked.InternalMock.mock_calculateAccumulatedFloatToReturn(
        floatToMintLong->add(floatToMintShort),
      );

      StakerSmocked.InternalMock.mock_mintFloatToReturn();

      let%AwaitThen _ =
        contracts^.staker
        ->Staker.Exposed.setMintAccumulatedFloatAndClaimFloatParams(
            ~marketIndex,
            ~latestRewardIndexForMarket,
          );

      promiseRef :=
        contracts^.staker
        ->Staker.Exposed._mintAccumulatedFloatExposed(~marketIndex, ~user);

      let%Await _ = promiseRef^;
      promiseRef^;
    };

    describe("case floatToMint > 0", () => {
      before_once'(() => setup(~floatToMintLong, ~floatToMintShort));

      it("calls calculateAccumulatedFloat with correct arguments", () =>
        StakerSmocked.InternalMock._calculateAccumulatedFloatCalls()
        ->Array.getExn(0)
        ->Chai.recordEqualFlat(
            {
              {marketIndex, user};
            },
          )
      );

      it("calls mintFloat with correct arguments", () =>
        StakerSmocked.InternalMock._mintFloatCalls()
        ->Array.getExn(0)
        ->Chai.recordEqualFlat({
            user,
            floatToMint:
              floatToMintLong->Ethers.BigNumber.add(floatToMintShort),
          })
      );

      it("emits FloatMinted event", () => {
        Chai.callEmitEvents(
          ~call=promiseRef^,
          ~contract=contracts^.staker->Obj.magic,
          ~eventName="FloatMinted",
        )
        ->Chai.withArgs3(
            user,
            marketIndex,
            floatToMintLong->add(floatToMintShort),
          )
      });

      it("mutates userIndexOfLastClaimedReward", () => {
        let%Await lastClaimed =
          contracts^.staker
          ->Staker.userIndexOfLastClaimedReward(marketIndex, user);
        lastClaimed->Chai.bnEqual(latestRewardIndexForMarket);
      });
    });

    describe("case floatToMint == 0", () => {
      before_once'(() =>
        setup(
          ~floatToMintLong=CONSTANTS.zeroBn,
          ~floatToMintShort=CONSTANTS.zeroBn,
        )
      );

      it("calls calculateAccumulatedFloat with correct arguments", () =>
        StakerSmocked.InternalMock._calculateAccumulatedFloatCalls()
        ->Array.getExn(0)
        ->Chai.recordEqualFlat(
            {
              {marketIndex, user};
            },
          )
      );

      it("doesn't call mintFloat", () =>
        StakerSmocked.InternalMock._mintFloatCalls()
        ->Array.length
        ->Chai.intEqual(0)
      );

      it("doesn't mutate userIndexOfLastClaimed", () => {
        let%Await lastClaimed =
          contracts^.staker
          ->Staker.userIndexOfLastClaimedReward(marketIndex, user);
        lastClaimed->Chai.bnEqual(CONSTANTS.zeroBn); // bit hacky but won't have been set yet
      });

      it("doesn't emit FloatMinted event", () => {
        Chai.callEmitEvents(
          ~call=promiseRef^,
          ~contract=contracts^.staker->Obj.magic,
          ~eventName="FloatMinted",
        )
        ->Chai.expectToNotEmit
      });
    });
  });
};
