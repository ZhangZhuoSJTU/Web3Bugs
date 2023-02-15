open LetOps;
open Mocha;
open Globals;

let testUnit =
    (
      ~contracts: ref(Helpers.coreContracts),
      ~accounts as _: ref(array(Ethers.Wallet.t)),
    ) => {
  describe("executeOutstandingNextPriceSettlements", () => {
    let marketIndex = 1;
    let user = Helpers.randomAddress();
    let defaultuserNextPrice_currentUpdateIndex = bnFromInt(22);
    let defaultMarketUpdateIndex =
      defaultuserNextPrice_currentUpdateIndex->add(oneBn);

    let setup = (~userNextPrice_currentUpdateIndex, ~marketUpdateIndex) => {
      let%AwaitThen _ =
        contracts.contents.longShort->LongShortSmocked.InternalMock.setup;

      let%AwaitThen _ =
        contracts.contents.longShort
        ->LongShortSmocked.InternalMock.setupFunctionForUnitTesting(
            ~functionName="_executeOutstandingNextPriceSettlements",
          );

      let%AwaitThen _ =
        contracts.contents.longShort
        ->LongShort.Exposed.setExecuteOutstandingNextPriceSettlementsGlobals(
            ~marketIndex,
            ~user,
            ~userNextPrice_currentUpdateIndex,
            ~marketUpdateIndex,
          );

      contracts.contents.longShort
      ->LongShort.Exposed._executeOutstandingNextPriceSettlementsExposed(
          ~user,
          ~marketIndex,
        );
    };

    describe("happy case", () => {
      before_once'(() =>
        setup(
          ~userNextPrice_currentUpdateIndex=defaultuserNextPrice_currentUpdateIndex,
          ~marketUpdateIndex=defaultMarketUpdateIndex,
        )
      );

      it(
        "calls nextPriceMint/nextPriceRedeem functions with correct arguments",
        () => {
        let executeOutstandingNextPriceMintsCalls =
          LongShortSmocked.InternalMock._executeOutstandingNextPriceMintsCalls();
        let executeOutstandingNextPriceRedeemCalls =
          LongShortSmocked.InternalMock._executeOutstandingNextPriceRedeemsCalls();

        Chai.intEqual(executeOutstandingNextPriceMintsCalls->Array.length, 2);
        Chai.intEqual(
          executeOutstandingNextPriceRedeemCalls->Array.length,
          2,
        );

        executeOutstandingNextPriceMintsCalls->Chai.recordArrayDeepEqualFlat([|
          {marketIndex, user, isLong: true},
          {marketIndex, user, isLong: false},
        |]);

        executeOutstandingNextPriceRedeemCalls->Chai.recordArrayDeepEqualFlat([|
          {marketIndex, user, isLong: true},
          {marketIndex, user, isLong: false},
        |]);
      });

      it("sets userNextPrice_currentUpdateIndex[marketIndex][user] to 0", () => {
        let%Await updateduserNextPrice_currentUpdateIndex =
          contracts^.longShort
          ->LongShort.userNextPrice_currentUpdateIndex(marketIndex, user);

        Chai.bnEqual(updateduserNextPrice_currentUpdateIndex, zeroBn);
      });

      it(
        "emits ExecuteNextPriceSettlementsUser event with correct parameters",
        () => {
        Chai.callEmitEvents(
          ~call=
            setup(
              ~userNextPrice_currentUpdateIndex=defaultuserNextPrice_currentUpdateIndex,
              ~marketUpdateIndex=defaultMarketUpdateIndex,
            ),
          ~eventName="ExecuteNextPriceSettlementsUser",
          ~contract=contracts.contents.longShort->Obj.magic,
        )
        ->Chai.withArgs2(user, marketIndex)
      });
    });

    describe("sad cases", () => {
      it(
        "doesn't emit ExecuteNextPriceSettlementsUser event if userNextPrice_currentUpdateIndex[marketIndex][user] = 0",
        () => {
        Chai.callEmitEvents(
          ~call=
            setup(
              ~userNextPrice_currentUpdateIndex=bnFromInt(0),
              ~marketUpdateIndex=defaultMarketUpdateIndex,
            ),
          ~eventName="ExecuteNextPriceSettlementsUser",
          ~contract=contracts.contents.longShort->Obj.magic,
        )
        ->Chai.expectToNotEmit
      });

      it(
        "doesn't call nextPriceMint/nextPriceRedeem functions if userNextPrice_currentUpdateIndex[marketIndex][user] = 0",
        () => {
          let%Await _ =
            setup(
              ~userNextPrice_currentUpdateIndex=bnFromInt(0),
              ~marketUpdateIndex=defaultMarketUpdateIndex,
            );

          let executeOutstandingNextPriceMintsCalls =
            LongShortSmocked.InternalMock._executeOutstandingNextPriceMintsCalls();
          let executeOutstandingNextPriceRedeemCalls =
            LongShortSmocked.InternalMock._executeOutstandingNextPriceRedeemsCalls();

          Chai.intEqual(
            executeOutstandingNextPriceMintsCalls->Array.length,
            0,
          );
          Chai.intEqual(
            executeOutstandingNextPriceRedeemCalls->Array.length,
            0,
          );
        },
      );

      it(
        "doesn't emit ExecuteNextPriceSettlementsUser event if userNextPrice_currentUpdateIndex[marketIndex][user] > marketUpdateIndex[marketIndex]",
        () => {
        Chai.callEmitEvents(
          ~call=
            setup(
              ~userNextPrice_currentUpdateIndex=defaultuserNextPrice_currentUpdateIndex,
              ~marketUpdateIndex=
                defaultuserNextPrice_currentUpdateIndex->sub(oneBn),
            ),
          ~eventName="ExecuteNextPriceSettlementsUser",
          ~contract=contracts.contents.longShort->Obj.magic,
        )
        ->Chai.expectToNotEmit
      });

      it(
        "doesn't call nextPriceMint/nextPriceRedeem functions if userNextPrice_currentUpdateIndex[marketIndex][user] > marketUpdateIndex[marketIndex]",
        () => {
          let%Await _ =
            setup(
              ~userNextPrice_currentUpdateIndex=defaultuserNextPrice_currentUpdateIndex,
              ~marketUpdateIndex=
                defaultuserNextPrice_currentUpdateIndex->sub(oneBn),
            );

          let executeOutstandingNextPriceMintsCalls =
            LongShortSmocked.InternalMock._executeOutstandingNextPriceMintsCalls();
          let executeOutstandingNextPriceRedeemCalls =
            LongShortSmocked.InternalMock._executeOutstandingNextPriceRedeemsCalls();

          Chai.intEqual(
            executeOutstandingNextPriceMintsCalls->Array.length,
            0,
          );
          Chai.intEqual(
            executeOutstandingNextPriceRedeemCalls->Array.length,
            0,
          );
        },
      );
    });
  });
};
