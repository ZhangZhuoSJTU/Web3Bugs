open Globals;
open LetOps;
open Mocha;

let randomLengthIntegerArr = (~minLength, ~maxLength) =>
  Array.makeBy(Js.Math.random_int(minLength, maxLength + 1), _ =>
    Helpers.randomJsInteger()
  );

let testUnit =
    (
      ~contracts: ref(Helpers.stakerUnitTestContracts),
      ~accounts: ref(array(Ethers.Wallet.t)),
    ) => {
  let marketIndices = randomLengthIntegerArr(~minLength=0, ~maxLength=100);
  before_once'(() => {
    let {longShortSmocked, staker} = contracts.contents;

    let%Await _ =
      staker->Staker.Exposed.setLongShort(
        ~longShort=longShortSmocked.address,
      );
    ();
  });

  let commonTestsBetween_claimFloatCustomANDclaimFloatCustomFor = (~getUser) => {
    it("calls LongShort.updateSystemStateMulti for the markets", () => {
      let updateSystemStateMultiCalls =
        contracts.contents.longShortSmocked
        ->LongShortSmocked.updateSystemStateMultiCalls;

      updateSystemStateMultiCalls->Chai.recordArrayDeepEqualFlat([|
        {marketIndexes: marketIndices},
      |]);
    });

    it("calls _mintAccumulatedFloatMulti with the correct arguments", () => {
      let mintAccumulatedFloatMultiCalls =
        StakerSmocked.InternalMock._mintAccumulatedFloatMultiCalls();
      ();
      mintAccumulatedFloatMultiCalls->Chai.recordArrayDeepEqualFlat([|
        {marketIndexes: marketIndices, user: getUser()},
      |]);
    });
  };

  describe("claimFloatCustom", () => {
    let getUser = () => accounts.contents->Array.getUnsafe(0).address;

    before_once'(() => {
      let {staker} = contracts.contents;

      let%Await _ =
        staker->StakerSmocked.InternalMock.setupFunctionForUnitTesting(
          ~functionName="claimFloatCustom",
        );

      staker->Staker.claimFloatCustom(~marketIndexes=marketIndices);
    });

    commonTestsBetween_claimFloatCustomANDclaimFloatCustomFor(~getUser);
  });

  describe("claimFloatCustomFor", () => {
    let user = Helpers.randomAddress();

    before_once'(() => {
      let {staker} = contracts.contents;

      let%Await _ =
        staker->StakerSmocked.InternalMock.setupFunctionForUnitTesting(
          ~functionName="claimFloatCustomFor",
        );

      staker->Staker.claimFloatCustomFor(~marketIndexes=marketIndices, ~user);
    });

    commonTestsBetween_claimFloatCustomANDclaimFloatCustomFor(~getUser=() =>
      user
    );
  });
};
