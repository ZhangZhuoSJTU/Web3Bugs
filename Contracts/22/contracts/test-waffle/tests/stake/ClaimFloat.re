open Globals;
open LetOps;
open StakerHelpers;
open Mocha;

let makeIterator = anyArray => {
  let indexRef = ref(0);
  () => {
    let index = indexRef^;
    indexRef := (index + 1) mod anyArray->Array.length;
    anyArray->Array.getExn(index);
  };
};

let smockedCalcAccumIterativeBinding = [%raw
  {|(_r, arr) => _r.smocked._calculateAccumulatedFloatMock.will.return.with(makeIterator(arr))|}
];

// smocked allows functions to be passed as return vals,
// this is a simple binding to allow for repeated calls.
let iterativeMockCalculateAccumulatedFloatToReturn:
  array(Ethers.BigNumber.t) => unit =
  arr => {
    let _ =
      StakerSmocked.InternalMock.internalRef.contents
      ->Option.map(_r => smockedCalcAccumIterativeBinding(_r, arr));
    ();
  };

let test =
    (
      ~contracts: ref(Helpers.coreContracts),
      ~accounts: ref(array(Ethers.Wallet.t)),
    ) => {
  describe("_mintAccumulatedFloatMulti", () => {
    let marketIndices = [|
      Helpers.randomJsInteger(),
      Helpers.randomJsInteger(),
    |];

    let latestRewardIndices = [|
      Helpers.randomInteger(),
      Helpers.randomInteger(),
    |];

    let floatRewardsForMarkets = [|Helpers.randomTokenAmount(), zeroBn|];

    let sumFloatRewards = floatRewards =>
      floatRewards->Array.reduce(CONSTANTS.zeroBn, (prev, curr) => {
        prev->Ethers.BigNumber.add(curr)
      });

    let userWalletRef: ref(Ethers.Wallet.t) = ref(None->Obj.magic);
    let promiseRef: ref(JsPromise.t(ContractHelpers.transaction)) =
      ref(None->Obj.magic);

    let setup =
        (~marketIndices, ~latestRewardIndices, ~floatRewardsForMarkets) => {
      let%Await _ =
        deployAndSetupStakerToUnitTest(
          ~functionName="_mintAccumulatedFloatMulti",
          ~contracts,
          ~accounts,
        );

      userWalletRef := accounts.contents->Array.getUnsafe(5);

      iterativeMockCalculateAccumulatedFloatToReturn(floatRewardsForMarkets);

      StakerSmocked.InternalMock.mock_mintFloatToReturn();

      let%Await _ =
        marketIndices->Array.reduceWithIndex(
          ()->JsPromise.resolve,
          (lastPromise, marketIndex, arrayIndex) => {
            let%AwaitThen _ = lastPromise;
            contracts^.staker
            ->Staker.Exposed.setMintAccumulatedFloatAndClaimFloatParams(
                ~marketIndex,
                ~latestRewardIndexForMarket=
                  latestRewardIndices->Array.getUnsafe(arrayIndex),
              );
          },
        );
      promiseRef :=
        contracts^.staker
        ->ContractHelpers.connect(~address=userWalletRef^)
        ->Staker.Exposed._mintAccumulatedFloatMultiExposed(
            ~marketIndexes=marketIndices,
            ~user=userWalletRef.contents.address,
          );

      promiseRef^;
    };

    describe("case at least one market has float to be minted", () => {
      before_once'(() =>
        setup(~marketIndices, ~floatRewardsForMarkets, ~latestRewardIndices)
      );

      it("calls mint float for user with correct arguments", () => {
        StakerSmocked.InternalMock._mintFloatCalls()
        ->Array.getExn(0)
        ->Chai.recordEqualFlat({
            user: userWalletRef^.address,
            floatToMint: sumFloatRewards(floatRewardsForMarkets),
          })
      });

      describe("case market has float to mint", () => {
        it("calls calculateAccumulatedFloat with correct arguments", () =>
          StakerSmocked.InternalMock._calculateAccumulatedFloatCalls()
          ->Array.getExn(0)
          ->Chai.recordEqualFlat({
              marketIndex: marketIndices->Array.getUnsafe(0),
              user: userWalletRef^.address,
            })
        );
        it("emits FloatMinted event", () => {
          Chai.callEmitEvents(
            ~call=promiseRef^,
            ~contract=contracts^.staker->Obj.magic,
            ~eventName="FloatMinted",
          )
          ->Chai.withArgs3(
              userWalletRef^.address,
              marketIndices->Array.getExn(0),
              floatRewardsForMarkets->Array.getUnsafe(0),
            )
        });

        it("mutates userIndexOfLastClaimedReward", () => {
          let%Await lastClaimed =
            contracts^.staker
            ->Staker.userIndexOfLastClaimedReward(
                marketIndices->Array.getUnsafe(0),
                userWalletRef^.address,
              );
          lastClaimed->Chai.bnEqual(latestRewardIndices->Array.getUnsafe(0));
        });
      });

      describe("case market has no float to mint", () => {
        // still calls calculateAccumulatedFloat but unwieldy to test
        it("doesn't mutate userIndexOfLastClaimed", () => {
          let%Await lastClaimed =
            contracts^.staker
            ->Staker.userIndexOfLastClaimedReward(
                marketIndices->Array.getUnsafe(1),
                userWalletRef^.address,
              );
          lastClaimed->Chai.bnEqual(CONSTANTS.zeroBn); // bit hacky but won't have been set yet
        });

        it("doesn't emit FloatMinted event", () =>
          Chai.callEmitEvents(
            ~call=promiseRef^,
            ~contract=contracts^.staker->Obj.magic,
            ~eventName="FloatMinted",
          )
          ->Chai.withArgs5Return(
              userWalletRef^.address,
              marketIndices->Array.getExn(1),
              CONSTANTS.zeroBn,
              CONSTANTS.zeroBn,
              latestRewardIndices->Array.getExn(1),
            )
          ->Chai.expectToNotEmit
        );
      });
    });

    describe("case no market has float to be minted", () => {
      before_once'(() => {
        setup(
          ~marketIndices,
          ~floatRewardsForMarkets=[|zeroBn, zeroBn|],
          ~latestRewardIndices,
        )
      });

      // doesn't do a lot of other stuff as well but unwieldy to test
      it("doesn't mint float", () => {
        StakerSmocked.InternalMock._mintFloatCalls()
        ->Array.length
        ->Chai.intEqual(0)
      });
    });
  });
};
