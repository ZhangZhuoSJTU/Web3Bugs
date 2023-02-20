open Globals;
open LetOps;
open Mocha;

let testUnit =
    (
      ~contracts: ref(Helpers.stakerUnitTestContracts),
      ~accounts as _: ref(array(Ethers.Wallet.t)),
    ) => {
  describe("_calculateAccumulatedFloatInRange", () => {
    let marketIndex = Helpers.randomJsInteger();
    let rewardIndexTo = Helpers.randomTokenAmount();
    let rewardIndexFrom = Helpers.randomTokenAmount();
    let syntheticRewardFromLongToken = Helpers.randomTokenAmount();
    let syntheticRewardToLongToken =
      syntheticRewardFromLongToken->add(Helpers.randomTokenAmount());
    let syntheticRewardFromShortToken = Helpers.randomTokenAmount();
    let syntheticRewardToShortToken =
      syntheticRewardFromShortToken->add(Helpers.randomTokenAmount());

    let amountStakedLong = Helpers.randomTokenAmount();
    let amountStakedShort = Helpers.randomTokenAmount();

    before_once'(() => {
      let {staker, longShortSmocked} = contracts.contents;
      let%Await _ =
        staker->Staker.Exposed.setLongShort(
          ~longShort=longShortSmocked.address,
        );
      contracts.contents.staker
      ->StakerSmocked.InternalMock.setupFunctionForUnitTesting(
          ~functionName="_calculateAccumulatedFloatInRange",
        );
    });

    let setup = () => {
      let {staker} = contracts.contents;

      let%AwaitThen _ =
        staker->Staker.Exposed.setCalculateAccumulatedFloatInRangeGlobals(
          ~marketIndex,
          ~rewardIndexTo,
          ~rewardIndexFrom,
          ~syntheticRewardToLongToken,
          ~syntheticRewardFromLongToken,
          ~syntheticRewardToShortToken,
          ~syntheticRewardFromShortToken,
        );

      staker->Staker.Exposed._calculateAccumulatedFloatInRangeExposed(
        ~marketIndex,
        ~amountStakedLong,
        ~amountStakedShort,
        ~rewardIndexFrom,
        ~rewardIndexTo,
      );
    };

	// TODO: add tests to test case when amountStakedShort == 0 or amountStakedLong == 0
    it("[Happy Path] it calculates all the values correctly", () => {
      let%Await floatDue = setup();

      let expectedFloatDueLong =
        syntheticRewardToLongToken
        ->sub(syntheticRewardFromLongToken)
        ->mul(amountStakedLong)
        ->div(CONSTANTS.floatIssuanceFixedDecimal);

      let expectedFloatDueShort =
        syntheticRewardToShortToken
        ->sub(syntheticRewardFromShortToken)
        ->mul(amountStakedShort)
        ->div(CONSTANTS.floatIssuanceFixedDecimal);

      Chai.bnEqual(
        floatDue,
        expectedFloatDueLong->add(expectedFloatDueShort),
        ~message="calculated float due is incorrect",
      );
    });
  });
};
