open LetOps;
let deployAndSetupStakerToUnitTest = (~functionName, ~contracts, ~accounts) => {
  let%AwaitThen deployedContracts =
    Helpers.initialize(
      ~admin=accounts.contents->Array.getUnsafe(0),
      ~exposeInternals=true,
    );
  contracts := deployedContracts;
  let {staker} = contracts^;
  let%Await _ =
    staker->StakerSmocked.InternalMock.setupFunctionForUnitTesting(
      ~functionName,
    );
  ();
};
