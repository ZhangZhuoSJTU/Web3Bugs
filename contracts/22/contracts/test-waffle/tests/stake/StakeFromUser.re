open Globals;
open LetOps;
open StakerHelpers;
open Mocha;

let test =
    (
      ~contracts: ref(Helpers.coreContracts),
      ~accounts: ref(array(Ethers.Wallet.t)),
    ) => {
  describe("stakeFromUser", () => {
    let longShortSmockedRef: ref(LongShortSmocked.t) = ref(None->Obj.magic);
    let marketIndexForToken = Helpers.randomJsInteger();

    let from = Helpers.randomAddress();
    let amount = Helpers.randomTokenAmount();
    let mockTokenWalletRef: ref(Ethers.Wallet.t) = ref(None->Obj.magic);

    before_once'(() => {
      let%Await _ =
        deployAndSetupStakerToUnitTest(
          ~functionName="stakeFromUser",
          ~contracts,
          ~accounts,
        );

      let {longShort} = contracts^;

      let%Await longShortSmocked = longShort->LongShortSmocked.make;

      let _ = longShortSmocked->LongShortSmocked.mockUpdateSystemStateToReturn;

      longShortSmockedRef := longShortSmocked;

      mockTokenWalletRef := (accounts^)->Array.getExn(6);

      let%Await _ =
        contracts^.staker
        ->Staker.Exposed.setStakeFromUserParams(
            ~longshort=longShortSmocked.address,
            ~token=mockTokenWalletRef^.address,
            ~marketIndexForToken,
          );

      StakerSmocked.InternalMock.mock_stakeToReturn();

      contracts^.staker
      ->ContractHelpers.connect(~address=mockTokenWalletRef^)
      ->Staker.stakeFromUser(~from, ~amount);
    });

    it_skip("calls onlyValidSynthetic with correct args", () => {
      // StakerSmocked.InternalMock.onlyValidSyntheticCalls()
      // ->Array.getExn(0)
      // ->Chai.recordEqualFlat({synth: mockTokenWalletRef^.address})
      ()
    });

    it("calls _stake with correct args", () =>
      StakerSmocked.InternalMock._stakeCalls()
      ->Array.getExn(0)
      ->Chai.recordEqualFlat({
          token: mockTokenWalletRef^.address,
          amount,
          user: from,
        })
    );

    it("calls updateSystemState on longshort with correct args", () => {
      (longShortSmockedRef^)
      ->LongShortSmocked.updateSystemStateCalls
      ->Array.getExn(0)
      ->Chai.recordEqualFlat({marketIndex: marketIndexForToken})
    });
  });
};
