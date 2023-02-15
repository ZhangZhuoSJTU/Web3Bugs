open Mocha;
open Globals;
open LetOps;

let testUnit =
    (
      ~contracts: ref(Helpers.coreContracts),
      ~accounts as _: ref(array(Ethers.Wallet.t)),
    ) => {
  describeUnit("Batched Settlement", () => {
    let marketIndex = Helpers.randomJsInteger();
    describe("_batchConfirmOutstandingPendingActions", () => {
      let syntheticTokenPrice_inPaymentTokens_long =
        Helpers.randomTokenAmount();
      let syntheticTokenPrice_inPaymentTokens_short =
        Helpers.randomTokenAmount();

      let setup =
          (
            ~batched_amountPaymentToken_depositLong,
            ~batched_amountPaymentToken_depositShort,
            ~batched_amountSyntheticToken_redeemLong,
            ~batched_amountSyntheticToken_redeemShort,
            ~batchedAmountSyntheticTokenToShiftFromLong,
            ~batchedAmountSyntheticTokenToShiftFromShort,
          ) => {
        let {longShort} = contracts.contents;
        let%AwaitThen _ =
          longShort->LongShortSmocked.InternalMock.setupFunctionForUnitTesting(
            ~functionName="_batchConfirmOutstandingPendingActions",
          );

        LongShortSmocked.InternalMock.mock_handleTotalPaymentTokenValueChangeForMarketWithYieldManagerToReturn();
        LongShortSmocked.InternalMock.mock_handleChangeInSyntheticTokensTotalSupplyToReturn();

        let%AwaitThen _ =
          longShort->LongShort.Exposed.setPerformOustandingBatchedSettlementsGlobals(
            ~marketIndex,
            ~batched_amountPaymentToken_depositLong,
            ~batched_amountPaymentToken_depositShort,
            ~batched_amountSyntheticToken_redeemLong,
            ~batched_amountSyntheticToken_redeemShort,
            ~batchedAmountSyntheticTokenToShiftFromLong,
            ~batchedAmountSyntheticTokenToShiftFromShort,
          );

        longShort->LongShort.Exposed._batchConfirmOutstandingPendingActionsExposedCall(
          ~marketIndex,
          ~syntheticTokenPrice_inPaymentTokens_long,
          ~syntheticTokenPrice_inPaymentTokens_short,
        );
      };

      let runTest =
          (
            ~batched_amountPaymentToken_depositLong,
            ~batched_amountPaymentToken_depositShort,
            ~batched_amountSyntheticToken_redeemLong,
            ~batched_amountSyntheticToken_redeemShort,
            ~batchedAmountSyntheticTokenToShiftFromLong,
            ~batchedAmountSyntheticTokenToShiftFromShort,
          ) => {
        let batchedAmountSyntheticTokenToMintLong = ref(None->Obj.magic);
        let batchedAmountSyntheticTokenToMintShort = ref(None->Obj.magic);
        let batchedAmountOfPaymentTokensToBurnLong = ref(None->Obj.magic);
        let batchedAmountOfPaymentTokensToBurnShort = ref(None->Obj.magic);
        let batchedAmountOfPaymentTokensToShiftToLong = ref(None->Obj.magic);
        let batchedAmountOfPaymentTokensToShiftToShort = ref(None->Obj.magic);
        let batchedAmountSyntheticTokenToShiftToLong = ref(None->Obj.magic);
        let batchedAmountSyntheticTokenToShiftToShort = ref(None->Obj.magic);
        let calculatedValueChangeForLong = ref(None->Obj.magic);
        let calculatedValueChangeForShort = ref(None->Obj.magic);
        let calculatedValueChangeInSynthSupplyLong = ref(None->Obj.magic);
        let calculatedValueChangeInSynthSupplyShort = ref(None->Obj.magic);
        let returnOfPerformOustandingBatchedSettlements =
          ref(None->Obj.magic);

        before_each(() => {
          let%Await functionCallReturn =
            setup(
              ~batched_amountPaymentToken_depositLong,
              ~batched_amountPaymentToken_depositShort,
              ~batched_amountSyntheticToken_redeemLong,
              ~batched_amountSyntheticToken_redeemShort,
              ~batchedAmountSyntheticTokenToShiftFromLong,
              ~batchedAmountSyntheticTokenToShiftFromShort,
            );

          batchedAmountSyntheticTokenToMintLong :=
            Contract.LongShortHelpers.calcAmountSyntheticToken(
              ~amountPaymentToken=batched_amountPaymentToken_depositLong,
              ~price=syntheticTokenPrice_inPaymentTokens_long,
            );
          batchedAmountSyntheticTokenToMintShort :=
            Contract.LongShortHelpers.calcAmountSyntheticToken(
              ~amountPaymentToken=batched_amountPaymentToken_depositShort,
              ~price=syntheticTokenPrice_inPaymentTokens_short,
            );
          batchedAmountOfPaymentTokensToBurnLong :=
            Contract.LongShortHelpers.calcAmountPaymentToken(
              ~amountSyntheticToken=batched_amountSyntheticToken_redeemLong,
              ~price=syntheticTokenPrice_inPaymentTokens_long,
            );
          batchedAmountOfPaymentTokensToBurnShort :=
            Contract.LongShortHelpers.calcAmountPaymentToken(
              ~amountSyntheticToken=batched_amountSyntheticToken_redeemShort,
              ~price=syntheticTokenPrice_inPaymentTokens_short,
            );

          batchedAmountOfPaymentTokensToShiftToLong :=
            Contract.LongShortHelpers.calcAmountPaymentToken(
              ~amountSyntheticToken=batchedAmountSyntheticTokenToShiftFromShort,
              ~price=syntheticTokenPrice_inPaymentTokens_short,
            );
          batchedAmountOfPaymentTokensToShiftToShort :=
            Contract.LongShortHelpers.calcAmountPaymentToken(
              ~amountSyntheticToken=batchedAmountSyntheticTokenToShiftFromLong,
              ~price=syntheticTokenPrice_inPaymentTokens_long,
            );

          batchedAmountSyntheticTokenToShiftToShort :=
            Contract.LongShortHelpers.calcEquivalentAmountSyntheticTokensOnTargetSide(
              ~amountSyntheticTokenOriginSide=batchedAmountSyntheticTokenToShiftFromLong,
              ~priceOriginSide=syntheticTokenPrice_inPaymentTokens_long,
              ~priceTargetSide=syntheticTokenPrice_inPaymentTokens_short,
            );
          batchedAmountSyntheticTokenToShiftToLong :=
            Contract.LongShortHelpers.calcEquivalentAmountSyntheticTokensOnTargetSide(
              ~amountSyntheticTokenOriginSide=batchedAmountSyntheticTokenToShiftFromShort,
              ~priceOriginSide=syntheticTokenPrice_inPaymentTokens_short,
              ~priceTargetSide=syntheticTokenPrice_inPaymentTokens_long,
            );

          calculatedValueChangeForLong :=
            batched_amountPaymentToken_depositLong
            ->sub(batchedAmountOfPaymentTokensToBurnLong.contents)
            ->add(batchedAmountOfPaymentTokensToShiftToLong.contents)
            ->sub(batchedAmountOfPaymentTokensToShiftToShort.contents);
          calculatedValueChangeForShort :=
            batched_amountPaymentToken_depositShort
            ->sub(batchedAmountOfPaymentTokensToBurnShort.contents)
            ->add(batchedAmountOfPaymentTokensToShiftToShort.contents)
            ->sub(batchedAmountOfPaymentTokensToShiftToLong.contents);

          calculatedValueChangeInSynthSupplyLong :=
            batchedAmountSyntheticTokenToMintLong.contents
            ->sub(batched_amountSyntheticToken_redeemLong)
            ->add(batchedAmountSyntheticTokenToShiftToLong.contents)
            ->sub(batchedAmountSyntheticTokenToShiftFromLong);
          calculatedValueChangeInSynthSupplyShort :=
            batchedAmountSyntheticTokenToMintShort.contents
            ->sub(batched_amountSyntheticToken_redeemShort)
            ->add(batchedAmountSyntheticTokenToShiftToShort.contents)
            ->sub(batchedAmountSyntheticTokenToShiftFromShort);
          returnOfPerformOustandingBatchedSettlements := functionCallReturn;
        });
        it(
          "call handleChangeInSyntheticTokensTotalSupply with the correct parameters",
          () => {
          let handleChangeInSyntheticTokensTotalSupplyCalls =
            LongShortSmocked.InternalMock._handleChangeInSyntheticTokensTotalSupplyCalls();

          // NOTE: due to the small optimization in the implementation (and ovoiding stack too deep errors) it is possible that the algorithm over issues float by a unit.
          //       This is probably not an issue since it overshoots rather than undershoots. However, this should be monitored or changed.
          Chai.recordArrayDeepEqualFlat(
            handleChangeInSyntheticTokensTotalSupplyCalls,
            [|
              {
                marketIndex,
                isLong: true,
                changeInSyntheticTokensTotalSupply:
                  calculatedValueChangeInSynthSupplyLong.contents,
              },
              {
                marketIndex,
                isLong: false,
                changeInSyntheticTokensTotalSupply:
                  calculatedValueChangeInSynthSupplyShort.contents,
              },
            |],
          );
        });
        it(
          "call handleTotalValueChangeForMarketWithYieldManager with the correct parameters",
          () => {
            let handleTotalValueChangeForMarketWithYieldManagerCalls =
              LongShortSmocked.InternalMock._handleTotalPaymentTokenValueChangeForMarketWithYieldManagerCalls();

            let totalPaymentTokenValueChangeForMarket =
              calculatedValueChangeForLong.contents
              ->add(calculatedValueChangeForShort.contents);
            Chai.recordArrayDeepEqualFlat(
              handleTotalValueChangeForMarketWithYieldManagerCalls,
              [|{marketIndex, totalPaymentTokenValueChangeForMarket}|],
            );
          },
        );
        it("should return the correct values", () => {
          Chai.recordEqualDeep(
            returnOfPerformOustandingBatchedSettlements.contents,
            {
              long_changeInMarketValue_inPaymentToken:
                calculatedValueChangeForLong.contents,
              short_changeInMarketValue_inPaymentToken:
                calculatedValueChangeForShort.contents,
            },
          )
        });
      };

      describe("there are no actions in the batch", () => {
        runTest(
          ~batched_amountPaymentToken_depositLong=zeroBn,
          ~batched_amountPaymentToken_depositShort=zeroBn,
          ~batched_amountSyntheticToken_redeemLong=zeroBn,
          ~batched_amountSyntheticToken_redeemShort=zeroBn,
          ~batchedAmountSyntheticTokenToShiftFromLong=zeroBn,
          ~batchedAmountSyntheticTokenToShiftFromShort=zeroBn,
        )
      });
      describe("there is 1 deposit long", () => {
        runTest(
          ~batched_amountPaymentToken_depositLong=Helpers.randomTokenAmount(),
          ~batched_amountPaymentToken_depositShort=zeroBn,
          ~batched_amountSyntheticToken_redeemLong=zeroBn,
          ~batched_amountSyntheticToken_redeemShort=zeroBn,
          ~batchedAmountSyntheticTokenToShiftFromLong=zeroBn,
          ~batchedAmountSyntheticTokenToShiftFromShort=zeroBn,
        )
      });
      describe("there is 1 deposit short", () => {
        runTest(
          ~batched_amountPaymentToken_depositLong=zeroBn,
          ~batched_amountPaymentToken_depositShort=Helpers.randomTokenAmount(),
          ~batched_amountSyntheticToken_redeemLong=zeroBn,
          ~batched_amountSyntheticToken_redeemShort=zeroBn,
          ~batchedAmountSyntheticTokenToShiftFromLong=zeroBn,
          ~batchedAmountSyntheticTokenToShiftFromShort=zeroBn,
        )
      });
      describe("there is 1 withdraw long", () => {
        runTest(
          ~batched_amountPaymentToken_depositLong=zeroBn,
          ~batched_amountPaymentToken_depositShort=zeroBn,
          ~batched_amountSyntheticToken_redeemLong=Helpers.randomTokenAmount(),
          ~batched_amountSyntheticToken_redeemShort=zeroBn,
          ~batchedAmountSyntheticTokenToShiftFromLong=zeroBn,
          ~batchedAmountSyntheticTokenToShiftFromShort=zeroBn,
        )
      });
      describe("there is 1 withdraw short", () => {
        runTest(
          ~batched_amountPaymentToken_depositLong=zeroBn,
          ~batched_amountPaymentToken_depositShort=zeroBn,
          ~batched_amountSyntheticToken_redeemLong=zeroBn,
          ~batched_amountSyntheticToken_redeemShort=
            Helpers.randomTokenAmount(),
          ~batchedAmountSyntheticTokenToShiftFromLong=zeroBn,
          ~batchedAmountSyntheticTokenToShiftFromShort=zeroBn,
        )
      });
      describe("there is 1 shift from long to short", () => {
        runTest(
          ~batched_amountPaymentToken_depositLong=zeroBn,
          ~batched_amountPaymentToken_depositShort=zeroBn,
          ~batched_amountSyntheticToken_redeemLong=zeroBn,
          ~batched_amountSyntheticToken_redeemShort=zeroBn,
          ~batchedAmountSyntheticTokenToShiftFromLong=
            Helpers.randomTokenAmount(),
          ~batchedAmountSyntheticTokenToShiftFromShort=zeroBn,
        )
      });
      describe("there is 1 shift from short to long", () => {
        runTest(
          ~batched_amountPaymentToken_depositLong=zeroBn,
          ~batched_amountPaymentToken_depositShort=zeroBn,
          ~batched_amountSyntheticToken_redeemLong=zeroBn,
          ~batched_amountSyntheticToken_redeemShort=zeroBn,
          ~batchedAmountSyntheticTokenToShiftFromLong=zeroBn,
          ~batchedAmountSyntheticTokenToShiftFromShort=
            Helpers.randomTokenAmount(),
        )
      });
      describe(
        "there random deposits and withdrawals (we could be more specific with this test possibly?)",
        () => {
        runTest(
          ~batched_amountPaymentToken_depositLong=Helpers.randomTokenAmount(),
          ~batched_amountPaymentToken_depositShort=Helpers.randomTokenAmount(),
          ~batched_amountSyntheticToken_redeemLong=Helpers.randomTokenAmount(),
          ~batched_amountSyntheticToken_redeemShort=
            Helpers.randomTokenAmount(),
          ~batchedAmountSyntheticTokenToShiftFromLong=
            Helpers.randomTokenAmount(),
          ~batchedAmountSyntheticTokenToShiftFromShort=
            Helpers.randomTokenAmount(),
        )
      });
    });
    describe("_handleChangeInSyntheticTokensTotalSupply", () => {
      let longSyntheticToken = ref("Not Set Yet"->Obj.magic);
      let shortSyntheticToken = ref("Not Set Yet"->Obj.magic);

      before_each(() => {
        let {longShort, markets} = contracts.contents;
        let {longSynth, shortSynth} = markets->Array.getUnsafe(0);

        let%Await smockedSynthLong = SyntheticTokenSmocked.make(longSynth);
        let%Await smockedSynthShort = SyntheticTokenSmocked.make(shortSynth);

        longSyntheticToken := smockedSynthLong;
        shortSyntheticToken := smockedSynthShort;

        let _ = smockedSynthLong->SyntheticTokenSmocked.mockMintToReturn;
        let _ = smockedSynthLong->SyntheticTokenSmocked.mockBurnToReturn;
        let _ = smockedSynthShort->SyntheticTokenSmocked.mockMintToReturn;
        let _ = smockedSynthShort->SyntheticTokenSmocked.mockBurnToReturn;

        longShort->LongShort.Exposed.setHandleChangeInSyntheticTokensTotalSupplyGlobals(
          ~marketIndex,
          ~longSyntheticToken=smockedSynthLong.address,
          ~shortSyntheticToken=smockedSynthShort.address,
        );
      });
      let testHandleChangeInSyntheticTokensTotalSupply =
          (~isLong, ~syntheticTokenRef) => {
        describe("changeInSyntheticTokensTotalSupply > 0", () => {
          let changeInSyntheticTokensTotalSupply = Helpers.randomTokenAmount();
          before_each(() => {
            let {longShort} = contracts.contents;

            longShort->LongShort.Exposed._handleChangeInSyntheticTokensTotalSupplyExposed(
              ~marketIndex,
              ~isLong,
              ~changeInSyntheticTokensTotalSupply,
            );
          });
          it(
            "should call the mint function on the correct synthetic token with correct arguments.",
            () => {
              let mintCalls =
                syntheticTokenRef.contents->SyntheticTokenSmocked.mintCalls;
              Chai.recordArrayDeepEqualFlat(
                mintCalls,
                [|
                  {
                    _to: contracts.contents.longShort.address,
                    amount: changeInSyntheticTokensTotalSupply,
                  },
                |],
              );
            },
          );
          it("should NOT call the burn function.", () => {
            let burnCalls =
              syntheticTokenRef.contents->SyntheticTokenSmocked.burnCalls;
            Chai.recordArrayDeepEqualFlat(burnCalls, [||]);
          });
        });
        describe("changeInSyntheticTokensTotalSupply < 0", () => {
          let changeInSyntheticTokensTotalSupply =
            zeroBn->sub(Helpers.randomTokenAmount());
          before_each(() => {
            let {longShort} = contracts.contents;

            longShort->LongShort.Exposed._handleChangeInSyntheticTokensTotalSupplyExposed(
              ~marketIndex,
              ~isLong,
              ~changeInSyntheticTokensTotalSupply,
            );
          });
          it(
            "should NOT call the mint function on the correct synthetic token.",
            () => {
            let mintCalls =
              syntheticTokenRef.contents->SyntheticTokenSmocked.mintCalls;
            Chai.recordArrayDeepEqualFlat(mintCalls, [||]);
          });
          it(
            "should call the burn function on the correct synthetic token with correct arguments.",
            () => {
              let burnCalls =
                syntheticTokenRef.contents->SyntheticTokenSmocked.burnCalls;
              Chai.recordArrayDeepEqualFlat(
                burnCalls,
                [|
                  {amount: zeroBn->sub(changeInSyntheticTokensTotalSupply)},
                |],
              );
            },
          );
        });
        describe("changeInSyntheticTokensTotalSupply == 0", () => {
          it("should call NEITHER the mint NOR burn function.", () => {
            let changeInSyntheticTokensTotalSupply = zeroBn;
            let {longShort} = contracts.contents;

            let%Await _ =
              longShort->LongShort.Exposed._handleChangeInSyntheticTokensTotalSupplyExposed(
                ~marketIndex,
                ~isLong,
                ~changeInSyntheticTokensTotalSupply,
              );
            let mintCalls =
              syntheticTokenRef.contents->SyntheticTokenSmocked.mintCalls;
            let burnCalls =
              syntheticTokenRef.contents->SyntheticTokenSmocked.burnCalls;
            Chai.recordArrayDeepEqualFlat(mintCalls, [||]);
            Chai.recordArrayDeepEqualFlat(burnCalls, [||]);
          })
        });
      };
      describe("LongSide", () => {
        testHandleChangeInSyntheticTokensTotalSupply(
          ~isLong=true,
          ~syntheticTokenRef=longSyntheticToken,
        );
        testHandleChangeInSyntheticTokensTotalSupply(
          ~isLong=false,
          ~syntheticTokenRef=shortSyntheticToken,
        );
      });
    });
    describe(
      "_handleTotalPaymentTokenValueChangeForMarketWithYieldManager", () => {
      let yieldManagerRef = ref("Not Set Yet"->Obj.magic);

      before_each(() => {
        let {longShort, markets} = contracts.contents;
        let {yieldManager} = markets->Array.getUnsafe(0);

        let%Await smockedYieldManager =
          YieldManagerMockSmocked.make(yieldManager);

        yieldManagerRef := smockedYieldManager;

        let _ =
          smockedYieldManager->YieldManagerMockSmocked.mockDepositPaymentTokenToReturn;
        let _ =
          smockedYieldManager->YieldManagerMockSmocked.mockRemovePaymentTokenFromMarketToReturn;

        longShort->LongShort.Exposed.setHandleTotalValueChangeForMarketWithYieldManagerGlobals(
          ~marketIndex,
          ~yieldManager=smockedYieldManager.address,
        );
      });
      describe("totalPaymentTokenValueChangeForMarket > 0", () => {
        let totalPaymentTokenValueChangeForMarket =
          Helpers.randomTokenAmount();
        before_each(() => {
          let {longShort} = contracts.contents;

          longShort->LongShort.Exposed._handleTotalPaymentTokenValueChangeForMarketWithYieldManagerExposed(
            ~marketIndex,
            ~totalPaymentTokenValueChangeForMarket,
          );
        });
        it(
          "should call the depositPaymentToken function on the correct synthetic token with correct arguments.",
          () => {
            let depositPaymentTokenCalls =
              yieldManagerRef.contents
              ->YieldManagerMockSmocked.depositPaymentTokenCalls;
            Chai.recordArrayDeepEqualFlat(
              depositPaymentTokenCalls,
              [|{amount: totalPaymentTokenValueChangeForMarket}|],
            );
          },
        );
        it("should NOT call the removePaymentTokenFromMarket function.", () => {
          let burnCalls =
            yieldManagerRef.contents
            ->YieldManagerMockSmocked.removePaymentTokenFromMarketCalls;
          Chai.recordArrayDeepEqualFlat(burnCalls, [||]);
        });
      });
      describe("totalPaymentTokenValueChangeForMarket < 0", () => {
        let totalPaymentTokenValueChangeForMarket =
          zeroBn->sub(Helpers.randomTokenAmount());
        before_each(() => {
          let {longShort} = contracts.contents;

          longShort->LongShort.Exposed._handleTotalPaymentTokenValueChangeForMarketWithYieldManagerExposed(
            ~marketIndex,
            ~totalPaymentTokenValueChangeForMarket,
          );
        });
        it(
          "should NOT call the depositPaymentToken function on the correct synthetic token.",
          () => {
            let mintCalls =
              yieldManagerRef.contents
              ->YieldManagerMockSmocked.depositPaymentTokenCalls;
            Chai.recordArrayDeepEqualFlat(mintCalls, [||]);
          },
        );
        it(
          "should call the removePaymentTokenFromMarket function on the correct synthetic token with correct arguments.",
          () => {
            let burnCalls =
              yieldManagerRef.contents
              ->YieldManagerMockSmocked.removePaymentTokenFromMarketCalls;
            Chai.recordArrayDeepEqualFlat(
              burnCalls,
              [|
                {amount: zeroBn->sub(totalPaymentTokenValueChangeForMarket)},
              |],
            );
          },
        );
      });
      describe("totalPaymentTokenValueChangeForMarket == 0", () => {
        it(
          "should call NEITHER the depositPaymentToken NOR removePaymentTokenFromMarket function.",
          () => {
            let totalPaymentTokenValueChangeForMarket = zeroBn;
            let {longShort} = contracts.contents;

            let%Await _ =
              longShort->LongShort.Exposed._handleTotalPaymentTokenValueChangeForMarketWithYieldManagerExposed(
                ~marketIndex,
                ~totalPaymentTokenValueChangeForMarket,
              );
            let mintCalls =
              yieldManagerRef.contents
              ->YieldManagerMockSmocked.depositPaymentTokenCalls;
            let burnCalls =
              yieldManagerRef.contents
              ->YieldManagerMockSmocked.removePaymentTokenFromMarketCalls;
            Chai.recordArrayDeepEqualFlat(mintCalls, [||]);
            Chai.recordArrayDeepEqualFlat(burnCalls, [||]);
          },
        )
      });
    });
  });
};
