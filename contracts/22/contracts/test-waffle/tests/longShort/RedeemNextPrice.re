open Globals;
open LetOps;
open Mocha;

let testIntegration =
    (
      ~contracts: ref(Helpers.coreContracts),
      ~accounts: ref(array(Ethers.Wallet.t)),
    ) =>
  describe("nextPriceRedeem", () => {
    let runNextPriceRedeemTest = (~isLong) =>
      it(
        "should work as expected happy path for redeem "
        ++ (isLong ? "Long" : "Short"),
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

          let testSynth = isLong ? longSynth : shortSynth;
          let redeemNextPriceFunction =
            isLong
              ? LongShort.redeemLongNextPrice : LongShort.redeemShortNextPrice;

          let%AwaitThen _longValueBefore =
            longShort->LongShort.marketSideValueInPaymentToken(
              marketIndex,
              isLong,
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
              ~isLong,
            );

          let%AwaitThen usersBalanceAvailableForRedeem =
            testSynth->SyntheticToken.balanceOf(~account=testUser.address);
          let%AwaitThen _ =
            longShortUserConnected->redeemNextPriceFunction(
              ~marketIndex,
              ~tokens_redeem=usersBalanceAvailableForRedeem,
            );
          let%AwaitThen usersBalanceAfterNextPriceRedeem =
            testSynth->SyntheticToken.balanceOf(~account=testUser.address);

          Chai.bnEqual(
            ~message=
              "Balance after price system update but before user settlement should be the same as after settlement",
            usersBalanceAfterNextPriceRedeem,
            CONSTANTS.zeroBn,
          );

          let%AwaitThen paymentTokenBalanceBeforeWithdrawal =
            paymentToken->ERC20Mock.balanceOf(~account=testUser.address);

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
          let%AwaitThen redemptionPriceWithFees =
            longShort->LongShort.syntheticToken_priceSnapshot(
              marketIndex,
              isLong,
              latestUpdateIndex,
            );

          let amountExpectedToBeRedeemed =
            usersBalanceAvailableForRedeem
            ->mul(redemptionPriceWithFees)
            ->div(CONSTANTS.tenToThe18);

          let%AwaitThen _ =
            longShort->LongShort.executeOutstandingNextPriceSettlementsUser(
              ~marketIndex,
              ~user=testUser.address,
            );

          let%Await paymentTokenBalanceAfterWithdrawal =
            paymentToken->ERC20Mock.balanceOf(~account=testUser.address);

          let deltaBalanceChange =
            paymentTokenBalanceAfterWithdrawal->sub(
              paymentTokenBalanceBeforeWithdrawal,
            );

          Chai.bnEqual(
            ~message="Balance of paymentToken didn't update correctly",
            deltaBalanceChange,
            amountExpectedToBeRedeemed,
          );
        },
      );

    runNextPriceRedeemTest(~isLong=true);
    runNextPriceRedeemTest(~isLong=false);
  });

let testUnit =
    (
      ~contracts: ref(Helpers.coreContracts),
      ~accounts: ref(array(Ethers.Wallet.t)),
    ) => {
  describe("redeemNextPrice external functions", () => {
    let marketIndex = 1;
    let tokens_redeem = Helpers.randomTokenAmount();

    let setup = () => {
      contracts.contents.longShort->LongShortSmocked.InternalMock.setup;
    };

    describe("redeemLongNextPrice", () => {
      it("calls _redeemNextPrice with isLong==true", () => {
        let%Await _ = setup();

        let%Await _ =
          contracts.contents.longShort
          ->LongShortSmocked.InternalMock.setupFunctionForUnitTesting(
              ~functionName="redeemLongNextPrice",
            );

        let%Await _ =
          contracts.contents.longShort
          ->LongShort.redeemLongNextPrice(~marketIndex, ~tokens_redeem);

        let redeemNextPriceCalls =
          LongShortSmocked.InternalMock._redeemNextPriceCalls();

        redeemNextPriceCalls->Chai.recordArrayDeepEqualFlat([|
          {marketIndex, tokens_redeem, isLong: true},
        |]);
      })
    });

    describe("redeemShortNextPrice", () => {
      it("calls _redeemNextPrice with isLong==false", () => {
        let%Await _ = setup();

        let%Await _ =
          contracts.contents.longShort
          ->LongShortSmocked.InternalMock.setupFunctionForUnitTesting(
              ~functionName="redeemShortNextPrice",
            );

        let%Await _ =
          contracts.contents.longShort
          ->LongShort.redeemShortNextPrice(~marketIndex, ~tokens_redeem);

        let redeemNextPriceCalls =
          LongShortSmocked.InternalMock._redeemNextPriceCalls();

        redeemNextPriceCalls->Chai.recordArrayDeepEqualFlat([|
          {marketIndex, tokens_redeem, isLong: false},
        |]);
      })
    });
  });

  describe("redeemNextPrice internal function", () => {
    let marketIndex = 1;
    let marketUpdateIndex = Helpers.randomInteger();
    let amount = Helpers.randomTokenAmount();
    let smockedSyntheticToken = ref(SyntheticTokenSmocked.uninitializedValue);

    let setup = (~isLong, ~testWallet: Ethers.walletType) => {
      let {longSynth} = contracts.contents.markets->Array.getUnsafe(0);
      let%AwaitThen longSynthSmocked = longSynth->SyntheticTokenSmocked.make;
      longSynthSmocked->SyntheticTokenSmocked.mockTransferFromToReturn(true);
      smockedSyntheticToken := longSynthSmocked;

      let%AwaitThen _ =
        contracts.contents.longShort->LongShortSmocked.InternalMock.setup;

      let%AwaitThen _ =
        contracts.contents.longShort
        ->LongShortSmocked.InternalMock.setupFunctionForUnitTesting(
            ~functionName="_redeemNextPrice",
          );

      let%AwaitThen _ =
        contracts.contents.longShort
        ->LongShort.Exposed.setRedeemNextPriceGlobals(
            ~marketIndex,
            ~marketUpdateIndex,
            ~syntheticToken=longSynthSmocked.address,
            ~isLong,
          );

      let longShort =
        contracts.contents.longShort
        ->ContractHelpers.connect(~address=testWallet);

      longShort->LongShort.Exposed._redeemNextPriceExposed(
        ~marketIndex,
        ~tokens_redeem=amount,
        ~isLong,
      );
    };

    let testMarketSide = (~isLong) => {
      it("calls the executeOutstandingNextPriceSettlements modifier", () => {
        let testWallet = accounts.contents->Array.getUnsafe(1);

        let%Await _ = setup(~isLong, ~testWallet);

        let executeOutstandingNextPriceSettlementsCalls =
          LongShortSmocked.InternalMock._executeOutstandingNextPriceSettlementsCalls();

        executeOutstandingNextPriceSettlementsCalls->Chai.recordArrayDeepEqualFlat([|
          {user: testWallet.address, marketIndex},
        |]);
      });

      it("emits the NextPriceRedeem event", () => {
        let testWallet = accounts.contents->Array.getUnsafe(1);

        Chai.callEmitEvents(
          ~call=setup(~isLong, ~testWallet),
          ~eventName="NextPriceRedeem",
          ~contract=contracts.contents.longShort->Obj.magic,
        )
        ->Chai.withArgs5(
            marketIndex,
            isLong,
            amount,
            testWallet.address,
            marketUpdateIndex->add(oneBn),
          );
      });

      it(
        "transfers synthetic tokens (calls transferFrom with the correct parameters)",
        () => {
        let testWallet = accounts.contents->Array.getUnsafe(1);

        let%Await _ = setup(~isLong, ~testWallet);

        let transferFromCalls =
          smockedSyntheticToken.contents
          ->SyntheticTokenSmocked.transferFromCalls;

        transferFromCalls->Chai.recordArrayDeepEqualFlat([|
          {
            sender: testWallet.address,
            recipient: contracts.contents.longShort.address,
            amount,
          },
        |]);
      });

      it("updates the correct state variables with correct values", () => {
        let testWallet = accounts.contents->Array.getUnsafe(1);

        let%AwaitThen _ = setup(~isLong, ~testWallet);

        let%AwaitThen updatedbatched_amountSyntheticToken_redeem =
          contracts.contents.longShort
          ->LongShort.batched_amountSyntheticToken_redeem(
              marketIndex,
              isLong,
            );

        let%AwaitThen updatedUserNextPriceRedemptionAmount =
          contracts.contents.longShort
          ->LongShort.userNextPrice_syntheticToken_redeemAmount(
              marketIndex,
              isLong,
              testWallet.address,
            );

        let%Await updateduserNextPrice_currentUpdateIndex =
          contracts.contents.longShort
          ->LongShort.userNextPrice_currentUpdateIndex(
              marketIndex,
              testWallet.address,
            );

        Chai.bnEqual(
          ~message="batched_amountSyntheticToken_redeem not updated correctly",
          updatedbatched_amountSyntheticToken_redeem,
          amount,
        );

        Chai.bnEqual(
          ~message="userNextPriceRedemptionAmount not updated correctly",
          updatedUserNextPriceRedemptionAmount,
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
      testMarketSide(~isLong=true)
    });
    describe("short", () => {
      testMarketSide(~isLong=false)
    });
  });
};
