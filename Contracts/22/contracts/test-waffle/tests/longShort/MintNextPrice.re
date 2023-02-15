open Globals;
open LetOps;
open Mocha;

let testIntegration =
    (
      ~contracts: ref(Helpers.coreContracts),
      ~accounts: ref(array(Ethers.Wallet.t)),
    ) =>
  describe("mintLongNextPrice", () => {
    it("should work as expected happy path", () => {
      // let admin = accounts.contents->Array.getUnsafe(0);
      let testUser = accounts.contents->Array.getUnsafe(8);
      let amountToNextPriceMint = Helpers.randomTokenAmount();

      let {longShort, markets} =
        // let {tokenFactory, treasury, floatToken, staker, longShort, markets} =
        contracts.contents;
      let {
        paymentToken,
        oracleManager,
        // yieldManager,
        longSynth,
        // shortSynth,
        marketIndex,
      } =
        markets->Array.getUnsafe(0);

      let%AwaitThen _longValueBefore =
        longShort->LongShort.marketSideValueInPaymentToken(
          marketIndex,
          true /*long*/,
        );

      let%AwaitThen _ =
        paymentToken->ERC20Mock.mint(
          ~_to=testUser.address,
          ~amount=amountToNextPriceMint,
        );

      let%AwaitThen _ =
        paymentToken
        ->ContractHelpers.connect(~address=testUser)
        ->ERC20Mock.approve(
            ~spender=longShort.address,
            ~amount=amountToNextPriceMint,
          );

      let%AwaitThen _ =
        longShort
        ->ContractHelpers.connect(~address=testUser)
        ->LongShort.mintLongNextPrice(
            ~marketIndex,
            ~amount=amountToNextPriceMint,
          );

      let%AwaitThen previousPrice =
        oracleManager->OracleManagerMock.getLatestPrice;

      let nextPrice =
        previousPrice
        ->mul(bnFromInt(12)) // 20% increase
        ->div(bnFromInt(10));

      // let%AwaitThen userNextPriceActions =
      //   longShort->Contract.LongShort.userNextPriceActions(
      //     ~marketIndex,
      //     ~user=testUser.address,
      //   );

      // let%AwaitThen usersBalanceBeforeOracleUpdate =
      //   longSynth->Contract.SyntheticToken.balanceOf(
      //     ~account=testUser.address,
      //   );

      let%AwaitThen _ =
        oracleManager->OracleManagerMock.setPrice(~newPrice=nextPrice);

      let%AwaitThen _ = longShort->LongShort.updateSystemState(~marketIndex);

      let%AwaitThen usersBalanceBeforeSettlement =
        longSynth->SyntheticToken.balanceOf(~account=testUser.address);

      // This triggers the _executeOutstandingNextPriceSettlements function
      let%AwaitThen _ =
        longShort
        ->ContractHelpers.connect(~address=testUser)
        ->LongShort.mintLongNextPrice(~marketIndex, ~amount=bnFromInt(0));
      let%AwaitThen usersUpdatedBalance =
        longSynth->SyntheticToken.balanceOf(~account=testUser.address);

      Chai.bnEqual(
        ~message=
          "Balance after price system update but before user settlement should be the same as after settlement",
        usersBalanceBeforeSettlement,
        usersUpdatedBalance,
      );

      let%Await longTokenPrice =
        longShort->Contract.LongShortHelpers.getSyntheticTokenPrice(
          ~marketIndex,
          ~isLong=true,
        );

      let expectedNumberOfTokensToRecieve =
        amountToNextPriceMint
        ->mul(CONSTANTS.tenToThe18)
        ->div(longTokenPrice);

      Chai.bnEqual(
        ~message="balance is incorrect",
        expectedNumberOfTokensToRecieve,
        usersUpdatedBalance,
      );
    })
  });

let testUnit =
    (
      ~contracts: ref(Helpers.coreContracts),
      ~accounts: ref(array(Ethers.Wallet.t)),
    ) => {
  describe("mintNextPrice external functions", () => {
    let marketIndex = 1;
    let amount = Helpers.randomTokenAmount();

    let setup = () => {
      contracts.contents.longShort->LongShortSmocked.InternalMock.setup;
    };

    describe("mintLongNextPrice", () => {
      it("calls _mintNextPrice with isLong==true", () => {
        let%Await _ = setup();

        let%Await _ =
          contracts.contents.longShort
          ->LongShortSmocked.InternalMock.setupFunctionForUnitTesting(
              ~functionName="mintLongNextPrice",
            );

        let%Await _ =
          contracts.contents.longShort
          ->LongShort.mintLongNextPrice(~marketIndex, ~amount);

        let mintNextPriceCalls =
          LongShortSmocked.InternalMock._mintNextPriceCalls();

        mintNextPriceCalls->Chai.recordArrayDeepEqualFlat([|
          {marketIndex, amount, isLong: true},
        |]);
      })
    });

    describe("mintShortNextPrice", () => {
      it("calls _mintNextPrice with isLong==false", () => {
        let%Await _ = setup();

        let%Await _ =
          contracts.contents.longShort
          ->LongShortSmocked.InternalMock.setupFunctionForUnitTesting(
              ~functionName="mintShortNextPrice",
            );

        let%Await _ =
          contracts.contents.longShort
          ->LongShort.mintShortNextPrice(~marketIndex, ~amount);

        let mintNextPriceCalls =
          LongShortSmocked.InternalMock._mintNextPriceCalls();

        mintNextPriceCalls->Chai.recordArrayDeepEqualFlat([|
          {marketIndex, amount, isLong: false},
        |]);
      })
    });
  });

  describe("mintNextPrice internal function", () => {
    let marketIndex = 1;
    let marketUpdateIndex = Helpers.randomInteger();
    let amount = Helpers.randomTokenAmount();

    let setup = (~isLong, ~testWallet: Ethers.walletType) => {
      let%AwaitThen _ =
        contracts.contents.longShort->LongShortSmocked.InternalMock.setup;

      let%AwaitThen _ =
        contracts.contents.longShort
        ->LongShortSmocked.InternalMock.setupFunctionForUnitTesting(
            ~functionName="_mintNextPrice",
          );

      let%AwaitThen _ =
        contracts.contents.longShort
        ->LongShort.Exposed.setMintNextPriceGlobals(
            ~marketIndex,
            ~marketUpdateIndex,
          );

      let longShort =
        contracts.contents.longShort
        ->ContractHelpers.connect(~address=testWallet);

      longShort->LongShort.Exposed._mintNextPriceExposed(
        ~marketIndex,
        ~amount,
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

      it("emits the NextPriceDeposit event", () => {
        let testWallet = accounts.contents->Array.getUnsafe(1);

        Chai.callEmitEvents(
          ~call=setup(~isLong, ~testWallet),
          ~eventName="NextPriceDeposit",
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

      it("calls depositFunds with correct parameters", () => {
        let testWallet = accounts.contents->Array.getUnsafe(1);

        let%Await _ = setup(~isLong, ~testWallet);

        let depositFundsCalls =
          LongShortSmocked.InternalMock._transferPaymentTokensFromUserToYieldManagerCalls();

        depositFundsCalls->Chai.recordArrayDeepEqualFlat([|
          {marketIndex, amount},
        |]);
      });

      it("updates the correct state variables with correct values", () => {
        let testWallet = accounts.contents->Array.getUnsafe(1);

        let%AwaitThen _ = setup(~isLong, ~testWallet);

        let%AwaitThen updatedBatchedAmountOfTokens_deposit =
          contracts.contents.longShort
          ->LongShort.batched_amountPaymentToken_deposit(marketIndex, isLong);

        let%AwaitThen updatedUserNextPriceDepositAmount =
          contracts.contents.longShort
          ->LongShort.userNextPrice_paymentToken_depositAmount(
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
          ~message="batched_amountPaymentToken_deposit not updated correctly",
          updatedBatchedAmountOfTokens_deposit,
          amount,
        );

        Chai.bnEqual(
          ~message="userNextPriceDepositAmount not updated correctly",
          updatedUserNextPriceDepositAmount,
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
