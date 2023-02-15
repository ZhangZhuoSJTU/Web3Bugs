open LetOps;
open Mocha;
open Globals;

let randomValueChange = tokenAmount => {
  tokenAmount
  ->mul(Js.Math.random_int(-100, 101)->Ethers.BigNumber.fromInt)
  ->div(Ethers.BigNumber.fromUnsafe("100"));
};

let testUnit =
    (
      ~contracts: ref(Helpers.coreContracts),
      ~accounts: ref(array(Ethers.Wallet.t)),
    ) => {
  describeUnit("updateSystemState", () => {
    describe("_updateSystemStateInternal", () => {
      let getWalletBinding: StakerSmocked.t => Ethers.Wallet.t = [%raw
        {|(_r) => { return _r.wallet;}|}
      ];

      let send1Ether = [%raw
        {|(wallet, address) => {
          const tx = {
              to: address,
              value: ethers.utils.parseUnits('1.0', 'ether')
          };
          return wallet.sendTransaction(tx);
        }|}
      ];
      let marketIndex = Helpers.randomJsInteger();

      let (
        oldAssetPrice,
        oldLongPrice,
        oldShortPrice,
        oldLongValue,
        oldShortValue,
        oldLongValueAfterYield,
        oldShortValueAfterYield,
      ) =
        Helpers.Tuple.make7(Helpers.randomTokenAmount);

      let (longSynthSupply, shortSynthSupply) =
        Helpers.Tuple.make2(Helpers.randomTokenAmount);

      let valueChangeLong = randomValueChange(oldLongValueAfterYield);
      let valueChangeShort = randomValueChange(oldShortValueAfterYield);

      let newAssetPrice = oldAssetPrice->add(oneBn);

      let latestUpdateIndexForMarket = Helpers.randomInteger();

      let staker: ref(StakerSmocked.t) = ref(None->Obj.magic);
      let oracle: ref(OracleManagerMockSmocked.t) = ref(None->Obj.magic);
      let longSynth: ref(SyntheticTokenSmocked.t) = ref(None->Obj.magic);
      let shortSynth: ref(SyntheticTokenSmocked.t) = ref(None->Obj.magic);

      let potentialNewLongPrice: ref(Ethers.BigNumber.t) = ref(zeroBn);
      let potentialNewShortPrice: ref(Ethers.BigNumber.t) = ref(zeroBn);
      let setup =
          (
            ~oldAssetPrice,
            ~newAssetPrice,
            ~oldLongPrice,
            ~oldShortPrice,
            ~fromStaker,
            ~stakerNextPrice_currentUpdateIndex,
          ) => {
        let%AwaitThen _ =
          contracts.contents.longShort->LongShortSmocked.InternalMock.setup;
        let%AwaitThen _ =
          contracts.contents.longShort
          ->LongShortSmocked.InternalMock.setupFunctionForUnitTesting(
              ~functionName="_updateSystemStateInternal",
            );

        LongShortSmocked.InternalMock.mock_claimAndDistributeYieldThenRebalanceMarketToReturn(
          oldLongValueAfterYield,
          oldShortValueAfterYield,
        );
        LongShortSmocked.InternalMock.mock_batchConfirmOutstandingPendingActionsToReturn(
          valueChangeLong,
          valueChangeShort,
        );

        let%AwaitThen stakerSmocked =
          StakerSmocked.make(contracts.contents.staker);

        let stakerWallet = stakerSmocked->getWalletBinding;

        let%AwaitThen _ =
          send1Ether(
            accounts.contents->Array.getUnsafe(0),
            stakerWallet.address,
          );

        let _ =
          stakerSmocked->StakerSmocked.mockPushUpdatedMarketPricesToUpdateFloatIssuanceCalculationsToReturn;
        let%AwaitThen oracleSmocked =
          contracts.contents.markets->Array.getExn(1).oracleManager
          ->OracleManagerMockSmocked.make;

        let _ =
          oracleSmocked->OracleManagerMockSmocked.mockUpdatePriceToReturn(
            newAssetPrice,
          );

        oracle := oracleSmocked;
        staker := stakerSmocked;

        let%AwaitThen longSynthSmocked =
          contracts.contents.markets->Array.getExn(1).longSynth
          ->SyntheticTokenSmocked.make;

        longSynthSmocked->SyntheticTokenSmocked.mockTotalSupplyToReturn(
          longSynthSupply,
        );

        longSynth := longSynthSmocked;

        let%AwaitThen shortSynthSmocked =
          contracts.contents.markets->Array.getExn(1).shortSynth
          ->SyntheticTokenSmocked.make;

        shortSynthSmocked->SyntheticTokenSmocked.mockTotalSupplyToReturn(
          shortSynthSupply,
        );

        shortSynth := shortSynthSmocked;

        let longShort =
          fromStaker
            ? contracts.contents.longShort
              ->ContractHelpers.connect(~address=stakerWallet)
            : contracts.contents.longShort;

        // function is pure so we don't mock it
        let%AwaitThen predictedLongPrice =
          longShort->LongShort.Exposed._getSyntheticTokenPriceExposed(
            ~amountPaymentTokenBackingSynth=oldLongValueAfterYield,
            ~amountSyntheticToken=longSynthSupply,
          );

        potentialNewLongPrice := predictedLongPrice;

        let%AwaitThen predictedShortPrice =
          longShort->LongShort.Exposed._getSyntheticTokenPriceExposed(
            ~amountPaymentTokenBackingSynth=oldShortValueAfterYield,
            ~amountSyntheticToken=shortSynthSupply,
          );

        potentialNewShortPrice := predictedShortPrice;

        let%AwaitThen _ =
          longShort->LongShort.Exposed.set_updateSystemStateInternalGlobals(
            ~marketIndex,
            ~latestUpdateIndexForMarket,
            ~syntheticTokenPrice_inPaymentTokens_long=oldLongPrice,
            ~syntheticTokenPrice_inPaymentTokens_short=oldShortPrice,
            ~assetPrice=oldAssetPrice,
            ~oracleManager=oracleSmocked.address,
            ~staker=stakerSmocked.address,
            ~longValue=oldLongValue,
            ~shortValue=oldShortValue,
            ~synthLong=longSynthSmocked.address,
            ~synthShort=shortSynthSmocked.address,
            ~stakerNextPrice_currentUpdateIndex,
          );

        longShort->LongShort.Exposed._updateSystemStateInternalExposed(
          ~marketIndex,
        );
      };
      let setupWithoutPriceChange =
        setup(
          ~oldAssetPrice,
          ~newAssetPrice=oldAssetPrice,
          ~oldLongPrice,
          ~oldShortPrice,
        );

      let assertNoUpdateStateOrNonOracleCalls = (~checkNoStakerCalls) => {
        if (checkNoStakerCalls) {
          let numberOfStakerCalls =
            staker.contents
            ->StakerSmocked.pushUpdatedMarketPricesToUpdateFloatIssuanceCalculationsCalls
            ->Array.length;
          Chai.intEqual(numberOfStakerCalls, 0);
        };

        let numberOfClaimAndAdjustCalls =
          LongShortSmocked.InternalMock._claimAndDistributeYieldThenRebalanceMarketCalls()
          ->Array.length;
        let numberOfGetTokenPriceCalls =
          LongShortSmocked.InternalMock._getSyntheticTokenPriceCalls()
          ->Array.length;
        let numberOfOutstandingSettlementCalls =
          LongShortSmocked.InternalMock._batchConfirmOutstandingPendingActionsCalls()
          ->Array.length;

        let numberOfTotalSupplyLongCalls =
          longSynth.contents
          ->SyntheticTokenSmocked.totalSupplyCalls
          ->Array.length;
        let numberOfTotalSupplyShortCalls =
          shortSynth.contents
          ->SyntheticTokenSmocked.totalSupplyCalls
          ->Array.length;

        let%AwaitThen updateIndex =
          contracts.contents.longShort
          ->LongShort.marketUpdateIndex(marketIndex);

        let%AwaitThen newLongPrice =
          contracts.contents.longShort
          ->LongShort.syntheticToken_priceSnapshot(
              marketIndex,
              true,
              updateIndex,
            );

        let%AwaitThen newShortPrice =
          contracts.contents.longShort
          ->LongShort.syntheticToken_priceSnapshot(
              marketIndex,
              false,
              updateIndex,
            );

        let%Await assetPrice =
          contracts.contents.longShort->LongShort.assetPrice(marketIndex);

        Chai.bnEqual(oldAssetPrice, assetPrice);
        Chai.bnEqual(updateIndex, latestUpdateIndexForMarket);
        Chai.bnEqual(newLongPrice, oldLongPrice);
        Chai.bnEqual(newShortPrice, oldShortPrice);

        Chai.intEqual(numberOfClaimAndAdjustCalls, 0);
        Chai.intEqual(numberOfGetTokenPriceCalls, 0);

        Chai.intEqual(numberOfTotalSupplyLongCalls, 0);
        Chai.intEqual(numberOfTotalSupplyShortCalls, 0);

        Chai.intEqual(numberOfOutstandingSettlementCalls, 0);
      };

      it("calls for the latest price from the oracle", () => {
        let%Await _ =
          setupWithoutPriceChange(
            ~fromStaker=true,
            ~stakerNextPrice_currentUpdateIndex=zeroBn,
          );
        oracle.contents
        ->OracleManagerMockSmocked.updatePriceCalls
        ->Array.length
        ->Chai.intEqual(1);
      });

      it(
        "calls pushUpdatedMarketPricesToUpdateFloatIssuanceCalculations on the staker if the staker has pending nextPrice shifts",
        () => {
          let stakerNextPrice_currentUpdateIndex =
            latestUpdateIndexForMarket->add(oneBn);
          let%Await _ =
            setup(
              ~oldAssetPrice,
              ~newAssetPrice,
              ~oldLongPrice,
              ~oldShortPrice,
              ~fromStaker=true,
              ~stakerNextPrice_currentUpdateIndex,
            );

          staker.contents
          ->StakerSmocked.pushUpdatedMarketPricesToUpdateFloatIssuanceCalculationsCalls
          ->Chai.recordArrayDeepEqualFlat([|
              {
                marketIndex,
                longPrice: oldLongPrice,
                shortPrice: oldShortPrice,
                longValue: oldLongValue,
                shortValue: oldShortValue,
                stakerTokenShiftIndex_to_longShortMarketPriceSnapshotIndex_mappingIfShiftExecuted: stakerNextPrice_currentUpdateIndex,
              },
            |]);
        },
      );

      it(
        "it shouldn't modify state or call other functions IF the `msg.sender` isn't the staker AND the price didn't change",
        () => {
          let%AwaitThen _ =
            setupWithoutPriceChange(
              ~fromStaker=false,
              ~stakerNextPrice_currentUpdateIndex=zeroBn,
            );

          assertNoUpdateStateOrNonOracleCalls(~checkNoStakerCalls=true);
        },
      );

      it(
        "it should call the pushUpdatedMarketPricesToUpdateFloatIssuanceCalculations on the staker function if the `msg.sender` is the staker (with NO price change) but not update any state or call other functions in the LongShort contract",
        () => {
          let%AwaitThen _ =
            setupWithoutPriceChange(
              ~fromStaker=true,
              ~stakerNextPrice_currentUpdateIndex=zeroBn,
            );

          staker.contents
          ->StakerSmocked.pushUpdatedMarketPricesToUpdateFloatIssuanceCalculationsCalls
          ->Chai.recordArrayDeepEqualFlat([|
              {
                marketIndex,
                longPrice: oldLongPrice,
                shortPrice: oldShortPrice,
                longValue: oldLongValue,
                shortValue: oldShortValue,
                stakerTokenShiftIndex_to_longShortMarketPriceSnapshotIndex_mappingIfShiftExecuted: zeroBn,
              },
            |]);

          assertNoUpdateStateOrNonOracleCalls(~checkNoStakerCalls=false);
        },
      );

      describe("There is a price change", () => {
        let setupWithPriceChange =
          setup(
            ~oldAssetPrice,
            ~newAssetPrice,
            ~oldLongPrice,
            ~oldShortPrice,
          );

        it(
          "it should call the pushUpdatedMarketPricesToUpdateFloatIssuanceCalculations on the staker function if the `msg.sender` is the staker (WITH a price change)",
          () => {
            let%Await _ =
              setupWithPriceChange(
                ~fromStaker=true,
                ~stakerNextPrice_currentUpdateIndex=zeroBn,
              );
            staker.contents
            ->StakerSmocked.pushUpdatedMarketPricesToUpdateFloatIssuanceCalculationsCalls
            ->Chai.recordArrayDeepEqualFlat([|
                {
                  marketIndex,
                  longPrice: oldLongPrice,
                  shortPrice: oldShortPrice,
                  longValue: oldLongValue,
                  shortValue: oldShortValue,
                  stakerTokenShiftIndex_to_longShortMarketPriceSnapshotIndex_mappingIfShiftExecuted: zeroBn,
                },
              |]);
          },
        );

        it(
          "it should call `_claimAndDistributeYieldThenRebalanceMarket` with correct arguments",
          () => {
            let%Await _ =
              setupWithPriceChange(
                ~fromStaker=false,
                ~stakerNextPrice_currentUpdateIndex=zeroBn,
              );
            LongShortSmocked.InternalMock._claimAndDistributeYieldThenRebalanceMarketCalls()
            ->Chai.recordArrayDeepEqualFlat([|
                {marketIndex, oldAssetPrice, newAssetPrice},
              |]);
          },
        );
        it(
          "it should call `_performOustandingSettlements` with correct arguments",
          () => {
          let%Await _ =
            setupWithPriceChange(
              ~fromStaker=false,
              ~stakerNextPrice_currentUpdateIndex=zeroBn,
            );
          LongShortSmocked.InternalMock._batchConfirmOutstandingPendingActionsCalls()
          ->Chai.recordArrayDeepEqualFlat([|
              {
                marketIndex,
                syntheticTokenPrice_inPaymentTokens_long:
                  potentialNewLongPrice.contents,
                syntheticTokenPrice_inPaymentTokens_short:
                  potentialNewShortPrice.contents,
              },
            |]);
        });

        it("should call `totalSupply` on the long and short synth tokens", () => {
          let%Await _ =
            setupWithPriceChange(
              ~fromStaker=false,
              ~stakerNextPrice_currentUpdateIndex=zeroBn,
            );
          longSynth.contents
          ->SyntheticTokenSmocked.totalSupplyCalls
          ->Array.length
          ->Chai.intEqual(1);

          shortSynth.contents
          ->SyntheticTokenSmocked.totalSupplyCalls
          ->Array.length
          ->Chai.intEqual(1);
        });

        it(
          "should mutate syntheticToken_priceSnapshots for long and short correctly",
          () => {
          let%Await _ =
            setupWithPriceChange(
              ~fromStaker=false,
              ~stakerNextPrice_currentUpdateIndex=zeroBn,
            );
          let newUpdateIndex = latestUpdateIndexForMarket->add(oneBn);
          let%AwaitThen newLongPrice =
            contracts.contents.longShort
            ->LongShort.syntheticToken_priceSnapshot(
                marketIndex,
                true,
                newUpdateIndex,
              );

          let%Await newShortPrice =
            contracts.contents.longShort
            ->LongShort.syntheticToken_priceSnapshot(
                marketIndex,
                false,
                newUpdateIndex,
              );

          newLongPrice->Chai.bnEqual(potentialNewLongPrice.contents);
          newShortPrice->Chai.bnEqual(potentialNewShortPrice.contents);
        });

        it(
          "should mutate marketSideValueInPaymentTokens for long and short correctly",
          () => {
          let%AwaitThen _ =
            setupWithPriceChange(
              ~fromStaker=false,
              ~stakerNextPrice_currentUpdateIndex=zeroBn,
            );
          let%AwaitThen newLongValue =
            contracts.contents.longShort
            ->LongShort.marketSideValueInPaymentToken(marketIndex, true);

          let%Await newShortValue =
            contracts.contents.longShort
            ->LongShort.marketSideValueInPaymentToken(marketIndex, false);

          newLongValue->Chai.bnEqual(
            oldLongValueAfterYield->add(valueChangeLong),
          );
          newShortValue->Chai.bnEqual(
            oldShortValueAfterYield->add(valueChangeShort),
          );
        });

        it("it should update the (underlying) asset price correctly", () => {
          let%AwaitThen _ =
            setupWithPriceChange(
              ~fromStaker=false,
              ~stakerNextPrice_currentUpdateIndex=zeroBn,
            );
          let%Await assetPrice =
            contracts.contents.longShort->LongShort.assetPrice(marketIndex);
          Chai.bnEqual(assetPrice, newAssetPrice);
        });

        it("it should increment the marketUpdateIndex by 1", () => {
          let%AwaitThen _ =
            setupWithPriceChange(
              ~fromStaker=false,
              ~stakerNextPrice_currentUpdateIndex=zeroBn,
            );
          let%Await updateIndex =
            contracts.contents.longShort
            ->LongShort.marketUpdateIndex(marketIndex);
          Chai.bnEqual(latestUpdateIndexForMarket->add(oneBn), updateIndex);
        });

        it(
          "it should emit the SystemStateUpdated event with the correct arguments",
          () => {
          Chai.callEmitEvents(
            ~call=
              setupWithPriceChange(
                ~fromStaker=false,
                ~stakerNextPrice_currentUpdateIndex=zeroBn,
              ),
            ~eventName="SystemStateUpdated",
            ~contract=contracts.contents.longShort->Obj.magic,
          )
          ->Chai.withArgs7(
              marketIndex,
              latestUpdateIndexForMarket->add(oneBn),
              newAssetPrice,
              oldLongValueAfterYield->add(valueChangeLong),
              oldShortValueAfterYield->add(valueChangeShort),
              potentialNewLongPrice.contents,
              potentialNewShortPrice.contents,
            )
        });
      });
    });

    let setupWithUpdateSystemStateInternalMocked = (~functionName) => {
      let%AwaitThen _ =
        contracts.contents.longShort->LongShortSmocked.InternalMock.setup;
      let%Await _ =
        contracts.contents.longShort
        ->LongShortSmocked.InternalMock.setupFunctionForUnitTesting(
            ~functionName,
          );
      LongShortSmocked.InternalMock.mock_updateSystemStateInternalToReturn();
    };
    describe("updateSystemStateMulti", () => {
      it(
        "should call `_updateSystemStateInternal` for each market in the array",
        () => {
        let marketIndexes =
          Array.makeBy(Js.Math.random_int(0, 51), _ =>
            Helpers.randomJsInteger()
          );
        let%AwaitThen _ =
          setupWithUpdateSystemStateInternalMocked(
            ~functionName="updateSystemStateMulti",
          );

        // we don't mock modifiers
        let%AwaitThen _ =
          contracts.contents.longShort
          ->LongShort.Exposed.setMarketExistsMulti(~marketIndexes);

        let%Await _ =
          contracts.contents.longShort
          ->LongShort.updateSystemStateMulti(~marketIndexes);
        LongShortSmocked.InternalMock._updateSystemStateInternalCalls()
        ->Chai.recordArrayDeepEqualFlat(
            marketIndexes->Array.map(index => {
              let record: LongShortSmocked.InternalMock._updateSystemStateInternalCall = {
                marketIndex: index,
              };
              record;
            }),
          );
      })
    });
    describe("updateSystemState", () => {
      it(
        "should call to `_updateSystemStateInternal` with the correct market as an argument",
        () => {
          let marketIndex = Helpers.randomJsInteger();
          let%AwaitThen _ =
            setupWithUpdateSystemStateInternalMocked(
              ~functionName="updateSystemState",
            );

          let%AwaitThen _ =
            contracts.contents.longShort
            ->LongShort.Exposed.setMarketExistsMulti(
                ~marketIndexes=[|marketIndex|],
              );

          let%Await _ =
            contracts.contents.longShort
            ->LongShort.updateSystemState(~marketIndex);

          LongShortSmocked.InternalMock._updateSystemStateInternalCalls()
          ->Chai.recordArrayDeepEqualFlat([|{marketIndex: marketIndex}|]);
        },
      )
    });
  });
};

let testIntegration =
    (
      ~contracts: ref(Helpers.coreContracts),
      ~accounts: ref(array(Ethers.Wallet.t)),
    ) => {
  describe("updateSystemState", () => {
    let testDistributeYield = (~longIsOverBalanced) =>
      it(
        "distribute yield to markets flow "
        ++ (
          longIsOverBalanced ? "(long over balanced)" : "(short over balanced)"
        ),
        () => {
          let {longShort, markets} = contracts.contents;
          let {yieldManager, oracleManager, marketIndex, paymentToken} =
            markets->Array.getUnsafe(0);
          let testUser = accounts.contents->Array.getUnsafe(2);

          // 32.1... DAI - any random amount would do...
          let amountOfYieldToAward = bnFromString("3216543216543216542");

          let%Await amountToMintToGuaranteeImbalance =
            longShort->LongShort.marketSideValueInPaymentToken(
              marketIndex,
              !longIsOverBalanced,
            );
          // Make sure the correct side is over-balanced!
          let%AwaitThen _ =
            HelperActions.mintDirect(
              ~marketIndex,
              ~amount=amountToMintToGuaranteeImbalance,
              ~token=paymentToken,
              ~user=testUser,
              ~longShort,
              ~oracleManagerMock=oracleManager,
              ~isLong=longIsOverBalanced,
            );

          // get total balance pools etc before (and amount for treasury)
          let%Await longTokenPoolValueBefore =
            longShort->LongShort.marketSideValueInPaymentToken(
              marketIndex,
              true,
            );
          let%Await shortTokenPoolValueBefore =
            longShort->LongShort.marketSideValueInPaymentToken(
              marketIndex,
              false,
            );

          let%Await totalDueForTreasuryBefore =
            yieldManager->YieldManagerMock.totalReservedForTreasury;
          let totalValueRelatedToMarketBefore =
            longTokenPoolValueBefore
            ->add(shortTokenPoolValueBefore)
            ->add(totalDueForTreasuryBefore);

          // add some yield
          let _ =
            yieldManager->YieldManagerMock.settleWithYieldAbsolute(
              ~totalYield=amountOfYieldToAward,
            );

          // update oracle price
          let%Await currentOraclePrice =
            oracleManager->OracleManagerMock.getLatestPrice;
          let%Await _ =
            oracleManager->OracleManagerMock.setPrice(
              ~newPrice=currentOraclePrice->add(bnFromInt(1)),
            );

          // run long short update state
          let%Await _ = longShort->LongShort.updateSystemState(~marketIndex);

          // get total balance pools after and amount for treasury
          let%Await longTokenPoolValueAfter =
            longShort->LongShort.marketSideValueInPaymentToken(
              marketIndex,
              true,
            );
          let%Await shortTokenPoolValueAfter =
            longShort->LongShort.marketSideValueInPaymentToken(
              marketIndex,
              false,
            );
          let%Await totalDueForTreasuryAfter =
            yieldManager->YieldManagerMock.totalReservedForTreasury;
          let totalValueRelatedToMarketAfter =
            longTokenPoolValueAfter
            ->add(shortTokenPoolValueAfter)
            ->add(totalDueForTreasuryAfter);

          Chai.bnEqual(
            ~message=
              "yield is either being lost or over-allocated - should be exactly the same",
            totalValueRelatedToMarketBefore->add(amountOfYieldToAward),
            totalValueRelatedToMarketAfter,
          );
        },
      );

    testDistributeYield(~longIsOverBalanced=true);
    testDistributeYield(~longIsOverBalanced=false);
    it("cannot call updateSystemState on a market that doesn't exist", () => {
      let nonExistantMarketIndex = 321321654;
      Chai.expectRevert(
        ~transaction=
          contracts.contents.longShort
          ->LongShort.updateSystemState(~marketIndex=nonExistantMarketIndex),
        ~reason="market doesn't exist",
      );
    });
  });
};
