open Globals;
open LetOps;
open Mocha;

let testUnit =
    (
      ~contracts: ref(Helpers.stakerUnitTestContracts),
      ~accounts: ref(array(Ethers.Wallet.t)),
    ) => {
  describe("shiftTokens", () => {
    let marketIndex = Helpers.randomJsInteger();
    let amountSyntheticTokensToShift = Helpers.randomTokenAmount();
    let amountSyntheticTokensToShiftBeforeValue = Helpers.randomTokenAmount();

    before_once'(() => {
      let {staker, longShortSmocked} = contracts.contents;
      let%Await _ =
        staker->Staker.Exposed.setLongShort(
          ~longShort=longShortSmocked.address,
        );
      contracts.contents.staker
      ->StakerSmocked.InternalMock.setupFunctionForUnitTesting(
          ~functionName="shiftTokens",
        );
    });

    let setup =
        (
          ~isShiftFromLong,
          ~amountSyntheticTokensToShiftBeforeValue,
          ~amountSyntheticTokensToShift,
          ~userNextPrice_stakedSyntheticTokenShiftIndex,
          ~batched_stakerNextTokenShiftIndex,
          ~userAmountStaked,
        ) => {
      let user = accounts.contents->Array.getUnsafe(0).address;
      let {staker, syntheticTokenSmocked} = contracts.contents;

      let%Await _ =
        staker->Staker.Exposed.setShiftTokensParams(
          ~marketIndex,
          ~isShiftFromLong,
          ~user,
          ~amountSyntheticTokensToShift=amountSyntheticTokensToShiftBeforeValue,
          ~userNextPrice_stakedSyntheticTokenShiftIndex,
          ~batched_stakerNextTokenShiftIndex,
          ~userAmountStaked,
          ~syntheticToken=syntheticTokenSmocked.address,
        );
      staker->Staker.shiftTokens(
        ~amountSyntheticTokensToShift,
        ~marketIndex,
        ~isShiftFromLong,
      );
    };

    let isShiftFromLong = true;

    it(
      "reverts if market doesn't exist or user doesn't have any staked tokens",
      () => {
      Chai.expectRevert(
        ~transaction=
          contracts.contents.staker
          ->Staker.shiftTokens(
              ~amountSyntheticTokensToShift,
              ~marketIndex,
              ~isShiftFromLong,
            ),
        ~reason="Not enough tokens to shift",
      )
    });

    it(
      "calls _mintAccumulatedFloat with the correct argumetns if the user has a 'confirmed' shift that needs to be settled",
      () => {
        let user = accounts.contents->Array.getUnsafe(0).address;
        let userNextPrice_stakedSyntheticTokenShiftIndex =
          Helpers.randomInteger();
        let batched_stakerNextTokenShiftIndex =
          userNextPrice_stakedSyntheticTokenShiftIndex->add(
            Helpers.randomInteger(),
          );

        let%Await _ =
          setup(
            ~isShiftFromLong,
            ~amountSyntheticTokensToShiftBeforeValue,
            ~userNextPrice_stakedSyntheticTokenShiftIndex,
            ~batched_stakerNextTokenShiftIndex,
            ~amountSyntheticTokensToShift,
            ~userAmountStaked=amountSyntheticTokensToShift,
          );

        let mintAccumulatedFloatCalls =
          StakerSmocked.InternalMock._mintAccumulatedFloatCalls();

        mintAccumulatedFloatCalls->Chai.recordArrayDeepEqualFlat([|
          {marketIndex, user},
        |]);
      },
    );

    it(
      "doesn't call _mintAccumulatedFloat if userNextPrice_stakedSyntheticTokenShiftIndex == 0",
      () => {
        let batched_stakerNextTokenShiftIndex = Helpers.randomInteger();

        let%Await _ =
          setup(
            ~isShiftFromLong,
            ~amountSyntheticTokensToShiftBeforeValue,
            ~userNextPrice_stakedSyntheticTokenShiftIndex=zeroBn,
            ~batched_stakerNextTokenShiftIndex,
            ~amountSyntheticTokensToShift,
            ~userAmountStaked=amountSyntheticTokensToShift,
          );

        let mintAccumulatedFloatCalls =
          StakerSmocked.InternalMock._mintAccumulatedFloatCalls();

        mintAccumulatedFloatCalls->Chai.recordArrayDeepEqualFlat([||]);
      },
    );
    it(
      "doesn't call _mintAccumulatedFloat if userNextPrice_stakedSyntheticTokenShiftIndex == batched_stakerNextTokenShiftIndex",
      () => {
        let userNextPrice_stakedSyntheticTokenShiftIndex =
          Helpers.randomInteger();
        let batched_stakerNextTokenShiftIndex = userNextPrice_stakedSyntheticTokenShiftIndex;

        let%Await _ =
          setup(
            ~isShiftFromLong,
            ~amountSyntheticTokensToShiftBeforeValue,
            ~userNextPrice_stakedSyntheticTokenShiftIndex,
            ~batched_stakerNextTokenShiftIndex,
            ~amountSyntheticTokensToShift,
            ~userAmountStaked=amountSyntheticTokensToShift,
          );

        let mintAccumulatedFloatCalls =
          StakerSmocked.InternalMock._mintAccumulatedFloatCalls();

        mintAccumulatedFloatCalls->Chai.recordArrayDeepEqualFlat([||]);
      },
    );

    it(
      "doesn't call _mintAccumulatedFloat if userNextPrice_stakedSyntheticTokenShiftIndex > batched_stakerNextTokenShiftIndex",
      () => {
        let batched_stakerNextTokenShiftIndex = Helpers.randomInteger();
        let userNextPrice_stakedSyntheticTokenShiftIndex =
          batched_stakerNextTokenShiftIndex->add(Helpers.randomInteger());

        let%Await _ =
          setup(
            ~isShiftFromLong,
            ~amountSyntheticTokensToShiftBeforeValue,
            ~userNextPrice_stakedSyntheticTokenShiftIndex,
            ~batched_stakerNextTokenShiftIndex,
            ~amountSyntheticTokensToShift,
            ~userAmountStaked=amountSyntheticTokensToShift,
          );

        let mintAccumulatedFloatCalls =
          StakerSmocked.InternalMock._mintAccumulatedFloatCalls();

        mintAccumulatedFloatCalls->Chai.recordArrayDeepEqualFlat([||]);
      },
    );

    it(
      "sets the userNextPrice_stakedSyntheticTokenShiftIndex for the user to the batched_stakerNextTokenShiftIndex value",
      () => {
        let batched_stakerNextTokenShiftIndex = Helpers.randomInteger();
        let user = accounts.contents->Array.getUnsafe(0).address;

        let%Await _ =
          setup(
            ~isShiftFromLong,
            ~amountSyntheticTokensToShiftBeforeValue,
            ~userNextPrice_stakedSyntheticTokenShiftIndex=zeroBn,
            ~batched_stakerNextTokenShiftIndex,
            ~amountSyntheticTokensToShift,
            ~userAmountStaked=amountSyntheticTokensToShift,
          );

        let%Await userNextPrice_stakedSyntheticTokenShiftIndexAfter =
          contracts.contents.staker
          ->Staker.userNextPrice_stakedSyntheticTokenShiftIndex(
              marketIndex,
              user,
            );

        Chai.bnEqual(
          userNextPrice_stakedSyntheticTokenShiftIndexAfter,
          batched_stakerNextTokenShiftIndex,
        );
      },
    );

    let sideSpecificTests = (~isShiftFromLong) => {
      it(
        "calls the shiftPositionFrom"
        ++ (isShiftFromLong ? "Long" : "Short")
        ++ "NextPrice function on long short with the correct parameters",
        () => {
          let {longShortSmocked} = contracts.contents;
          let batched_stakerNextTokenShiftIndex = Helpers.randomInteger();

          let%Await _ =
            setup(
              ~isShiftFromLong,
              ~amountSyntheticTokensToShiftBeforeValue,
              ~userNextPrice_stakedSyntheticTokenShiftIndex=zeroBn,
              ~batched_stakerNextTokenShiftIndex,
              ~amountSyntheticTokensToShift,
              ~userAmountStaked=amountSyntheticTokensToShift,
            );

          let shiftPositionFromLongNextPriceCalls =
            longShortSmocked->LongShortSmocked.shiftPositionFromLongNextPriceCalls;
          let shiftPositionFromShortNextPriceCalls =
            longShortSmocked->LongShortSmocked.shiftPositionFromShortNextPriceCalls;
          if (isShiftFromLong) {
            shiftPositionFromLongNextPriceCalls->Chai.recordArrayDeepEqualFlat([|
              {marketIndex, amountSyntheticTokensToShift},
            |]);
            shiftPositionFromShortNextPriceCalls->Chai.recordArrayDeepEqualFlat([||]);
          } else {
            shiftPositionFromLongNextPriceCalls->Chai.recordArrayDeepEqualFlat([||]);
            shiftPositionFromShortNextPriceCalls->Chai.recordArrayDeepEqualFlat([|
              {marketIndex, amountSyntheticTokensToShift},
            |]);
          };
        },
      );
      it(
        "updates the amountToShiftFrom"
        ++ (isShiftFromLong ? "Long" : "Short")
        ++ "User value with the amount to shift",
        () => {
          let batched_stakerNextTokenShiftIndex = Helpers.randomInteger();
          let user = accounts.contents->Array.getUnsafe(0).address;

          let%Await _ =
            setup(
              ~isShiftFromLong,
              ~amountSyntheticTokensToShiftBeforeValue,
              ~userNextPrice_stakedSyntheticTokenShiftIndex=zeroBn,
              ~batched_stakerNextTokenShiftIndex,
              ~amountSyntheticTokensToShift,
              ~userAmountStaked=amountSyntheticTokensToShift,
            );

          let getTotalAmountToShiftFromSide =
            isShiftFromLong
              ? Staker.userNextPrice_amountStakedSyntheticToken_toShiftAwayFrom_long
              : Staker.userNextPrice_amountStakedSyntheticToken_toShiftAwayFrom_short;

          let%Await totalAmountToShiftFromSide =
            contracts.contents.staker
            ->getTotalAmountToShiftFromSide(marketIndex, user);

          Chai.bnEqual(
            totalAmountToShiftFromSide,
            amountSyntheticTokensToShiftBeforeValue->add(
              amountSyntheticTokensToShift,
            ),
          );
        },
      );
    };

    describe("Shift from Long", () =>
      sideSpecificTests(~isShiftFromLong=true)
    );

    describe("Shift from Short", () =>
      sideSpecificTests(~isShiftFromLong=false)
    );
  });
};
