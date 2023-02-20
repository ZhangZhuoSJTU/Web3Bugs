
@@ocaml.warning("-32")
open ContractHelpers
type t = {address: Ethers.ethAddress}
let contractName = "YieldManagerAave"

let at: Ethers.ethAddress => JsPromise.t<t> = contractAddress =>
  attachToContract(contractName, ~contractAddress)->Obj.magic

let make: (~longShort: Ethers.ethAddress,~treasury: Ethers.ethAddress,~paymentToken: Ethers.ethAddress,~aToken: Ethers.ethAddress,~lendingPool: Ethers.ethAddress,~aaveIncentivesController: Ethers.ethAddress,~aaveReferralCode: int,) => JsPromise.t<t> = (~longShort,~treasury,~paymentToken,~aToken,~lendingPool,~aaveIncentivesController,~aaveReferralCode,) =>
    deployContract7(contractName, longShort,treasury,paymentToken,aToken,lendingPool,aaveIncentivesController,aaveReferralCode,)->Obj.magic


  type aTokenReturn = Ethers.ethAddress
  @send
  external aToken: (
    t,
  ) => JsPromise.t<aTokenReturn> = "aToken"

  type aaveIncentivesControllerReturn = Ethers.ethAddress
  @send
  external aaveIncentivesController: (
    t,
  ) => JsPromise.t<aaveIncentivesControllerReturn> = "aaveIncentivesController"

  type amountReservedInCaseOfInsufficientAaveLiquidityReturn = Ethers.BigNumber.t
  @send
  external amountReservedInCaseOfInsufficientAaveLiquidity: (
    t,
  ) => JsPromise.t<amountReservedInCaseOfInsufficientAaveLiquidityReturn> = "amountReservedInCaseOfInsufficientAaveLiquidity"

  @send
  external claimAaveRewardsToTreasury: (
    t,
  ) => JsPromise.t<transaction> = "claimAaveRewardsToTreasury"

  @send
  external depositPaymentToken: (
    t,~amount: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "depositPaymentToken"

  @send
  external distributeYieldForTreasuryAndReturnMarketAllocation: (
    t,~totalValueRealizedForMarket: Ethers.BigNumber.t,~treasuryYieldPercent_e18: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "distributeYieldForTreasuryAndReturnMarketAllocation"

    type distributeYieldForTreasuryAndReturnMarketAllocationReturn = Ethers.BigNumber.t
    @send @scope("callStatic")
    external distributeYieldForTreasuryAndReturnMarketAllocationCall: (
      t,~totalValueRealizedForMarket: Ethers.BigNumber.t,~treasuryYieldPercent_e18: Ethers.BigNumber.t,
    ) => JsPromise.t<distributeYieldForTreasuryAndReturnMarketAllocationReturn> = "distributeYieldForTreasuryAndReturnMarketAllocation"

  type lendingPoolReturn = Ethers.ethAddress
  @send
  external lendingPool: (
    t,
  ) => JsPromise.t<lendingPoolReturn> = "lendingPool"

  type longShortReturn = Ethers.ethAddress
  @send
  external longShort: (
    t,
  ) => JsPromise.t<longShortReturn> = "longShort"

  type paymentTokenReturn = Ethers.ethAddress
  @send
  external paymentToken: (
    t,
  ) => JsPromise.t<paymentTokenReturn> = "paymentToken"

  @send
  external removePaymentTokenFromMarket: (
    t,~amount: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "removePaymentTokenFromMarket"

  type totalReservedForTreasuryReturn = Ethers.BigNumber.t
  @send
  external totalReservedForTreasury: (
    t,
  ) => JsPromise.t<totalReservedForTreasuryReturn> = "totalReservedForTreasury"

  @send
  external transferPaymentTokensToUser: (
    t,~user: Ethers.ethAddress,~amount: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "transferPaymentTokensToUser"

  type treasuryReturn = Ethers.ethAddress
  @send
  external treasury: (
    t,
  ) => JsPromise.t<treasuryReturn> = "treasury"

  @send
  external withdrawTreasuryFunds: (
    t,
  ) => JsPromise.t<transaction> = "withdrawTreasuryFunds"



