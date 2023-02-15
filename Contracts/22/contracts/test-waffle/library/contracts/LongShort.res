
@@ocaml.warning("-32")
open ContractHelpers
type t = {address: Ethers.ethAddress}
let contractName = "LongShort"

let at: Ethers.ethAddress => JsPromise.t<t> = contractAddress =>
  attachToContract(contractName, ~contractAddress)->Obj.magic

let make: unit => JsPromise.t<t> = () => deployContract0(contractName)->Obj.magic


  type pERMANENT_INITIAL_LIQUIDITY_HOLDERReturn = Ethers.ethAddress
  @send
  external pERMANENT_INITIAL_LIQUIDITY_HOLDER: (
    t,
  ) => JsPromise.t<pERMANENT_INITIAL_LIQUIDITY_HOLDERReturn> = "PERMANENT_INITIAL_LIQUIDITY_HOLDER"

  type adminReturn = Ethers.ethAddress
  @send
  external admin: (
    t,
  ) => JsPromise.t<adminReturn> = "admin"

  type assetPriceReturn = Ethers.BigNumber.t
  @send
  external assetPrice: (
    t, int,
  ) => JsPromise.t<assetPriceReturn> = "assetPrice"

  type batched_amountPaymentToken_depositReturn = Ethers.BigNumber.t
  @send
  external batched_amountPaymentToken_deposit: (
    t, int, bool,
  ) => JsPromise.t<batched_amountPaymentToken_depositReturn> = "batched_amountPaymentToken_deposit"

  type batched_amountSyntheticToken_redeemReturn = Ethers.BigNumber.t
  @send
  external batched_amountSyntheticToken_redeem: (
    t, int, bool,
  ) => JsPromise.t<batched_amountSyntheticToken_redeemReturn> = "batched_amountSyntheticToken_redeem"

  type batched_amountSyntheticToken_toShiftAwayFrom_marketSideReturn = Ethers.BigNumber.t
  @send
  external batched_amountSyntheticToken_toShiftAwayFrom_marketSide: (
    t, int, bool,
  ) => JsPromise.t<batched_amountSyntheticToken_toShiftAwayFrom_marketSideReturn> = "batched_amountSyntheticToken_toShiftAwayFrom_marketSide"

  @send
  external changeAdmin: (
    t,~admin: Ethers.ethAddress,
  ) => JsPromise.t<transaction> = "changeAdmin"

  @send
  external changeMarketTreasurySplitGradient: (
    t,~marketIndex: int,~marketTreasurySplitGradient_e18: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "changeMarketTreasurySplitGradient"

  @send
  external changeTreasury: (
    t,~treasury: Ethers.ethAddress,
  ) => JsPromise.t<transaction> = "changeTreasury"

  @send
  external createNewSyntheticMarket: (
    t,~syntheticName: string,~syntheticSymbol: string,~paymentToken: Ethers.ethAddress,~oracleManager: Ethers.ethAddress,~yieldManager: Ethers.ethAddress,
  ) => JsPromise.t<transaction> = "createNewSyntheticMarket"

  @send
  external executeOutstandingNextPriceSettlementsUser: (
    t,~user: Ethers.ethAddress,~marketIndex: int,
  ) => JsPromise.t<transaction> = "executeOutstandingNextPriceSettlementsUser"

  @send
  external executeOutstandingNextPriceSettlementsUserMulti: (
    t,~user: Ethers.ethAddress,~marketIndexes: array<int>,
  ) => JsPromise.t<transaction> = "executeOutstandingNextPriceSettlementsUserMulti"

  type getAmountSyntheticTokenToMintOnTargetSideReturn = Ethers.BigNumber.t
  @send
  external getAmountSyntheticTokenToMintOnTargetSide: (
    t,~marketIndex: int,~amountSyntheticToken_redeemOnOriginSide: Ethers.BigNumber.t,~isShiftFromLong: bool,~priceSnapshotIndex: Ethers.BigNumber.t,
  ) => JsPromise.t<getAmountSyntheticTokenToMintOnTargetSideReturn> = "getAmountSyntheticTokenToMintOnTargetSide"

  type getUsersConfirmedButNotSettledSynthBalanceReturn = Ethers.BigNumber.t
  @send
  external getUsersConfirmedButNotSettledSynthBalance: (
    t,~user: Ethers.ethAddress,~marketIndex: int,~isLong: bool,
  ) => JsPromise.t<getUsersConfirmedButNotSettledSynthBalanceReturn> = "getUsersConfirmedButNotSettledSynthBalance"

  @send
  external initialize: (
    t,~admin: Ethers.ethAddress,~treasury: Ethers.ethAddress,~tokenFactory: Ethers.ethAddress,~staker: Ethers.ethAddress,
  ) => JsPromise.t<transaction> = "initialize"

  @send
  external initializeMarket: (
    t,~marketIndex: int,~kInitialMultiplier: Ethers.BigNumber.t,~kPeriod: Ethers.BigNumber.t,~unstakeFee_e18: Ethers.BigNumber.t,~initialMarketSeedForEachMarketSide: Ethers.BigNumber.t,~balanceIncentiveCurve_exponent: Ethers.BigNumber.t,~balanceIncentiveCurve_equilibriumOffset: Ethers.BigNumber.t,~marketTreasurySplitGradient_e18: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "initializeMarket"

  type latestMarketReturn = int
  @send
  external latestMarket: (
    t,
  ) => JsPromise.t<latestMarketReturn> = "latestMarket"

  type marketExistsReturn = bool
  @send
  external marketExists: (
    t, int,
  ) => JsPromise.t<marketExistsReturn> = "marketExists"

  type marketSideValueInPaymentTokenReturn = Ethers.BigNumber.t
  @send
  external marketSideValueInPaymentToken: (
    t, int, bool,
  ) => JsPromise.t<marketSideValueInPaymentTokenReturn> = "marketSideValueInPaymentToken"

  type marketTreasurySplitGradient_e18Return = Ethers.BigNumber.t
  @send
  external marketTreasurySplitGradient_e18: (
    t, int,
  ) => JsPromise.t<marketTreasurySplitGradient_e18Return> = "marketTreasurySplitGradient_e18"

  type marketUpdateIndexReturn = Ethers.BigNumber.t
  @send
  external marketUpdateIndex: (
    t, int,
  ) => JsPromise.t<marketUpdateIndexReturn> = "marketUpdateIndex"

  @send
  external mintLongNextPrice: (
    t,~marketIndex: int,~amount: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "mintLongNextPrice"

  @send
  external mintShortNextPrice: (
    t,~marketIndex: int,~amount: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "mintShortNextPrice"

  type oracleManagersReturn = Ethers.ethAddress
  @send
  external oracleManagers: (
    t, int,
  ) => JsPromise.t<oracleManagersReturn> = "oracleManagers"

  type paymentTokensReturn = Ethers.ethAddress
  @send
  external paymentTokens: (
    t, int,
  ) => JsPromise.t<paymentTokensReturn> = "paymentTokens"

  @send
  external redeemLongNextPrice: (
    t,~marketIndex: int,~tokens_redeem: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "redeemLongNextPrice"

  @send
  external redeemShortNextPrice: (
    t,~marketIndex: int,~tokens_redeem: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "redeemShortNextPrice"

  @send
  external shiftPositionFromLongNextPrice: (
    t,~marketIndex: int,~amountSyntheticTokensToShift: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "shiftPositionFromLongNextPrice"

  @send
  external shiftPositionFromShortNextPrice: (
    t,~marketIndex: int,~amountSyntheticTokensToShift: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "shiftPositionFromShortNextPrice"

  type stakerReturn = Ethers.ethAddress
  @send
  external staker: (
    t,
  ) => JsPromise.t<stakerReturn> = "staker"

  type syntheticToken_priceSnapshotReturn = Ethers.BigNumber.t
  @send
  external syntheticToken_priceSnapshot: (
    t, int, bool, Ethers.BigNumber.t,
  ) => JsPromise.t<syntheticToken_priceSnapshotReturn> = "syntheticToken_priceSnapshot"

  type syntheticTokensReturn = Ethers.ethAddress
  @send
  external syntheticTokens: (
    t, int, bool,
  ) => JsPromise.t<syntheticTokensReturn> = "syntheticTokens"

  type tokenFactoryReturn = Ethers.ethAddress
  @send
  external tokenFactory: (
    t,
  ) => JsPromise.t<tokenFactoryReturn> = "tokenFactory"

  type treasuryReturn = Ethers.ethAddress
  @send
  external treasury: (
    t,
  ) => JsPromise.t<treasuryReturn> = "treasury"

  @send
  external updateMarketOracle: (
    t,~marketIndex: int,~newOracleManager: Ethers.ethAddress,
  ) => JsPromise.t<transaction> = "updateMarketOracle"

  @send
  external updateSystemState: (
    t,~marketIndex: int,
  ) => JsPromise.t<transaction> = "updateSystemState"

  @send
  external updateSystemStateMulti: (
    t,~marketIndexes: array<int>,
  ) => JsPromise.t<transaction> = "updateSystemStateMulti"

  type userNextPrice_currentUpdateIndexReturn = Ethers.BigNumber.t
  @send
  external userNextPrice_currentUpdateIndex: (
    t, int, Ethers.ethAddress,
  ) => JsPromise.t<userNextPrice_currentUpdateIndexReturn> = "userNextPrice_currentUpdateIndex"

  type userNextPrice_paymentToken_depositAmountReturn = Ethers.BigNumber.t
  @send
  external userNextPrice_paymentToken_depositAmount: (
    t, int, bool, Ethers.ethAddress,
  ) => JsPromise.t<userNextPrice_paymentToken_depositAmountReturn> = "userNextPrice_paymentToken_depositAmount"

  type userNextPrice_syntheticToken_redeemAmountReturn = Ethers.BigNumber.t
  @send
  external userNextPrice_syntheticToken_redeemAmount: (
    t, int, bool, Ethers.ethAddress,
  ) => JsPromise.t<userNextPrice_syntheticToken_redeemAmountReturn> = "userNextPrice_syntheticToken_redeemAmount"

  type userNextPrice_syntheticToken_toShiftAwayFrom_marketSideReturn = Ethers.BigNumber.t
  @send
  external userNextPrice_syntheticToken_toShiftAwayFrom_marketSide: (
    t, int, bool, Ethers.ethAddress,
  ) => JsPromise.t<userNextPrice_syntheticToken_toShiftAwayFrom_marketSideReturn> = "userNextPrice_syntheticToken_toShiftAwayFrom_marketSide"

  type yieldManagersReturn = Ethers.ethAddress
  @send
  external yieldManagers: (
    t, int,
  ) => JsPromise.t<yieldManagersReturn> = "yieldManagers"


module Exposed = {
          let contractName = "LongShortMockable"

          let make: unit => JsPromise.t<t> = () => deployContract0(contractName)->Obj.magic
          
  type pERMANENT_INITIAL_LIQUIDITY_HOLDERReturn = Ethers.ethAddress
  @send
  external pERMANENT_INITIAL_LIQUIDITY_HOLDER: (
    t,
  ) => JsPromise.t<pERMANENT_INITIAL_LIQUIDITY_HOLDERReturn> = "PERMANENT_INITIAL_LIQUIDITY_HOLDER"

  @send
  external _batchConfirmOutstandingPendingActionsExposed: (
    t,~marketIndex: int,~syntheticTokenPrice_inPaymentTokens_long: Ethers.BigNumber.t,~syntheticTokenPrice_inPaymentTokens_short: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "_batchConfirmOutstandingPendingActionsExposed"

    type _batchConfirmOutstandingPendingActionsExposedReturn = {
long_changeInMarketValue_inPaymentToken: Ethers.BigNumber.t,
short_changeInMarketValue_inPaymentToken: Ethers.BigNumber.t,
    }
    @send @scope("callStatic")
    external _batchConfirmOutstandingPendingActionsExposedCall: (
      t,~marketIndex: int,~syntheticTokenPrice_inPaymentTokens_long: Ethers.BigNumber.t,~syntheticTokenPrice_inPaymentTokens_short: Ethers.BigNumber.t,
    ) => JsPromise.t<_batchConfirmOutstandingPendingActionsExposedReturn> = "_batchConfirmOutstandingPendingActionsExposed"

  @send
  external _claimAndDistributeYieldThenRebalanceMarketExposed: (
    t,~marketIndex: int,~newAssetPrice: Ethers.BigNumber.t,~oldAssetPrice: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "_claimAndDistributeYieldThenRebalanceMarketExposed"

    type _claimAndDistributeYieldThenRebalanceMarketExposedReturn = {
longValue: Ethers.BigNumber.t,
shortValue: Ethers.BigNumber.t,
    }
    @send @scope("callStatic")
    external _claimAndDistributeYieldThenRebalanceMarketExposedCall: (
      t,~marketIndex: int,~newAssetPrice: Ethers.BigNumber.t,~oldAssetPrice: Ethers.BigNumber.t,
    ) => JsPromise.t<_claimAndDistributeYieldThenRebalanceMarketExposedReturn> = "_claimAndDistributeYieldThenRebalanceMarketExposed"

  @send
  external _executeOutstandingNextPriceMintsExposed: (
    t,~marketIndex: int,~user: Ethers.ethAddress,~isLong: bool,
  ) => JsPromise.t<transaction> = "_executeOutstandingNextPriceMintsExposed"

  @send
  external _executeOutstandingNextPriceRedeemsExposed: (
    t,~marketIndex: int,~user: Ethers.ethAddress,~isLong: bool,
  ) => JsPromise.t<transaction> = "_executeOutstandingNextPriceRedeemsExposed"

  @send
  external _executeOutstandingNextPriceSettlementsExposed: (
    t,~user: Ethers.ethAddress,~marketIndex: int,
  ) => JsPromise.t<transaction> = "_executeOutstandingNextPriceSettlementsExposed"

  @send
  external _executeOutstandingNextPriceSettlementsExposedWithEvent: (
    t,~user: Ethers.ethAddress,~marketIndex: int,
  ) => JsPromise.t<transaction> = "_executeOutstandingNextPriceSettlementsExposedWithEvent"

  @send
  external _executeOutstandingNextPriceTokenShiftsExposed: (
    t,~marketIndex: int,~user: Ethers.ethAddress,~isShiftFromLong: bool,
  ) => JsPromise.t<transaction> = "_executeOutstandingNextPriceTokenShiftsExposed"

  type _getAmountPaymentTokenExposedReturn = Ethers.BigNumber.t
  @send
  external _getAmountPaymentTokenExposed: (
    t,~amountSyntheticToken: Ethers.BigNumber.t,~syntheticTokenPriceInPaymentTokens: Ethers.BigNumber.t,
  ) => JsPromise.t<_getAmountPaymentTokenExposedReturn> = "_getAmountPaymentTokenExposed"

  type _getAmountSyntheticTokenExposedReturn = Ethers.BigNumber.t
  @send
  external _getAmountSyntheticTokenExposed: (
    t,~amountPaymentTokenBackingSynth: Ethers.BigNumber.t,~syntheticTokenPriceInPaymentTokens: Ethers.BigNumber.t,
  ) => JsPromise.t<_getAmountSyntheticTokenExposedReturn> = "_getAmountSyntheticTokenExposed"

  type _getEquivalentAmountSyntheticTokensOnTargetSideExposedReturn = Ethers.BigNumber.t
  @send
  external _getEquivalentAmountSyntheticTokensOnTargetSideExposed: (
    t,~amountSyntheticTokens_originSide: Ethers.BigNumber.t,~syntheticTokenPrice_originSide: Ethers.BigNumber.t,~syntheticTokenPrice_targetSide: Ethers.BigNumber.t,
  ) => JsPromise.t<_getEquivalentAmountSyntheticTokensOnTargetSideExposedReturn> = "_getEquivalentAmountSyntheticTokensOnTargetSideExposed"

  type _getMinExposedReturn = Ethers.BigNumber.t
  @send
  external _getMinExposed: (
    t,~a: Ethers.BigNumber.t,~b: Ethers.BigNumber.t,
  ) => JsPromise.t<_getMinExposedReturn> = "_getMinExposed"

  type _getSyntheticTokenPriceExposedReturn = Ethers.BigNumber.t
  @send
  external _getSyntheticTokenPriceExposed: (
    t,~amountPaymentTokenBackingSynth: Ethers.BigNumber.t,~amountSyntheticToken: Ethers.BigNumber.t,
  ) => JsPromise.t<_getSyntheticTokenPriceExposedReturn> = "_getSyntheticTokenPriceExposed"

  type _getYieldSplitExposedReturn = {
isLongSideUnderbalanced: bool,
treasuryYieldPercent_e18: Ethers.BigNumber.t,
    }
  @send
  external _getYieldSplitExposed: (
    t,~marketIndex: int,~longValue: Ethers.BigNumber.t,~shortValue: Ethers.BigNumber.t,~totalValueLockedInMarket: Ethers.BigNumber.t,
  ) => JsPromise.t<_getYieldSplitExposedReturn> = "_getYieldSplitExposed"

  @send
  external _handleChangeInSyntheticTokensTotalSupplyExposed: (
    t,~marketIndex: int,~isLong: bool,~changeInSyntheticTokensTotalSupply: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "_handleChangeInSyntheticTokensTotalSupplyExposed"

  @send
  external _handleTotalPaymentTokenValueChangeForMarketWithYieldManagerExposed: (
    t,~marketIndex: int,~totalPaymentTokenValueChangeForMarket: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "_handleTotalPaymentTokenValueChangeForMarketWithYieldManagerExposed"

  @send
  external _mintNextPriceExposed: (
    t,~marketIndex: int,~amount: Ethers.BigNumber.t,~isLong: bool,
  ) => JsPromise.t<transaction> = "_mintNextPriceExposed"

  @send
  external _redeemNextPriceExposed: (
    t,~marketIndex: int,~tokens_redeem: Ethers.BigNumber.t,~isLong: bool,
  ) => JsPromise.t<transaction> = "_redeemNextPriceExposed"

  @send
  external _seedMarketInitiallyExposed: (
    t,~initialMarketSeedForEachMarketSide: Ethers.BigNumber.t,~marketIndex: int,
  ) => JsPromise.t<transaction> = "_seedMarketInitiallyExposed"

  @send
  external _shiftPositionNextPriceExposed: (
    t,~marketIndex: int,~amountSyntheticTokensToShift: Ethers.BigNumber.t,~isShiftFromLong: bool,
  ) => JsPromise.t<transaction> = "_shiftPositionNextPriceExposed"

  @send
  external _transferPaymentTokensFromUserToYieldManagerExposed: (
    t,~marketIndex: int,~amount: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "_transferPaymentTokensFromUserToYieldManagerExposed"

  @send
  external _updateSystemStateInternalExposed: (
    t,~marketIndex: int,
  ) => JsPromise.t<transaction> = "_updateSystemStateInternalExposed"

  type adminReturn = Ethers.ethAddress
  @send
  external admin: (
    t,
  ) => JsPromise.t<adminReturn> = "admin"

  @send
  external adminOnlyModifierLogicExposed: (
    t,
  ) => JsPromise.t<transaction> = "adminOnlyModifierLogicExposed"

  type assetPriceReturn = Ethers.BigNumber.t
  @send
  external assetPrice: (
    t, int,
  ) => JsPromise.t<assetPriceReturn> = "assetPrice"

  type batched_amountPaymentToken_depositReturn = Ethers.BigNumber.t
  @send
  external batched_amountPaymentToken_deposit: (
    t, int, bool,
  ) => JsPromise.t<batched_amountPaymentToken_depositReturn> = "batched_amountPaymentToken_deposit"

  type batched_amountSyntheticToken_redeemReturn = Ethers.BigNumber.t
  @send
  external batched_amountSyntheticToken_redeem: (
    t, int, bool,
  ) => JsPromise.t<batched_amountSyntheticToken_redeemReturn> = "batched_amountSyntheticToken_redeem"

  type batched_amountSyntheticToken_toShiftAwayFrom_marketSideReturn = Ethers.BigNumber.t
  @send
  external batched_amountSyntheticToken_toShiftAwayFrom_marketSide: (
    t, int, bool,
  ) => JsPromise.t<batched_amountSyntheticToken_toShiftAwayFrom_marketSideReturn> = "batched_amountSyntheticToken_toShiftAwayFrom_marketSide"

  @send
  external changeAdmin: (
    t,~admin: Ethers.ethAddress,
  ) => JsPromise.t<transaction> = "changeAdmin"

  @send
  external changeMarketTreasurySplitGradient: (
    t,~marketIndex: int,~marketTreasurySplitGradient_e18: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "changeMarketTreasurySplitGradient"

  @send
  external changeTreasury: (
    t,~treasury: Ethers.ethAddress,
  ) => JsPromise.t<transaction> = "changeTreasury"

  @send
  external createNewSyntheticMarket: (
    t,~syntheticName: string,~syntheticSymbol: string,~paymentToken: Ethers.ethAddress,~oracleManager: Ethers.ethAddress,~yieldManager: Ethers.ethAddress,
  ) => JsPromise.t<transaction> = "createNewSyntheticMarket"

  @send
  external executeOutstandingNextPriceSettlementsUser: (
    t,~user: Ethers.ethAddress,~marketIndex: int,
  ) => JsPromise.t<transaction> = "executeOutstandingNextPriceSettlementsUser"

  @send
  external executeOutstandingNextPriceSettlementsUserMulti: (
    t,~user: Ethers.ethAddress,~marketIndexes: array<int>,
  ) => JsPromise.t<transaction> = "executeOutstandingNextPriceSettlementsUserMulti"

  type getAmountSyntheticTokenToMintOnTargetSideReturn = Ethers.BigNumber.t
  @send
  external getAmountSyntheticTokenToMintOnTargetSide: (
    t,~marketIndex: int,~amountSyntheticToken_redeemOnOriginSide: Ethers.BigNumber.t,~isShiftFromLong: bool,~priceSnapshotIndex: Ethers.BigNumber.t,
  ) => JsPromise.t<getAmountSyntheticTokenToMintOnTargetSideReturn> = "getAmountSyntheticTokenToMintOnTargetSide"

  type getUsersConfirmedButNotSettledSynthBalanceReturn = Ethers.BigNumber.t
  @send
  external getUsersConfirmedButNotSettledSynthBalance: (
    t,~user: Ethers.ethAddress,~marketIndex: int,~isLong: bool,
  ) => JsPromise.t<getUsersConfirmedButNotSettledSynthBalanceReturn> = "getUsersConfirmedButNotSettledSynthBalance"

  @send
  external initialize: (
    t,~admin: Ethers.ethAddress,~treasury: Ethers.ethAddress,~tokenFactory: Ethers.ethAddress,~staker: Ethers.ethAddress,
  ) => JsPromise.t<transaction> = "initialize"

  @send
  external initializeMarket: (
    t,~marketIndex: int,~kInitialMultiplier: Ethers.BigNumber.t,~kPeriod: Ethers.BigNumber.t,~unstakeFee_e18: Ethers.BigNumber.t,~initialMarketSeedForEachMarketSide: Ethers.BigNumber.t,~balanceIncentiveCurve_exponent: Ethers.BigNumber.t,~balanceIncentiveCurve_equilibriumOffset: Ethers.BigNumber.t,~marketTreasurySplitGradient_e18: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "initializeMarket"

  type latestMarketReturn = int
  @send
  external latestMarket: (
    t,
  ) => JsPromise.t<latestMarketReturn> = "latestMarket"

  type marketExistsReturn = bool
  @send
  external marketExists: (
    t, int,
  ) => JsPromise.t<marketExistsReturn> = "marketExists"

  type marketSideValueInPaymentTokenReturn = Ethers.BigNumber.t
  @send
  external marketSideValueInPaymentToken: (
    t, int, bool,
  ) => JsPromise.t<marketSideValueInPaymentTokenReturn> = "marketSideValueInPaymentToken"

  type marketTreasurySplitGradient_e18Return = Ethers.BigNumber.t
  @send
  external marketTreasurySplitGradient_e18: (
    t, int,
  ) => JsPromise.t<marketTreasurySplitGradient_e18Return> = "marketTreasurySplitGradient_e18"

  type marketUpdateIndexReturn = Ethers.BigNumber.t
  @send
  external marketUpdateIndex: (
    t, int,
  ) => JsPromise.t<marketUpdateIndexReturn> = "marketUpdateIndex"

  @send
  external mintLongNextPrice: (
    t,~marketIndex: int,~amount: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "mintLongNextPrice"

  @send
  external mintShortNextPrice: (
    t,~marketIndex: int,~amount: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "mintShortNextPrice"

  type oracleManagersReturn = Ethers.ethAddress
  @send
  external oracleManagers: (
    t, int,
  ) => JsPromise.t<oracleManagersReturn> = "oracleManagers"

  type paymentTokensReturn = Ethers.ethAddress
  @send
  external paymentTokens: (
    t, int,
  ) => JsPromise.t<paymentTokensReturn> = "paymentTokens"

  @send
  external redeemLongNextPrice: (
    t,~marketIndex: int,~tokens_redeem: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "redeemLongNextPrice"

  @send
  external redeemShortNextPrice: (
    t,~marketIndex: int,~tokens_redeem: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "redeemShortNextPrice"

  type requireMarketExistsModifierLogicExposedReturn
  @send
  external requireMarketExistsModifierLogicExposed: (
    t,~marketIndex: int,
  ) => JsPromise.t<requireMarketExistsModifierLogicExposedReturn> = "requireMarketExistsModifierLogicExposed"

  @send
  external setClaimAndDistributeYieldThenRebalanceMarketGlobals: (
    t,~marketIndex: int,~marketSideValueInPaymentTokenLong: Ethers.BigNumber.t,~marketSideValueInPaymentTokenShort: Ethers.BigNumber.t,~yieldManager: Ethers.ethAddress,
  ) => JsPromise.t<transaction> = "setClaimAndDistributeYieldThenRebalanceMarketGlobals"

  @send
  external setDepositFundsGlobals: (
    t,~marketIndex: int,~paymentToken: Ethers.ethAddress,~yieldManager: Ethers.ethAddress,
  ) => JsPromise.t<transaction> = "setDepositFundsGlobals"

  @send
  external setExecuteOutstandingNextPriceMintsGlobals: (
    t,~marketIndex: int,~user: Ethers.ethAddress,~isLong: bool,~syntheticToken: Ethers.ethAddress,~userNextPrice_syntheticToken_redeemAmount: Ethers.BigNumber.t,~userNextPrice_currentUpdateIndex: Ethers.BigNumber.t,~syntheticToken_priceSnapshot: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "setExecuteOutstandingNextPriceMintsGlobals"

  @send
  external setExecuteOutstandingNextPriceRedeemsGlobals: (
    t,~marketIndex: int,~user: Ethers.ethAddress,~isLong: bool,~yieldManager: Ethers.ethAddress,~userNextPrice_syntheticToken_redeemAmount: Ethers.BigNumber.t,~userNextPrice_currentUpdateIndex: Ethers.BigNumber.t,~syntheticToken_priceSnapshot: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "setExecuteOutstandingNextPriceRedeemsGlobals"

  @send
  external setExecuteOutstandingNextPriceSettlementsGlobals: (
    t,~marketIndex: int,~user: Ethers.ethAddress,~userNextPrice_currentUpdateIndex: Ethers.BigNumber.t,~marketUpdateIndex: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "setExecuteOutstandingNextPriceSettlementsGlobals"

  @send
  external setExecuteOutstandingNextPriceTokenShiftsGlobals: (
    t,~marketIndex: int,~user: Ethers.ethAddress,~isShiftFromLong: bool,~syntheticTokenShiftedTo: Ethers.ethAddress,~userNextPrice_syntheticToken_toShiftAwayFrom_marketSide: Ethers.BigNumber.t,~userNextPrice_currentUpdateIndex: Ethers.BigNumber.t,~syntheticToken_priceSnapshotShiftedFrom: Ethers.BigNumber.t,~syntheticToken_priceSnapshotShiftedTo: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "setExecuteOutstandingNextPriceTokenShiftsGlobals"

  @send
  external setFunctionToNotMock: (
    t,~functionToNotMock: string,
  ) => JsPromise.t<transaction> = "setFunctionToNotMock"

  @send
  external setGetUsersConfirmedButNotSettledBalanceGlobals: (
    t,~marketIndex: int,~user: Ethers.ethAddress,~isLong: bool,~userNextPrice_currentUpdateIndex: Ethers.BigNumber.t,~marketUpdateIndex: Ethers.BigNumber.t,~userNextPrice_paymentToken_depositAmount_isLong: Ethers.BigNumber.t,~syntheticToken_priceSnapshot_isLong: Ethers.BigNumber.t,~syntheticToken_priceSnapshot_notIsLong: Ethers.BigNumber.t,~userNextPrice_syntheticToken_toShiftAwayFrom_marketSide_notIsLong: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "setGetUsersConfirmedButNotSettledBalanceGlobals"

  @send
  external setHandleChangeInSyntheticTokensTotalSupplyGlobals: (
    t,~marketIndex: int,~longSyntheticToken: Ethers.ethAddress,~shortSyntheticToken: Ethers.ethAddress,
  ) => JsPromise.t<transaction> = "setHandleChangeInSyntheticTokensTotalSupplyGlobals"

  @send
  external setHandleTotalValueChangeForMarketWithYieldManagerGlobals: (
    t,~marketIndex: int,~yieldManager: Ethers.ethAddress,
  ) => JsPromise.t<transaction> = "setHandleTotalValueChangeForMarketWithYieldManagerGlobals"

  @send
  external setInitializeMarketParams: (
    t,~marketIndex: int,~marketIndexValue: bool,~latestMarket: int,~staker: Ethers.ethAddress,~longAddress: Ethers.ethAddress,~shortAddress: Ethers.ethAddress,
  ) => JsPromise.t<transaction> = "setInitializeMarketParams"

  @send
  external setLockFundsInMarketGlobals: (
    t,~marketIndex: int,~yieldManager: Ethers.ethAddress,
  ) => JsPromise.t<transaction> = "setLockFundsInMarketGlobals"

  @send
  external setMarketExistsMulti: (
    t,~marketIndexes: array<int>,
  ) => JsPromise.t<transaction> = "setMarketExistsMulti"

  @send
  external setMintNextPriceGlobals: (
    t,~marketIndex: int,~marketUpdateIndex: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "setMintNextPriceGlobals"

  @send
  external setMocker: (
    t,~mocker: Ethers.ethAddress,
  ) => JsPromise.t<transaction> = "setMocker"

  @send
  external setPerformOustandingBatchedSettlementsGlobals: (
    t,~marketIndex: int,~batched_amountPaymentToken_depositLong: Ethers.BigNumber.t,~batched_amountPaymentToken_depositShort: Ethers.BigNumber.t,~batched_amountSyntheticToken_redeemLong: Ethers.BigNumber.t,~batched_amountSyntheticToken_redeemShort: Ethers.BigNumber.t,~batchedAmountSyntheticTokenToShiftFromLong: Ethers.BigNumber.t,~batchedAmountSyntheticTokenToShiftFromShort: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "setPerformOustandingBatchedSettlementsGlobals"

  @send
  external setRedeemNextPriceGlobals: (
    t,~marketIndex: int,~marketUpdateIndex: Ethers.BigNumber.t,~syntheticToken: Ethers.ethAddress,~isLong: bool,
  ) => JsPromise.t<transaction> = "setRedeemNextPriceGlobals"

  @send
  external setShiftNextPriceGlobals: (
    t,~marketIndex: int,~marketUpdateIndex: Ethers.BigNumber.t,~syntheticTokenShiftedFrom: Ethers.ethAddress,~isShiftFromLong: bool,
  ) => JsPromise.t<transaction> = "setShiftNextPriceGlobals"

  @send
  external setUseexecuteOutstandingNextPriceSettlementsMock: (
    t,~shouldUseMock: bool,
  ) => JsPromise.t<transaction> = "setUseexecuteOutstandingNextPriceSettlementsMock"

  @send
  external set_updateSystemStateInternalGlobals: (
    t,~marketIndex: int,~latestUpdateIndexForMarket: Ethers.BigNumber.t,~syntheticTokenPrice_inPaymentTokens_long: Ethers.BigNumber.t,~syntheticTokenPrice_inPaymentTokens_short: Ethers.BigNumber.t,~assetPrice: Ethers.BigNumber.t,~longValue: Ethers.BigNumber.t,~shortValue: Ethers.BigNumber.t,~oracleManager: Ethers.ethAddress,~staker: Ethers.ethAddress,~synthLong: Ethers.ethAddress,~synthShort: Ethers.ethAddress,~stakerNextPrice_currentUpdateIndex: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "set_updateSystemStateInternalGlobals"

  @send
  external shiftPositionFromLongNextPrice: (
    t,~marketIndex: int,~amountSyntheticTokensToShift: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "shiftPositionFromLongNextPrice"

  @send
  external shiftPositionFromShortNextPrice: (
    t,~marketIndex: int,~amountSyntheticTokensToShift: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "shiftPositionFromShortNextPrice"

  type stakerReturn = Ethers.ethAddress
  @send
  external staker: (
    t,
  ) => JsPromise.t<stakerReturn> = "staker"

  type syntheticToken_priceSnapshotReturn = Ethers.BigNumber.t
  @send
  external syntheticToken_priceSnapshot: (
    t, int, bool, Ethers.BigNumber.t,
  ) => JsPromise.t<syntheticToken_priceSnapshotReturn> = "syntheticToken_priceSnapshot"

  type syntheticTokensReturn = Ethers.ethAddress
  @send
  external syntheticTokens: (
    t, int, bool,
  ) => JsPromise.t<syntheticTokensReturn> = "syntheticTokens"

  type tokenFactoryReturn = Ethers.ethAddress
  @send
  external tokenFactory: (
    t,
  ) => JsPromise.t<tokenFactoryReturn> = "tokenFactory"

  type treasuryReturn = Ethers.ethAddress
  @send
  external treasury: (
    t,
  ) => JsPromise.t<treasuryReturn> = "treasury"

  @send
  external updateMarketOracle: (
    t,~marketIndex: int,~newOracleManager: Ethers.ethAddress,
  ) => JsPromise.t<transaction> = "updateMarketOracle"

  @send
  external updateSystemState: (
    t,~marketIndex: int,
  ) => JsPromise.t<transaction> = "updateSystemState"

  @send
  external updateSystemStateMulti: (
    t,~marketIndexes: array<int>,
  ) => JsPromise.t<transaction> = "updateSystemStateMulti"

  type userNextPrice_currentUpdateIndexReturn = Ethers.BigNumber.t
  @send
  external userNextPrice_currentUpdateIndex: (
    t, int, Ethers.ethAddress,
  ) => JsPromise.t<userNextPrice_currentUpdateIndexReturn> = "userNextPrice_currentUpdateIndex"

  type userNextPrice_paymentToken_depositAmountReturn = Ethers.BigNumber.t
  @send
  external userNextPrice_paymentToken_depositAmount: (
    t, int, bool, Ethers.ethAddress,
  ) => JsPromise.t<userNextPrice_paymentToken_depositAmountReturn> = "userNextPrice_paymentToken_depositAmount"

  type userNextPrice_syntheticToken_redeemAmountReturn = Ethers.BigNumber.t
  @send
  external userNextPrice_syntheticToken_redeemAmount: (
    t, int, bool, Ethers.ethAddress,
  ) => JsPromise.t<userNextPrice_syntheticToken_redeemAmountReturn> = "userNextPrice_syntheticToken_redeemAmount"

  type userNextPrice_syntheticToken_toShiftAwayFrom_marketSideReturn = Ethers.BigNumber.t
  @send
  external userNextPrice_syntheticToken_toShiftAwayFrom_marketSide: (
    t, int, bool, Ethers.ethAddress,
  ) => JsPromise.t<userNextPrice_syntheticToken_toShiftAwayFrom_marketSideReturn> = "userNextPrice_syntheticToken_toShiftAwayFrom_marketSide"

  type yieldManagersReturn = Ethers.ethAddress
  @send
  external yieldManagers: (
    t, int,
  ) => JsPromise.t<yieldManagersReturn> = "yieldManagers"

        }
