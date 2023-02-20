open LetOps;
open StakerHelpers;
open Mocha;
open Globals;

let getRequiredAmountOfBitShiftForSafeExponentiation = (number, exponent) => {
  let amountOfBitShiftRequired = ref(bnFromInt(0));
  let targetMaxNumberSizeBinaryDigits = bnFromInt(256)->div(exponent);

  // Note this can be optimised, this gets a quick easy to compute safe upper bound, not the actuall upper bound.
  let targetMaxNumber = twoBn->pow(targetMaxNumberSizeBinaryDigits);

  while (number
         ->div(twoBn->pow(amountOfBitShiftRequired.contents))
         ->bnGt(targetMaxNumber)) {
    amountOfBitShiftRequired := amountOfBitShiftRequired.contents->add(oneBn);
  };
  amountOfBitShiftRequired.contents;
};

let test =
    (
      ~contracts: ref(Helpers.coreContracts),
      ~accounts: ref(array(Ethers.Wallet.t)),
    ) => {
  let marketIndex = 1;

  let (kVal, longPrice, shortPrice, randomValueLocked1, randomValueLocked2) =
    Helpers.Tuple.make5(Helpers.randomTokenAmount);

  describe("calculateFloatPerSecond", () => {
    let calculateFloatPerSecondPerPaymentTokenLocked =
        (
          ~underBalancedSideValue,
          ~exponent,
          ~equilibriumOffsetMarketScaled,
          ~totalLocked,
          ~requiredBitShifting,
          ~multiplier,
        ) => {
      let overflowProtectionDivision = twoBn->pow(requiredBitShifting);

      let numerator =
        underBalancedSideValue
        ->add(equilibriumOffsetMarketScaled->mul(multiplier))
        ->div(overflowProtectionDivision->div(twoBn))
        ->pow(exponent);

      let denominator =
        totalLocked->div(overflowProtectionDivision)->pow(exponent);

      let overBalancedSideRate =
        numerator->mul(tenToThe18)->div(denominator)->div(twoBn);

      let underBalancedSideRate = tenToThe18->sub(overBalancedSideRate);

      Chai.expectTrue(underBalancedSideRate->bnGte(overBalancedSideRate));
      (overBalancedSideRate, underBalancedSideRate);
    };

    let balanceIncentiveCurve_exponent = ref(None->Obj.magic);
    let safeExponentBitShifting = ref(None->Obj.magic);

    before_each(() => {
      let%Await _ =
        deployAndSetupStakerToUnitTest(
          ~functionName="_calculateFloatPerSecond",
          ~contracts,
          ~accounts,
        );
      let%AwaitThen balanceIncentiveCurve_exponentFetched =
        contracts^.staker->Staker.balanceIncentiveCurve_exponent(marketIndex);
      balanceIncentiveCurve_exponent := balanceIncentiveCurve_exponentFetched;

      let%Await safeExponentBitShiftingFetched =
        contracts.contents.staker->Staker.safeExponentBitShifting;
      safeExponentBitShifting := safeExponentBitShiftingFetched;

      StakerSmocked.InternalMock.mock_getKValueToReturn(kVal);
    });

    let testHelper = (~longPrice, ~shortPrice, ~longValue, ~shortValue) => {
      let totalLocked = longValue->add(shortValue);

      let%AwaitThen balanceIncentiveCurve_equilibriumOffset =
        contracts.contents.staker
        ->Staker.balanceIncentiveCurve_equilibriumOffset(marketIndex);

      let equilibriumOffsetMarketScaled =
        balanceIncentiveCurve_equilibriumOffset
        ->mul(totalLocked)
        ->div(twoBn)
        ->div(tenToThe18);

      let%Await result =
        contracts.contents.staker
        ->Staker.Exposed._calculateFloatPerSecondExposed(
            ~marketIndex,
            ~longPrice,
            ~shortPrice,
            ~longValue,
            ~shortValue,
          );

      let longFloatPerSecond: Ethers.BigNumber.t = result.longFloatPerSecond;
      let shortFloatPerSecond: Ethers.BigNumber.t = result.shortFloatPerSecond;

      let longRateScaled = ref(None->Obj.magic);
      let shortRateScaled = ref(None->Obj.magic);

      if (longValue->bnGte(shortValue->sub(equilibriumOffsetMarketScaled))) {
        if (equilibriumOffsetMarketScaled->bnGte(shortValue)) {
          shortRateScaled := tenToThe18->mul(kVal)->mul(longPrice);
          longRateScaled := zeroBn;
        } else {
          let (longRate, shortRate) =
            calculateFloatPerSecondPerPaymentTokenLocked(
              ~underBalancedSideValue=shortValue,
              ~exponent=balanceIncentiveCurve_exponent^,
              ~equilibriumOffsetMarketScaled,
              ~totalLocked,
              ~requiredBitShifting=safeExponentBitShifting^,
              ~multiplier=bnFromInt(-1),
            );

          longRateScaled :=
            longRate->mul(kVal)->mul(longPrice)->div(tenToThe18);
          shortRateScaled :=
            shortRate->mul(kVal)->mul(shortPrice)->div(tenToThe18);
        };
      } else if (equilibriumOffsetMarketScaled
                 ->mul(bnFromInt(-1))
                 ->bnGte(longValue)) {
        shortRateScaled := zeroBn;
        longRateScaled := tenToThe18->mul(kVal)->mul(longPrice);
      } else {
        let (shortRate, longRate) =
          calculateFloatPerSecondPerPaymentTokenLocked(
            ~underBalancedSideValue=longValue,
            ~exponent=balanceIncentiveCurve_exponent^,
            ~equilibriumOffsetMarketScaled,
            ~totalLocked,
            ~requiredBitShifting=safeExponentBitShifting^,
            ~multiplier=oneBn,
          );

        longRateScaled :=
          longRate->mul(kVal)->mul(longPrice)->div(tenToThe18);
        shortRateScaled :=
          shortRate->mul(kVal)->mul(shortPrice)->div(tenToThe18);
      };

      longFloatPerSecond->Chai.bnEqual(longRateScaled^);
      shortFloatPerSecond->Chai.bnEqual(shortRateScaled^);
    };

    describe(
      "returns correct longFloatPerSecond and shortFloatPerSecond for each market side",
      () => {
        describe("without offset", () => {
          before_once'(() => {
            contracts.contents.staker
            ->Staker.Exposed.setEquilibriumOffset(
                ~marketIndex,
                ~balanceIncentiveCurve_equilibriumOffset=zeroBn,
              )
          });
          it("longValue > shortValue", () => {
            let%Await _ =
              testHelper(
                ~longValue=randomValueLocked1->add(randomValueLocked2),
                ~shortValue=randomValueLocked2,
                ~longPrice,
                ~shortPrice,
              );
            ();
          });
          it("longValue < shortValue", () => {
            let%Await _ =
              testHelper(
                ~longValue=randomValueLocked1,
                ~shortValue=randomValueLocked1->add(randomValueLocked2),
                ~longPrice,
                ~shortPrice,
              );
            ();
          });
        });
        describe("with negative offset", () => {
          before_once'(() => {
            contracts.contents.staker
            ->Staker.Exposed.setEquilibriumOffset(
                ~marketIndex,
                ~balanceIncentiveCurve_equilibriumOffset=
                  bnFromInt(-1)->mul(tenToThe18)->div(twoBn),
              )
          });
          it("longValue < shortValue", () => {
            let longValue = bnFromInt(25)->mul(tenToThe18);
            let shortValue = bnFromInt(75)->mul(tenToThe18);

            let%Await _ =
              testHelper(~longValue, ~shortValue, ~longPrice, ~shortPrice);
            ();
          });
          it("longValue > shortValue", () => {
            let shortValue = bnFromInt(25)->mul(tenToThe18);
            let longValue = bnFromInt(75)->mul(tenToThe18);

            let%Await _ =
              testHelper(~longValue, ~shortValue, ~longPrice, ~shortPrice);
            ();
          });
        });
        describe("with positive offset", () => {
          before_once'(() => {
            contracts.contents.staker
            ->Staker.Exposed.setEquilibriumOffset(
                ~marketIndex,
                ~balanceIncentiveCurve_equilibriumOffset=
                  tenToThe18->div(twoBn),
              )
          });
          it("longValue < shortValue", () => {
            let longValue = bnFromInt(10)->mul(tenToThe18);
            let shortValue = bnFromInt(90)->mul(tenToThe18);

            let%Await _ =
              testHelper(~longValue, ~shortValue, ~longPrice, ~shortPrice);
            ();
          });
          it("longValue > shortValue", () => {
            let shortValue = bnFromInt(10)->mul(tenToThe18);
            let longValue = bnFromInt(90)->mul(tenToThe18);

            let%Await _ =
              testHelper(~longValue, ~shortValue, ~longPrice, ~shortPrice);
            ();
          });
        });
      },
    );
    it("calls getKValue correctly", () => {
      StakerSmocked.InternalMock.mock_getKValueToReturn(kVal);

      let%Await _result =
        contracts^.staker
        ->Staker.Exposed._calculateFloatPerSecondExposed(
            ~marketIndex,
            ~longPrice,
            ~shortPrice,
            ~longValue=randomValueLocked1,
            ~shortValue=randomValueLocked2,
          );

      let call =
        StakerSmocked.InternalMock._getKValueCalls()->Array.getUnsafe(0);
      call->Chai.recordEqualFlat({marketIndex: marketIndex});
    });
  });
};
