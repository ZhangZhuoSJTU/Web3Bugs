open LetOps;
open Mocha;
open Helpers;

let testUnit =
    (
      ~contracts: ref(Helpers.coreContracts),
      ~accounts as _: ref(array(Ethers.Wallet.t)),
    ) => {
  describe("_getSyntheticTokenPrice", () => {
    it("should test function returns correct price", () => {
      let randomAmountPaymentToken = Helpers.randomTokenAmount();
      let randomAmountSyntheticToken = Helpers.randomTokenAmount();

      let%Await actualResult =
        contracts^.longShort
        ->LongShort.Exposed._getSyntheticTokenPriceExposed(
            ~amountPaymentTokenBackingSynth=randomAmountPaymentToken,
            ~amountSyntheticToken=randomAmountSyntheticToken,
          );

      let expectedResult =
        Contract.LongShortHelpers.calcSyntheticTokenPrice(
          ~amountPaymentToken=randomAmountPaymentToken,
          ~amountSyntheticToken=randomAmountSyntheticToken,
        );

      Chai.bnEqual(
        ~message=
          "expected result different to actual result for _getSyntheticTokenPrice call",
        actualResult,
        expectedResult,
      );
    })
  });

  describe("_getAmountPaymentToken", () => {
    it("should test function returns correct amount", () => {
      let randomAmountSyntheticToken = Helpers.randomTokenAmount();
      let randomTokenPrice = Helpers.randomTokenAmount();

      let%Await actualResult =
        contracts^.longShort
        ->LongShort.Exposed._getAmountPaymentTokenExposed(
            ~amountSyntheticToken=randomAmountSyntheticToken,
            ~syntheticTokenPriceInPaymentTokens=randomTokenPrice,
          );

      let expectedResult =
        Contract.LongShortHelpers.calcAmountPaymentToken(
          ~amountSyntheticToken=randomAmountSyntheticToken,
          ~price=randomTokenPrice,
        );
      Chai.bnEqual(
        ~message=
          "expected result different to actual result for _getAmountPaymentToken call",
        actualResult,
        expectedResult,
      );
    })
  });

  describe("_getAmountSyntheticToken", () => {
    it("should test function returns correct amount", () => {
      let randomAmountPaymentToken = Helpers.randomTokenAmount();
      let randomTokenPrice = Helpers.randomTokenAmount();

      let%Await actualResult =
        contracts^.longShort
        ->LongShort.Exposed._getAmountSyntheticTokenExposed(
            ~amountPaymentTokenBackingSynth=randomAmountPaymentToken,
            ~syntheticTokenPriceInPaymentTokens=randomTokenPrice,
          );

      let expectedResult =
        Contract.LongShortHelpers.calcAmountSyntheticToken(
          ~amountPaymentToken=randomAmountPaymentToken,
          ~price=randomTokenPrice,
        );

      Chai.bnEqual(
        ~message=
          "expected result different to actual result for _getAmountSyntheticTokencd call",
        actualResult,
        expectedResult,
      );
    })
  });
};
