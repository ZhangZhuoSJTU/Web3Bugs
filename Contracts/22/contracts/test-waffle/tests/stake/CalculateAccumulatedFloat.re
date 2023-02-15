open Globals;
open LetOps;
open Mocha;

let makeIterator = anyArray => {
  let indexRef = ref(0);
  () => {
    let index = indexRef^;
    indexRef := (index + 1) mod anyArray->Array.length;
    anyArray->Array.getExn(index);
  };
};

let smockedCalculateAccumulatedFloatInRangeMultiBinding = [%raw
  {|(_r, arr) => _r.smocked._calculateAccumulatedFloatInRangeMock.will.return.with(makeIterator(arr))|}
];

// TODO: now that `_calculateAccumulatedFloatInRange` is unit tested, simplify these tests and use mocks correctly (this is a bit of an integration test)
let test = (~contracts: ref(Helpers.coreContracts)) =>
  describe("calculateAccumulatedFloat", () => {
    // generate all parameters randomly
    let marketIndex = Js.Math.random_int(1, 100000);
    let longToken = Ethers.Wallet.createRandom().address;
    let shortToken = Ethers.Wallet.createRandom().address;
    let user = Ethers.Wallet.createRandom().address;

    let accumulativeFloatPerTokenUserLong = Helpers.randomTokenAmount();
    let accumulativeFloatPerTokenLatestLong =
      accumulativeFloatPerTokenUserLong->add(Helpers.randomTokenAmount());
    let newUserAmountStakedLong = Helpers.randomTokenAmount();

    let accumulativeFloatPerTokenUserShort = Helpers.randomTokenAmount();
    let accumulativeFloatPerTokenLatestShort =
      accumulativeFloatPerTokenUserShort->add(Helpers.randomTokenAmount());
    let newUserAmountStakedShort = Helpers.randomTokenAmount();

    // TODO: this test isn't mocking `_calculateAccumulatedFloatInRange` - create tests for `_calculateAccumulatedFloatInRange` in isolation rather
    it("[HAPPY] should correctly return the float tokens due for the user", () => {
      let {staker} = contracts.contents;

      // Value of these two isn't important, as long as `usersLatestClaimedReward` is less than `newLatestRewardIndex`
      let usersLatestClaimedReward = Helpers.randomInteger();
      let newLatestRewardIndex =
        usersLatestClaimedReward->add(Helpers.randomInteger());

      let%AwaitThen _ =
        staker->Staker.Exposed.setFloatRewardCalcParams(
          ~marketIndex,
          ~longToken,
          ~shortToken,
          ~newLatestRewardIndex,
          ~user,
          ~usersLatestClaimedReward,
          ~accumulativeFloatPerTokenLatestLong,
          ~accumulativeFloatPerTokenLatestShort,
          ~accumulativeFloatPerTokenUserLong,
          ~accumulativeFloatPerTokenUserShort,
          ~newUserAmountStakedLong,
          ~newUserAmountStakedShort,
        );
      let%Await floatDue =
        staker->Staker.Exposed._calculateAccumulatedFloatExposedCall(
          ~marketIndex,
          ~user,
        );

      let expectedFloatDueLong =
        accumulativeFloatPerTokenLatestLong
        ->sub(accumulativeFloatPerTokenUserLong)
        ->mul(newUserAmountStakedLong)
        ->div(CONSTANTS.floatIssuanceFixedDecimal);

      let expectedFloatDueShort =
        accumulativeFloatPerTokenLatestShort
        ->sub(accumulativeFloatPerTokenUserShort)
        ->mul(newUserAmountStakedShort)
        ->div(CONSTANTS.floatIssuanceFixedDecimal);

      Chai.bnEqual(
        floatDue,
        expectedFloatDueLong->add(expectedFloatDueShort),
        ~message="calculated float due is incorrect",
      );
    });

    // TODO: this test isn't mocking `_calculateAccumulatedFloatInRange`
    it(
      "should return zero if `usersLatestClaimedReward` is equal to `newLatestRewardIndex`",
      () => {
        let {staker} = contracts.contents;

        // exact value doesn't matter, must be equal!
        let newLatestRewardIndex = Helpers.randomInteger();
        let usersLatestClaimedReward = newLatestRewardIndex;

        let%AwaitThen _ =
          staker->Staker.Exposed.setFloatRewardCalcParams(
            ~marketIndex,
            ~longToken,
            ~shortToken,
            ~newLatestRewardIndex,
            ~user,
            ~usersLatestClaimedReward,
            ~accumulativeFloatPerTokenLatestLong,
            ~accumulativeFloatPerTokenLatestShort,
            ~accumulativeFloatPerTokenUserLong,
            ~accumulativeFloatPerTokenUserShort,
            ~newUserAmountStakedLong,
            ~newUserAmountStakedShort,
          );
        let%Await floatDue =
          staker->Staker.Exposed._calculateAccumulatedFloatExposedCall(
            ~marketIndex,
            ~user,
          );

        Chai.bnEqual(
          floatDue,
          bnFromInt(0),
          ~message="calculated float due should be zero",
        );
      },
    );

    // TODO: this test isn't mocking `_calculateAccumulatedFloatInRange`
    it(
      "If the user has zero tokens staked they should get zero float tokens",
      () => {
      let {staker} = contracts.contents;
      // Value of these two isn't important, as long as `usersLatestClaimedReward` is less than `newLatestRewardIndex`
      let usersLatestClaimedReward = Helpers.randomInteger();
      let newLatestRewardIndex =
        usersLatestClaimedReward->add(Helpers.randomInteger());

      let%AwaitThen _ =
        staker->Staker.Exposed.setFloatRewardCalcParams(
          ~marketIndex,
          ~longToken,
          ~shortToken,
          ~newLatestRewardIndex,
          ~user,
          ~usersLatestClaimedReward,
          ~accumulativeFloatPerTokenLatestLong,
          ~accumulativeFloatPerTokenLatestShort,
          ~accumulativeFloatPerTokenUserLong,
          ~accumulativeFloatPerTokenUserShort,
          ~newUserAmountStakedLong=Ethers.BigNumber.fromInt(0),
          ~newUserAmountStakedShort=Ethers.BigNumber.fromInt(0),
        );
      let%Await floatDue =
        staker->Staker.Exposed._calculateAccumulatedFloatExposedCall(
          ~marketIndex,
          ~user,
        );
      Chai.bnEqual(
        floatDue,
        bnFromInt(0),
        ~message="calculated float due should be zero",
      );
    });

    describe("User has pending token shifts", () => {
      // Value of these two isn't important, as long as `usersLatestClaimedReward` is less than `newLatestRewardIndex`
      let usersLatestClaimedReward = Helpers.randomInteger();
      let rewardBeforeShiftInterval = Helpers.randomTokenAmount();
      let rewardAfterShiftInterval = Helpers.randomTokenAmount();
      let amountToShift = Helpers.randomTokenAmount();
      let userNextPrice_stakedSyntheticTokenShiftIndex =
        Helpers.randomInteger();
      let takerTokenShiftIndex_to_longShortMarketPriceSnapshotIndex_mapping =
        Helpers.randomInteger();
      let batched_stakerNextTokenShiftIndex =
        userNextPrice_stakedSyntheticTokenShiftIndex->add(oneBn);
      let stakerTokenShiftIndex_to_accumulativeFloatIssuanceSnapshotIndex_mapping =
        usersLatestClaimedReward->add(Helpers.randomInteger());
      let newLatestRewardIndex =
        stakerTokenShiftIndex_to_accumulativeFloatIssuanceSnapshotIndex_mapping->add(
          Helpers.randomInteger(),
        );
      let amountOfStakeShifted = Helpers.randomTokenAmount();
      let amountStakedBothSidesInitially =
        amountToShift->add(amountOfStakeShifted);
      let smockedLongShort = ref(LongShortSmocked.uninitializedValue);

      let setup = (~isShiftFromLong) => {
        let {staker, longShort} = contracts.contents;

        let%AwaitThen _ = staker->StakerSmocked.InternalMock.setup;

        let%AwaitThen _ =
          staker->StakerSmocked.InternalMock.setupFunctionForUnitTesting(
            ~functionName="_calculateAccumulatedFloat",
          );

        let%AwaitThen _ =
          staker->Staker.Exposed.setFloatRewardCalcParams(
            ~marketIndex,
            ~longToken,
            ~shortToken,
            ~newLatestRewardIndex,
            ~user,
            ~usersLatestClaimedReward,
            ~accumulativeFloatPerTokenLatestLong,
            ~accumulativeFloatPerTokenLatestShort,
            ~accumulativeFloatPerTokenUserLong,
            ~accumulativeFloatPerTokenUserShort,
            ~newUserAmountStakedLong=amountStakedBothSidesInitially,
            ~newUserAmountStakedShort=amountStakedBothSidesInitially,
          );
        let%AwaitThen _ =
          staker->Staker.Exposed.setShiftParams(
            ~marketIndex,
            ~user,
            ~shiftAmountLong=isShiftFromLong ? amountToShift : zeroBn,
            ~shiftAmountShort=isShiftFromLong ? zeroBn : amountToShift,
            ~userNextPrice_stakedSyntheticTokenShiftIndex,
            ~batched_stakerNextTokenShiftIndex,
            ~takerTokenShiftIndex_to_longShortMarketPriceSnapshotIndex_mapping,
            ~stakerTokenShiftIndex_to_accumulativeFloatIssuanceSnapshotIndex_mapping,
          );
        let%AwaitThen longShortSmocked = longShort->LongShortSmocked.make;
        let%AwaitThen _ =
          staker->Staker.Exposed.setLongShort(
            ~longShort=longShortSmocked.address,
          );
        longShortSmocked->LongShortSmocked.mockGetAmountSyntheticTokenToMintOnTargetSideToReturn(
          amountOfStakeShifted,
        );
        smockedLongShort := longShortSmocked;

        let _ =
          StakerSmocked.InternalMock.internalRef.contents
          ->Option.getUnsafe
          ->smockedCalculateAccumulatedFloatInRangeMultiBinding([|
              rewardBeforeShiftInterval,
              rewardAfterShiftInterval,
            |]);

        staker->Staker.Exposed._calculateAccumulatedFloatExposedCall(
          ~marketIndex,
          ~user,
        );
      };

      let runTestsForSide = (~isShiftFromLong) => {
        it("Should sum up the correct amount of float", () => {
          let%Await floatDue = setup(~isShiftFromLong);

          Chai.bnEqual(
            floatDue,
            rewardBeforeShiftInterval->add(rewardAfterShiftInterval),
            ~message="calculated float due should be zero",
          );
        });

        it(
          "it should call _calculateAccumulatedFloatInRange with the correct parameters",
          () => {
          let%Await _ = setup(~isShiftFromLong);

          let calculateAccumulatedFloatInRangeCalls =
            StakerSmocked.InternalMock._calculateAccumulatedFloatInRangeCalls();

          let stakeIncreasedSide =
            amountStakedBothSidesInitially->add(amountOfStakeShifted);
          let stakeDecreasedSide =
            amountStakedBothSidesInitially->sub(amountToShift);

          Chai.recordArrayDeepEqualFlat(
            calculateAccumulatedFloatInRangeCalls,
            [|
              {
                marketIndex,
                amountStakedLong: amountStakedBothSidesInitially,
                amountStakedShort: amountStakedBothSidesInitially,
                rewardIndexFrom: usersLatestClaimedReward,
                rewardIndexTo: stakerTokenShiftIndex_to_accumulativeFloatIssuanceSnapshotIndex_mapping,
              },
              {
                marketIndex,
                amountStakedLong:
                  isShiftFromLong ? stakeDecreasedSide : stakeIncreasedSide,
                amountStakedShort:
                  isShiftFromLong ? stakeIncreasedSide : stakeDecreasedSide,
                rewardIndexFrom: stakerTokenShiftIndex_to_accumulativeFloatIssuanceSnapshotIndex_mapping,
                rewardIndexTo: newLatestRewardIndex,
              },
            |],
          );
        });
        it(
          "it should call LongShort.getAmountSyntheticTokenToMintOnTargetSideCalls with the correct parameters",
          () => {
            let%Await _ = setup(~isShiftFromLong);

            let getAmountSyntheticTokenToMintOnTargetSideCalls =
              smockedLongShort.contents
              ->LongShortSmocked.getAmountSyntheticTokenToMintOnTargetSideCalls;

            Chai.recordArrayDeepEqualFlat(
              getAmountSyntheticTokenToMintOnTargetSideCalls,
              [|
                {
                  marketIndex,
                  amountSyntheticToken_redeemOnOriginSide: amountToShift,
                  isShiftFromLong,
                  priceSnapshotIndex: takerTokenShiftIndex_to_longShortMarketPriceSnapshotIndex_mapping,
                },
              |],
            );
          },
        );
        it(
          "it should reset "
          ++ (
            isShiftFromLong
              ? "userNextPrice_amountStakedSyntheticToken_toShiftAwayFrom_long"
              : "userNextPrice_amountStakedSyntheticToken_toShiftAwayFrom_short"
          )
          ++ " to zero.",
          () => {
            let%Await _ = setup(~isShiftFromLong);

            // the setup function only simulates the call, it doesn't execute it, execute it here.
            let%Await _ =
              contracts.contents.staker
              ->Staker.Exposed._calculateAccumulatedFloatExposed(
                  ~marketIndex,
                  ~user,
                );

            let getAmountToShiftFromSideUser =
              isShiftFromLong
                ? Staker.userNextPrice_amountStakedSyntheticToken_toShiftAwayFrom_long
                : Staker.userNextPrice_amountStakedSyntheticToken_toShiftAwayFrom_short;

            let%Await amountToShiftForSideAfter =
              contracts.contents.staker
              ->getAmountToShiftFromSideUser(marketIndex, user);

            Chai.bnEqual(amountToShiftForSideAfter, zeroBn);
          },
        );
      };
      describe("Shift from Long", () =>
        runTestsForSide(~isShiftFromLong=true)
      );
      describe("Shift from Short", () =>
        runTestsForSide(~isShiftFromLong=false)
      );

      it(
        "it should reset the users userNextPrice_stakedSyntheticTokenShiftIndex to zero",
        () => {
        let%Await _ = setup(~isShiftFromLong=true);

        // the setup function only simulates the call, it doesn't execute it, execute it here.
        let%Await _ =
          contracts.contents.staker
          ->Staker.Exposed._calculateAccumulatedFloatExposed(
              ~marketIndex,
              ~user,
            );

        let%Await usersShiftIndex =
          contracts.contents.staker
          ->Staker.userNextPrice_stakedSyntheticTokenShiftIndex(
              marketIndex,
              user,
            );

        Chai.bnEqual(usersShiftIndex, zeroBn);
      });
      // TODO: add test to test case where there are both shifts from long and from short
    });
  });
