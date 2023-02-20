open Globals;
open LetOps;
open Mocha;

describe("Float System", () => {
  describeIntegration("Staking", () => {
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
          ~exposeInternals=false,
        );
      contracts := deployedContracts;
    });

    it(
      "should correctly be able to stake their long/short tokens and view their staked amount immediately",
      () => {
        let {longShort, markets, staker} = contracts.contents;
        let testUser = accounts.contents->Array.getUnsafe(1);

        let%Await (synthsUserHasStakedIn, _marketsUserHasStakedIn) =
          HelperActions.stakeRandomlyInMarkets(
            ~marketsToStakeIn=markets,
            ~userToStakeWith=testUser,
            ~longShort,
          );

        let%Await _ =
          synthsUserHasStakedIn
          ->Array.map(({synth, amount, priceOfSynthForAction}) => {
              let%Await amountStaked =
                staker->Staker.userAmountStaked(
                  synth.address,
                  testUser.address,
                );

              let expectedStakeAmount =
                amount
                ->mul(CONSTANTS.tenToThe18)
                ->div(priceOfSynthForAction);

              Chai.bnEqual(
                ~message="amount staked is greater than expected",
                amountStaked,
                expectedStakeAmount,
              );
            })
          ->JsPromise.all;
        ();
      },
    );

    it("should update correct markets in the 'claimFloatCustom' function", () => {
      let {longShort, markets, staker} = contracts.contents;
      let testUser = accounts.contents->Array.getUnsafe(1);
      let setupUser = accounts.contents->Array.getUnsafe(2);

      let%Await _ =
        HelperActions.stakeRandomlyInBothSidesOfMarket(
          ~marketsToStakeIn=contracts^.markets,
          ~userToStakeWith=setupUser,
          ~longShort=contracts^.longShort,
        );

      let%Await (_synthsUserHasStakedIn, marketsUserHasStakedIn) =
        HelperActions.stakeRandomlyInMarkets(
          ~marketsToStakeIn=markets,
          ~userToStakeWith=testUser,
          ~longShort,
        );

      let%Await _ = Helpers.increaseTime(50);

      let%Await _ =
        staker
        ->ContractHelpers.connect(~address=testUser)
        ->Staker.claimFloatCustom(~marketIndexes=marketsUserHasStakedIn);

      let%Await _ =
        marketsUserHasStakedIn
        ->Array.map(market => {
            JsPromise.all2((
              staker->Staker.userIndexOfLastClaimedReward(
                market,
                testUser.address,
              ),
              staker->Staker.latestRewardIndex(market),
            ))
            ->JsPromise.map(((userLastClaimed, latestRewardIndex)) => {
                Chai.bnEqual(userLastClaimed, latestRewardIndex)
              })
          })
        ->JsPromise.all;
      ();
    });
  });
  describeUnit("Staking - internals exposed", () => {
    let contracts: ref(Helpers.coreContracts) = ref(None->Obj.magic);
    let accounts: ref(array(Ethers.Wallet.t)) = ref(None->Obj.magic);

    before(() => {
      let%Await loadedAccounts = Ethers.getSigners();
      accounts := loadedAccounts;
    });

    // ONE DEPLOYMENT PER TEST
    describe("", () => {
      before_each(() => {
        let%Await deployedContracts =
          Helpers.initialize(
            ~admin=accounts.contents->Array.getUnsafe(0),
            ~exposeInternals=true,
          );
        contracts := deployedContracts;
      });
      CalculateAccumulatedFloat.test(~contracts);
      GetMarketLaunchIncentiveParameters.test(~contracts);
      CalculateTimeDelta.test(~contracts);
    });

    // TESTS THAT MAY TEST MULTIPLE THINGS PER DEPLOYMENT
    describe("", () => {
      before_once'(() => {
        let%Await deployedContracts =
          Helpers.initialize(
            ~admin=accounts.contents->Array.getUnsafe(0),
            ~exposeInternals=true,
          );
        contracts := deployedContracts;
      });
      ChangeMarketLaunchIncentiveParameters.test(~contracts, ~accounts);
      AddNewStakingFund.test(~contracts, ~accounts);
      GetKValue.test(~contracts, ~accounts);
      CalculateFloatPerSecond.test(~contracts, ~accounts);
      CalculateNewCumulativeValue.test(~contracts, ~accounts);
      SetRewardObjects.test(~contracts, ~accounts);
      MintFloat.test(~contracts, ~accounts);
      MintAccumulatedFloat.test(~contracts, ~accounts);
      ClaimFloat.test(~contracts, ~accounts);
      StakeFromUser.test(~contracts, ~accounts);
      Stake.test(~contracts, ~accounts);
      StakerAdminFunctions.testUnit(~contracts, ~accounts);
    });
  });
  describe("Smocked", () => {
    let contracts = ref("NOT INITIALIZED"->Obj.magic);
    let accounts = ref("NOT INITIALIZED"->Obj.magic);

    before(() => {
      let%Await loadedAccounts = Ethers.getSigners();
      accounts := loadedAccounts;

      let%Await deployedContracts = Helpers.initializeStakerUnit();

      contracts := deployedContracts;
    });
    describeUnit("Unit tests", () => {
      ShiftTokens.testUnit(~contracts, ~accounts);
      CalculateAccumulatedFloatInRange.testUnit(~contracts, ~accounts);
      ClaimFloatCustom.testUnit(~contracts, ~accounts);
      AddNewStateForFloatRewards.testUnit(~contracts, ~accounts);
      Withdraw.testUnit(~contracts, ~accounts);
    });
  });
});
