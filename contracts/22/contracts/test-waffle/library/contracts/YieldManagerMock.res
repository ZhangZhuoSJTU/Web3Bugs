
@@ocaml.warning("-32")
open ContractHelpers
type t = {address: Ethers.ethAddress}
let contractName = "YieldManagerMock"

let at: Ethers.ethAddress => JsPromise.t<t> = contractAddress =>
  attachToContract(contractName, ~contractAddress)->Obj.magic

let make: (~longShort: Ethers.ethAddress,~treasury: Ethers.ethAddress,~token: Ethers.ethAddress,) => JsPromise.t<t> = (~longShort,~treasury,~token,) =>
    deployContract3(contractName, longShort,treasury,token,)->Obj.magic


  type tEN_TO_THE_18Return = Ethers.BigNumber.t
  @send
  external tEN_TO_THE_18: (
    t,
  ) => JsPromise.t<tEN_TO_THE_18Return> = "TEN_TO_THE_18"

  type adminReturn = Ethers.ethAddress
  @send
  external admin: (
    t,
  ) => JsPromise.t<adminReturn> = "admin"

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

  type lastSettledReturn = Ethers.BigNumber.t
  @send
  external lastSettled: (
    t,
  ) => JsPromise.t<lastSettledReturn> = "lastSettled"

  type longShortReturn = Ethers.ethAddress
  @send
  external longShort: (
    t,
  ) => JsPromise.t<longShortReturn> = "longShort"

  @send
  external removePaymentTokenFromMarket: (
    t,~amount: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "removePaymentTokenFromMarket"

  @send
  external setYieldRate: (
    t,~yieldRate: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "setYieldRate"

  @send
  external settle: (
    t,
  ) => JsPromise.t<transaction> = "settle"

  @send
  external settleWithYieldAbsolute: (
    t,~totalYield: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "settleWithYieldAbsolute"

  @send
  external settleWithYieldPercent: (
    t,~yieldPercent: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "settleWithYieldPercent"

  type tokenReturn = Ethers.ethAddress
  @send
  external token: (
    t,
  ) => JsPromise.t<tokenReturn> = "token"

  type tokenOtherRewardERC20Return = Ethers.ethAddress
  @send
  external tokenOtherRewardERC20: (
    t,
  ) => JsPromise.t<tokenOtherRewardERC20Return> = "tokenOtherRewardERC20"

  type totalHeldReturn = Ethers.BigNumber.t
  @send
  external totalHeld: (
    t,
  ) => JsPromise.t<totalHeldReturn> = "totalHeld"

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

  type yieldRateReturn = Ethers.BigNumber.t
  @send
  external yieldRate: (
    t,
  ) => JsPromise.t<yieldRateReturn> = "yieldRate"



