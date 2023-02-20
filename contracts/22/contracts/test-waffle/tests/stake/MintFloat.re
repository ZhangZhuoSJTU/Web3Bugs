open Globals;
open LetOps;
open StakerHelpers;
open Mocha;

let test =
    (
      ~contracts: ref(Helpers.coreContracts),
      ~accounts: ref(array(Ethers.Wallet.t)),
    ) => {
  describe("_mintFloat", () => {
    let floatTokenSmockedRef: ref(FloatTokenSmocked.t) =
      ref(None->Obj.magic);

    let floatCapitalAddressRef: ref(Ethers.ethAddress) =
      ref(CONSTANTS.zeroAddress);

    let user = Helpers.randomAddress();
    let floatToMint = Helpers.randomTokenAmount();

    let floatPercentage = Helpers.randomJsInteger() / 65536; // divide by 2^16 to keep in range of uint16 I think?

    before_once'(() => {
      let%Await _ =
        deployAndSetupStakerToUnitTest(
          ~functionName="_mintFloat",
          ~contracts,
          ~accounts,
        );

      let staker = contracts^.staker;

      floatCapitalAddressRef := contracts^.floatCapital_v0.address;

      let%AwaitThen floatTokenSmocked =
        FloatTokenSmocked.make(contracts^.floatToken);

      floatTokenSmocked->FloatTokenSmocked.mockMintToReturn;
      floatTokenSmockedRef := floatTokenSmocked;

      let%AwaitThen _ =
        staker->Staker.Exposed.set_mintFloatParams(
          ~floatToken=floatTokenSmocked.address,
          ~floatPercentage,
        );

      staker->Staker.Exposed._mintFloatExposed(~user, ~floatToMint);
    });

    it("calls mint on floatToken for user for amount floatToMint", () =>
      (floatTokenSmockedRef^)
      ->FloatTokenSmocked.mintCalls
      ->Array.getExn(0)
      ->Chai.recordEqualFlat({_to: user, amount: floatToMint})
    );

    it(
      "calls mint on floatTokens for floatCapital for amount (floatToMint * floatPercentage) / 1e18",
      () =>
      (floatTokenSmockedRef^)
      ->FloatTokenSmocked.mintCalls
      ->Array.getExn(1)
      ->Chai.recordEqualFlat({
          _to: floatCapitalAddressRef^,
          amount:
            floatToMint
            ->mul(floatPercentage->bnFromInt)
            ->div(CONSTANTS.tenToThe18),
        })
    );
  });
};
