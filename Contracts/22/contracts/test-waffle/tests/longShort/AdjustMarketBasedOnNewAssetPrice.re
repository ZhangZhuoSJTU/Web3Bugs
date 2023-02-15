open Mocha;
open Globals;

let testUnit =
    (
      ~contracts as _: ref(Helpers.coreContracts),
      ~accounts as _: ref(array(Ethers.Wallet.t)),
    ) => {
  describeUnit("_adjustMarketBasedOnNewAssetPrice", () => {
    describe("long pool > short pool", () => {
      it("updates the long and short payment token pools correctly", () =>
        Js.log("TODO")
      )
    });
    describe("short pool > long pool", () => {
      it("updates the long and short payment token pools correctly", () =>
        Js.log("TODO")
      )
    });
  });
};
