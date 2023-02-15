open Globals;
open LetOps;
open Mocha;
let testIntegration =
    (
      ~contracts: ref(Helpers.coreContracts),
      ~accounts: ref(array(Ethers.Wallet.t)),
    ) =>
  describe("nextPriceShiftPosition", () => {
    let runNextPriceShiftPositionTest = (~isShiftFromLong) =>
      it(
        "should work as expected happy path for token shifting "
        ++ (isShiftFromLong ? "Long" : "Short"),
        () => {
          let testUser = accounts.contents->Array.getUnsafe(8);
          let amountToNextPriceMint = Helpers.randomTokenAmount();

          let {longShort, markets} = contracts.contents;

          let longShortUserConnected =
            longShort->ContractHelpers.connect(~address=testUser);

          let {
            paymentToken,
            oracleManager,
            longSynth,
            shortSynth,
            marketIndex,
          } =
            markets->Array.getUnsafe(0);

          let fromSynth = isShiftFromLong ? longSynth : shortSynth;
          let toSynth = isShiftFromLong ? shortSynth : longSynth;
          let redeemNextPriceFunction =
            isShiftFromLong
              ? LongShort.shiftPositionFromLongNextPrice
              : LongShort.shiftPositionFromShortNextPrice;

          let%AwaitThen _longValueBefore =
            longShort->LongShort.marketSideValueInPaymentToken(
              marketIndex,
              isShiftFromLong,
            );

          let%AwaitThen _ =
            paymentToken->ERC20Mock.mint(
              ~_to=testUser.address,
              ~amount=amountToNextPriceMint,
            );

          let%AwaitThen _ =
            paymentToken->ERC20Mock.setShouldMockTransfer(~value=false);

          let%AwaitThen _ =
            paymentToken
            ->ContractHelpers.connect(~address=testUser)
            ->ERC20Mock.approve(
                ~spender=longShort.address,
                ~amount=amountToNextPriceMint,
              );

          let%AwaitThen _ =
            HelperActions.mintDirect(
              ~marketIndex,
              ~amount=amountToNextPriceMint,
              ~token=paymentToken,
              ~user=testUser,
              ~longShort,
              ~oracleManagerMock=oracleManager,
              ~isLong=isShiftFromLong,
            );

          let%AwaitThen usersBalanceAvailableForShift =
            fromSynth->SyntheticToken.balanceOf(~account=testUser.address);
          let%AwaitThen _ =
            longShortUserConnected->redeemNextPriceFunction(
              ~marketIndex,
              ~amountSyntheticTokensToShift=usersBalanceAvailableForShift,
            );
          let%AwaitThen usersBalanceAfterNextPriceShift =
            fromSynth->SyntheticToken.balanceOf(~account=testUser.address);

          Chai.bnEqual(
            ~message=
              "Balance after price system update but before user settlement should be the same as after settlement",
            usersBalanceAfterNextPriceShift,
            CONSTANTS.zeroBn,
          );

          let%AwaitThen otherSyntheticTokenBalanceBeforeShift =
            toSynth->SyntheticToken.balanceOf(~account=testUser.address);

          let%AwaitThen previousPrice =
            oracleManager->OracleManagerMock.getLatestPrice;

          let nextPrice =
            previousPrice
            ->mul(bnFromInt(12)) // 20% increase
            ->div(bnFromInt(10));

          let%AwaitThen _ =
            oracleManager->OracleManagerMock.setPrice(~newPrice=nextPrice);

          let%AwaitThen _ =
            longShort->LongShort.updateSystemState(~marketIndex);
          let%AwaitThen latestUpdateIndex =
            longShort->LongShort.marketUpdateIndex(marketIndex);
          let%AwaitThen shiftPriceFromSynth =
            longShort->LongShort.syntheticToken_priceSnapshot(
              marketIndex,
              isShiftFromLong,
              latestUpdateIndex,
            );
          let%AwaitThen shiftPriceToSynth =
            longShort->LongShort.syntheticToken_priceSnapshot(
              marketIndex,
              !isShiftFromLong,
              latestUpdateIndex,
            );

          let amountSyntheticTokenExpectedToRecieveOnOtherSide =
            usersBalanceAvailableForShift
            ->mul(shiftPriceFromSynth)
            ->div(shiftPriceToSynth);

          let%AwaitThen _ =
            longShort->LongShort.executeOutstandingNextPriceSettlementsUser(
              ~marketIndex,
              ~user=testUser.address,
            );

          let%Await toSynthBalanceAfterShift =
            toSynth->SyntheticToken.balanceOf(~account=testUser.address);

          let deltaBalanceChange =
            toSynthBalanceAfterShift->sub(
              otherSyntheticTokenBalanceBeforeShift,
            );

          Chai.bnEqual(
            ~message="Balance of paymentToken didn't update correctly",
            deltaBalanceChange,
            amountSyntheticTokenExpectedToRecieveOnOtherSide,
          );
        },
      );

    runNextPriceShiftPositionTest(~isShiftFromLong=true);
    // runNextPriceShiftPositionTest(~isShiftFromLong=false);
  });

let testUnit =
    (
      ~contracts: ref(Helpers.coreContracts),
      ~accounts: ref(array(Ethers.Wallet.t)),
    ) => {
  describe("shiftNextPrice external functions", () => {
    let marketIndex = 1;
    let amountSyntheticTokensToShift = Helpers.randomTokenAmount();

    let setup = () => {
      contracts.contents.longShort->LongShortSmocked.InternalMock.setup;
    };

    describe("shiftPositionFromLongNextPrice", () => {
      it("calls _shiftPositionNextPrice with isShiftFromLong==true", () => {
        let%Await _ = setup();

        let%Await _ =
          contracts.contents.longShort
          ->LongShortSmocked.InternalMock.setupFunctionForUnitTesting(
              ~functionName="shiftPositionFromLongNextPrice",
            );

        let%Await _ =
          contracts.contents.longShort
          ->LongShort.shiftPositionFromLongNextPrice(
              ~marketIndex,
              ~amountSyntheticTokensToShift,
            );

        let shiftPositionNextPriceCalls =
          LongShortSmocked.InternalMock._shiftPositionNextPriceCalls();

        shiftPositionNextPriceCalls->Chai.recordArrayDeepEqualFlat([|
          {marketIndex, amountSyntheticTokensToShift, isShiftFromLong: true},
        |]);
      })
    });

    describe("shiftPositionFromShortNextPrice", () => {
      it("calls _shiftPositionNextPrice with isShiftFromLong==false", () => {
        let%Await _ = setup();

        let%Await _ =
          contracts.contents.longShort
          ->LongShortSmocked.InternalMock.setupFunctionForUnitTesting(
              ~functionName="shiftPositionFromShortNextPrice",
            );

        let%Await _ =
          contracts.contents.longShort
          ->LongShort.shiftPositionFromShortNextPrice(
              ~marketIndex,
              ~amountSyntheticTokensToShift,
            );

        let shiftPositionNextPriceCalls =
          LongShortSmocked.InternalMock._shiftPositionNextPriceCalls();

        shiftPositionNextPriceCalls->Chai.recordArrayDeepEqualFlat([|
          {marketIndex, amountSyntheticTokensToShift, isShiftFromLong: false},
        |]);
      })
    });
  });

  describe("_shiftPositionNextPrice internal function", () => {
    let marketIndex = 1;
    let marketUpdateIndex = Helpers.randomInteger();
    let amount = Helpers.randomTokenAmount();
    let smockedSyntheticToken = ref(SyntheticTokenSmocked.uninitializedValue);

    let setup = (~isShiftFromLong, ~testWallet: Ethers.walletType) => {
      let {longShort, markets} = contracts.contents;
      let {longSynth} = markets->Array.getUnsafe(0);

      let%AwaitThen longSynthSmocked = longSynth->SyntheticTokenSmocked.make;
      longSynthSmocked->SyntheticTokenSmocked.mockTransferFromToReturn(true);
      smockedSyntheticToken := longSynthSmocked;

      let%AwaitThen _ = longShort->LongShortSmocked.InternalMock.setup;

      let%AwaitThen _ =
        longShort->LongShortSmocked.InternalMock.setupFunctionForUnitTesting(
          ~functionName="_shiftPositionNextPrice",
        );

      let%AwaitThen _ =
        longShort->LongShort.Exposed.setShiftNextPriceGlobals(
          ~marketIndex,
          ~marketUpdateIndex,
          ~syntheticTokenShiftedFrom=longSynthSmocked.address,
          ~isShiftFromLong,
        );

      let longShort = longShort->ContractHelpers.connect(~address=testWallet);

      longShort->LongShort.Exposed._shiftPositionNextPriceExposed(
        ~marketIndex,
        ~amountSyntheticTokensToShift=amount,
        ~isShiftFromLong,
      );
    };

    let testMarketSide = (~isShiftFromLong) => {
      it("calls the executeOutstandingNextPriceSettlements modifier", () => {
        let testWallet = accounts.contents->Array.getUnsafe(1);

        let%Await _ = setup(~isShiftFromLong, ~testWallet);

        let executeOutstandingNextPriceSettlementsCalls =
          LongShortSmocked.InternalMock._executeOutstandingNextPriceSettlementsCalls();

        executeOutstandingNextPriceSettlementsCalls->Chai.recordArrayDeepEqualFlat([|
          {user: testWallet.address, marketIndex},
        |]);
      });

      it("emits the NextPriceSyntheticPositionShift event", () => {
        let testWallet = accounts.contents->Array.getUnsafe(1);

        Chai.callEmitEvents(
          ~call=setup(~isShiftFromLong, ~testWallet),
          ~eventName="NextPriceSyntheticPositionShift",
          ~contract=contracts.contents.longShort->Obj.magic,
        )
        ->Chai.withArgs5(
            marketIndex,
            isShiftFromLong,
            amount,
            testWallet.address,
            marketUpdateIndex->add(oneBn),
          );
      });

      it(
        "transfers synthetic tokens (calls transferFrom with the correct parameters)",
        () => {
        let testWallet = accounts.contents->Array.getUnsafe(1);

        let%Await _ = setup(~isShiftFromLong, ~testWallet);

        let transferFrom =
          smockedSyntheticToken.contents
          ->SyntheticTokenSmocked.transferFromCalls;

        transferFrom->Chai.recordArrayDeepEqualFlat([|
          {
            sender: testWallet.address,
            recipient: contracts.contents.longShort.address,
            amount,
          },
        |]);
      });

      it("updates the correct state variables with correct values", () => {
        let testWallet = accounts.contents->Array.getUnsafe(1);

        let%AwaitThen _ = setup(~isShiftFromLong, ~testWallet);

        let%AwaitThen updatedbatched_amountSyntheticTokenToShiftMarketSide =
          contracts.contents.longShort
          ->LongShort.batched_amountSyntheticToken_toShiftAwayFrom_marketSide(
              marketIndex,
              isShiftFromLong,
            );

        let%AwaitThen updateduserNextPrice_syntheticToken_toShiftAwayFrom_marketSide =
          contracts.contents.longShort
          ->LongShort.userNextPrice_syntheticToken_toShiftAwayFrom_marketSide(
              marketIndex,
              isShiftFromLong,
              testWallet.address,
            );

        let%Await updateduserNextPrice_currentUpdateIndex =
          contracts.contents.longShort
          ->LongShort.userNextPrice_currentUpdateIndex(
              marketIndex,
              testWallet.address,
            );

        Chai.bnEqual(
          ~message=
            "batched_amountSyntheticTokenToShiftMarketSide not updated correctly",
          updatedbatched_amountSyntheticTokenToShiftMarketSide,
          amount,
        );

        Chai.bnEqual(
          ~message=
            "userNextPrice_syntheticToken_toShiftAwayFrom_marketSide not updated correctly",
          updateduserNextPrice_syntheticToken_toShiftAwayFrom_marketSide,
          amount,
        );

        Chai.bnEqual(
          ~message="userNextPrice_currentUpdateIndex not updated correctly",
          updateduserNextPrice_currentUpdateIndex,
          marketUpdateIndex->add(oneBn),
        );
      });
    };

    describe("long", () => {
      testMarketSide(~isShiftFromLong=true)
    });
    describe("short", () => {
      testMarketSide(~isShiftFromLong=false)
    });
  });
};
