open Globals;
open LetOps;
open Mocha;

describe("Float System", () => {
  let accounts: ref(array(Ethers.Wallet.t)) = ref(None->Obj.magic);
  let contracts: ref(Contract.YieldManagerAaveHelpers.contractsType) =
    ref(None->Obj.magic);

  let setup = () => {
    let%AwaitThen loadedAccounts = Ethers.getSigners();
    accounts := loadedAccounts;

    let treasury = loadedAccounts->Array.getUnsafe(1);

    let longShortAddress = Ethers.Wallet.createRandom().address;
    let fundTokenAddress = Ethers.Wallet.createRandom().address;

    let%Await lendingPoolMock = LendingPoolAaveMock.make();
    let%Await lendingPoolSmocked =
      LendingPoolAaveMockSmocked.make(lendingPoolMock);

    let%Await paymentTokenMock =
      ERC20Mock.make(~name="Payment Token Mock", ~symbol="PaymentToken");
    let%Await paymentTokenSmocked = ERC20MockSmocked.make(paymentTokenMock);

    let%Await erc20Mock =
      ERC20Mock.make(~name="Test APaymentToken", ~symbol="APaymentToken");

    let%Await aaveIncentivesControllerMock =
      AaveIncentivesControllerMock.make();
    let%Await aaveIncentivesControllerSmocked =
      AaveIncentivesControllerMockSmocked.make(aaveIncentivesControllerMock);

    let%Await yieldManagerAave =
      YieldManagerAave.make(
        ~longShort=longShortAddress,
        ~treasury=treasury.address,
        ~paymentToken=paymentTokenSmocked.address,
        ~aToken=fundTokenAddress,
        ~lendingPool=lendingPoolSmocked.address,
        ~aaveIncentivesController=aaveIncentivesControllerSmocked.address,
        ~aaveReferralCode=6543,
      );

    contracts :=
      {
        "erc20Mock": erc20Mock,
        "yieldManagerAave": yieldManagerAave,
        "paymentToken": paymentTokenSmocked,
        "treasury": treasury,
        "aaveIncentivesController": aaveIncentivesControllerSmocked,
      };
  };
  describeUnit("(un-optimised) YieldManagerAave - internals exposed", () => {
    before_each(setup)
  });
  describeUnit("(optimised) YieldManagerAave - internals exposed ", () => {
    before(setup);

    ClaimAaveRewards.testUnit(~contracts);
  });
});
