open Globals;
open LetOps;
open Mocha;

let describeSkippable = Config.runValueSimulations ? describe : describe_skip;

describeSkippable("Float System", () => {
  let contracts: ref(Helpers.coreContracts) = ref(None->Obj.magic);
  let accounts: ref(array(Ethers.Wallet.t)) = ref(None->Obj.magic);

  before(() => {
    let%Await loadedAccounts = Ethers.getSigners();
    accounts := loadedAccounts;
  });

  before_each(() => {
    let%Await deployedContracts =
      Helpers.initialize(
        ~admin=accounts.contents->Array.getUnsafe(0),
        ~exposeInternals=true,
      );
    contracts := deployedContracts;
    ();
  });

  describe("testing exponents", () => {
    it(
      "get the safe min bit shifting required for a market with liquidity of 10 Trillion USD",
      () => {
        let {staker} = contracts.contents;

        // Assumption, theoretical maximum amount of liquidity in a single market. 10^13 (10 trillion) USD. Or 10^31 units.
        let theoreticalMaximumMarketLiquidity =
          bnFromString("10000000000000000000000000000000");

        let%Await maxForExp2 =
          staker->Staker.Exposed.getRequiredAmountOfBitShiftForSafeExponentiationPerfect(
            ~number=theoreticalMaximumMarketLiquidity,
            ~exponent=bnFromInt(2),
          );
        let%Await maxForExp3 =
          staker->Staker.Exposed.getRequiredAmountOfBitShiftForSafeExponentiationPerfect(
            ~number=theoreticalMaximumMarketLiquidity,
            ~exponent=bnFromInt(3),
          );
        let%Await maxForExp4 =
          staker->Staker.Exposed.getRequiredAmountOfBitShiftForSafeExponentiationPerfect(
            ~number=theoreticalMaximumMarketLiquidity,
            ~exponent=bnFromInt(4),
          );
        let%Await maxForExp5 =
          staker->Staker.Exposed.getRequiredAmountOfBitShiftForSafeExponentiationPerfect(
            ~number=theoreticalMaximumMarketLiquidity,
            ~exponent=bnFromInt(5),
          );
        let%Await maxForExp6 =
          staker->Staker.Exposed.getRequiredAmountOfBitShiftForSafeExponentiationPerfect(
            ~number=theoreticalMaximumMarketLiquidity,
            ~exponent=bnFromInt(6),
          );

        Js.log({
          "maxForExp2": maxForExp2->bnToString,
          "maxForExp3": maxForExp3->bnToString,
          "maxForExp4": maxForExp4->bnToString,
          "maxForExp5": maxForExp5->bnToString,
          "maxForExp6": maxForExp6->bnToString,
        });
      },
    )
  });
});
