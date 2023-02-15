open LetOps;
open Mocha;
open Globals;
open Helpers;

let testUnit =
    (
      ~contracts: ref(Helpers.longShortUnitTestContracts),
      ~accounts as _: ref(array(Ethers.Wallet.t)),
    ) => {
  describeUnit("_claimAndDistributeYieldThenRebalanceMarket", () => {
    let marketIndex = Helpers.randomJsInteger();
    let oldAssetPrice = Helpers.randomTokenAmount();
    let treasuryYieldPercent_e18 = Helpers.randomRatio1e18();

    let marketAmountFromYieldManager = Helpers.randomTokenAmount();

    before_once'(() => {
      contracts.contents.longShort
      ->LongShortSmocked.InternalMock.setupFunctionForUnitTesting(
          ~functionName="_claimAndDistributeYieldThenRebalanceMarket",
        )
    });

    let setup = (~newAssetPrice) => {
      contracts.contents.longShort
      ->LongShort.Exposed._claimAndDistributeYieldThenRebalanceMarketExposedCall(
          ~marketIndex,
          ~newAssetPrice,
          ~oldAssetPrice,
        );
    };

    let runTests =
        (
          ~marketSideValueInPaymentTokenLong,
          ~marketSideValueInPaymentTokenShort,
        ) => {
      let totalValueLockedInMarket =
        marketSideValueInPaymentTokenLong->add(
          marketSideValueInPaymentTokenShort,
        );

      let (yieldDistributedValueLong, yieldDistributedValueShort) =
        if (marketSideValueInPaymentTokenLong->bnGt(
              marketSideValueInPaymentTokenShort,
            )) {
          (
            marketSideValueInPaymentTokenLong,
            marketSideValueInPaymentTokenShort->add(
              marketAmountFromYieldManager,
            ),
          );
        } else {
          (
            marketSideValueInPaymentTokenLong->add(
              marketAmountFromYieldManager,
            ),
            marketSideValueInPaymentTokenShort,
          );
        };

      before_once'(() => {
        let%Await _ =
          contracts.contents.longShort
          ->LongShort.Exposed.setClaimAndDistributeYieldThenRebalanceMarketGlobals(
              ~marketIndex,
              ~marketSideValueInPaymentTokenLong,
              ~marketSideValueInPaymentTokenShort,
              ~yieldManager=contracts.contents.yieldManagerSmocked.address,
            );

        let isLongSideUnderbalanced =
          marketSideValueInPaymentTokenLong->bnLt(
            marketSideValueInPaymentTokenShort,
          );

        LongShortSmocked.InternalMock.mock_getYieldSplitToReturn(
          isLongSideUnderbalanced,
          treasuryYieldPercent_e18,
        );

        contracts.contents.yieldManagerSmocked
        ->YieldManagerAaveSmocked.mockDistributeYieldForTreasuryAndReturnMarketAllocationToReturn(
            marketAmountFromYieldManager,
          );
      });

      describe("Function calls", () => {
        before_once'(() => {
          let newAssetPrice =
            Helpers.adjustNumberRandomlyWithinRange(
              ~basisPointsMin=-99999,
              ~basisPointsMax=99999,
              oldAssetPrice,
            );

          setup(~newAssetPrice);
        });
        it("calls _getYieldSplit with correct parameters", () => {
          LongShortSmocked.InternalMock._getYieldSplitCalls()
          ->Chai.recordArrayDeepEqualFlat([|
              {
                marketIndex,
                longValue: marketSideValueInPaymentTokenLong,
                shortValue: marketSideValueInPaymentTokenShort,
                totalValueLockedInMarket,
              },
            |])
        });
        it(
          "gets the treasuryYieldPercent from _getYieldSplit and calls distributeYieldForTreasuryAndReturnMarketAllocation on the yieldManager with correct amount",
          () => {
          contracts.contents.yieldManagerSmocked
          ->YieldManagerAaveSmocked.distributeYieldForTreasuryAndReturnMarketAllocationCalls
          ->Chai.recordArrayDeepEqualFlat([|
              {
                totalValueRealizedForMarket: totalValueLockedInMarket,
                treasuryYieldPercent_e18,
              },
            |])
        });
      });

      it(
        "returns the correct updated long and short values when price has remained the same (newAssetPrice == oldAssetPrice)",
        () => {
          let newAssetPrice = oldAssetPrice;
          let%Await {longValue, shortValue} = setup(~newAssetPrice);

          Chai.bnEqual(yieldDistributedValueLong, longValue);
          Chai.bnEqual(yieldDistributedValueShort, shortValue);
        },
      );

      it(
        "returns the correct updated long and short values when price has increased (newAssetPrice > oldAssetPrice)",
        () => {
          // make the price increase
          let newAssetPrice =
            Helpers.adjustNumberRandomlyWithinRange(
              ~basisPointsMin=0,
              ~basisPointsMax=99999,
              oldAssetPrice,
            );

          let%Await {longValue, shortValue} = setup(~newAssetPrice);

          let unbalancedSidePoolValue =
            bnMin(yieldDistributedValueLong, yieldDistributedValueShort);

          let valueChange =
            newAssetPrice
            ->sub(oldAssetPrice)
            ->mul(unbalancedSidePoolValue)
            ->div(oldAssetPrice);

          Chai.bnEqual(
            yieldDistributedValueLong->add(valueChange),
            longValue,
          );
          Chai.bnEqual(
            yieldDistributedValueShort->sub(valueChange),
            shortValue,
          );
        },
      );

      it(
        "returns the correct updated long and short values when price has decreased (newAssetPrice < oldAssetPrice)",
        () => {
          // make the price decrease
          let newAssetPrice =
            Helpers.adjustNumberRandomlyWithinRange(
              ~basisPointsMin=-99999,
              ~basisPointsMax=0,
              oldAssetPrice,
            );

          let%Await {longValue, shortValue} = setup(~newAssetPrice);

          let unbalancedSidePoolValue =
            bnMin(yieldDistributedValueLong, yieldDistributedValueShort);

          let valueChange =
            newAssetPrice
            ->sub(oldAssetPrice)
            ->mul(unbalancedSidePoolValue)
            ->div(oldAssetPrice);

          Chai.bnEqual(
            yieldDistributedValueLong->add(valueChange),
            longValue,
          );
          Chai.bnEqual(
            yieldDistributedValueShort->sub(valueChange),
            shortValue,
          );
        },
      );
    };
    ();

    describe("Long Side is Overvalued", () => {
      let marketSideValueInPaymentTokenShort = Helpers.randomTokenAmount();
      let marketSideValueInPaymentTokenLong =
        marketSideValueInPaymentTokenShort->add(Helpers.randomTokenAmount());

      runTests(
        ~marketSideValueInPaymentTokenLong,
        ~marketSideValueInPaymentTokenShort,
      );
    });
    describe("Short Side is Overvalued", () => {
      let marketSideValueInPaymentTokenLong = Helpers.randomTokenAmount();
      let marketSideValueInPaymentTokenShort =
        marketSideValueInPaymentTokenLong->add(Helpers.randomTokenAmount());

      runTests(
        ~marketSideValueInPaymentTokenLong,
        ~marketSideValueInPaymentTokenShort,
      );
    });
  });
};
