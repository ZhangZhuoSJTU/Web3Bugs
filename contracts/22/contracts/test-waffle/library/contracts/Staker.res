
@@ocaml.warning("-32")
open ContractHelpers
type t = {address: Ethers.ethAddress}
let contractName = "Staker"

let at: Ethers.ethAddress => JsPromise.t<t> = contractAddress =>
  attachToContract(contractName, ~contractAddress)->Obj.magic

let make: unit => JsPromise.t<t> = () => deployContract0(contractName)->Obj.magic


  type fLOAT_ISSUANCE_FIXED_DECIMALReturn = Ethers.BigNumber.t
  @send
  external fLOAT_ISSUANCE_FIXED_DECIMAL: (
    t,
  ) => JsPromise.t<fLOAT_ISSUANCE_FIXED_DECIMALReturn> = "FLOAT_ISSUANCE_FIXED_DECIMAL"

  type accumulativeFloatPerSyntheticTokenSnapshotsReturn = {
timestamp: Ethers.BigNumber.t,
accumulativeFloatPerSyntheticToken_long: Ethers.BigNumber.t,
accumulativeFloatPerSyntheticToken_short: Ethers.BigNumber.t,
    }
  @send
  external accumulativeFloatPerSyntheticTokenSnapshots: (
    t, int, Ethers.BigNumber.t,
  ) => JsPromise.t<accumulativeFloatPerSyntheticTokenSnapshotsReturn> = "accumulativeFloatPerSyntheticTokenSnapshots"

  @send
  external addNewStakingFund: (
    t,~marketIndex: int,~longToken: Ethers.ethAddress,~shortToken: Ethers.ethAddress,~kInitialMultiplier: Ethers.BigNumber.t,~kPeriod: Ethers.BigNumber.t,~unstakeFee_e18: Ethers.BigNumber.t,~balanceIncentiveCurve_exponent: Ethers.BigNumber.t,~balanceIncentiveCurve_equilibriumOffset: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "addNewStakingFund"

  type adminReturn = Ethers.ethAddress
  @send
  external admin: (
    t,
  ) => JsPromise.t<adminReturn> = "admin"

  type balanceIncentiveCurve_equilibriumOffsetReturn = Ethers.BigNumber.t
  @send
  external balanceIncentiveCurve_equilibriumOffset: (
    t, int,
  ) => JsPromise.t<balanceIncentiveCurve_equilibriumOffsetReturn> = "balanceIncentiveCurve_equilibriumOffset"

  type balanceIncentiveCurve_exponentReturn = Ethers.BigNumber.t
  @send
  external balanceIncentiveCurve_exponent: (
    t, int,
  ) => JsPromise.t<balanceIncentiveCurve_exponentReturn> = "balanceIncentiveCurve_exponent"

  type batched_stakerNextTokenShiftIndexReturn = Ethers.BigNumber.t
  @send
  external batched_stakerNextTokenShiftIndex: (
    t, int,
  ) => JsPromise.t<batched_stakerNextTokenShiftIndexReturn> = "batched_stakerNextTokenShiftIndex"

  @send
  external changeAdmin: (
    t,~admin: Ethers.ethAddress,
  ) => JsPromise.t<transaction> = "changeAdmin"

  @send
  external changeBalanceIncentiveEquilibriumOffset: (
    t,~marketIndex: int,~balanceIncentiveCurve_equilibriumOffset: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "changeBalanceIncentiveEquilibriumOffset"

  @send
  external changeBalanceIncentiveExponent: (
    t,~marketIndex: int,~balanceIncentiveCurve_exponent: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "changeBalanceIncentiveExponent"

  @send
  external changeFloatPercentage: (
    t,~newFloatPercentage: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "changeFloatPercentage"

  @send
  external changeMarketLaunchIncentiveParameters: (
    t,~marketIndex: int,~period: Ethers.BigNumber.t,~initialMultiplier: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "changeMarketLaunchIncentiveParameters"

  @send
  external changeUnstakeFee: (
    t,~marketIndex: int,~newMarketUnstakeFee_e18: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "changeUnstakeFee"

  @send
  external claimFloatCustom: (
    t,~marketIndexes: array<int>,
  ) => JsPromise.t<transaction> = "claimFloatCustom"

  @send
  external claimFloatCustomFor: (
    t,~marketIndexes: array<int>,~user: Ethers.ethAddress,
  ) => JsPromise.t<transaction> = "claimFloatCustomFor"

  type floatCapitalReturn = Ethers.ethAddress
  @send
  external floatCapital: (
    t,
  ) => JsPromise.t<floatCapitalReturn> = "floatCapital"

  type floatPercentageReturn = Ethers.BigNumber.t
  @send
  external floatPercentage: (
    t,
  ) => JsPromise.t<floatPercentageReturn> = "floatPercentage"

  type floatTokenReturn = Ethers.ethAddress
  @send
  external floatToken: (
    t,
  ) => JsPromise.t<floatTokenReturn> = "floatToken"

  type floatTreasuryReturn = Ethers.ethAddress
  @send
  external floatTreasury: (
    t,
  ) => JsPromise.t<floatTreasuryReturn> = "floatTreasury"

  @send
  external initialize: (
    t,~admin: Ethers.ethAddress,~longShort: Ethers.ethAddress,~floatToken: Ethers.ethAddress,~floatTreasury: Ethers.ethAddress,~floatCapital: Ethers.ethAddress,~floatPercentage: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "initialize"

  type latestRewardIndexReturn = Ethers.BigNumber.t
  @send
  external latestRewardIndex: (
    t, int,
  ) => JsPromise.t<latestRewardIndexReturn> = "latestRewardIndex"

  type longShortReturn = Ethers.ethAddress
  @send
  external longShort: (
    t,
  ) => JsPromise.t<longShortReturn> = "longShort"

  type marketIndexOfTokenReturn = int
  @send
  external marketIndexOfToken: (
    t, Ethers.ethAddress,
  ) => JsPromise.t<marketIndexOfTokenReturn> = "marketIndexOfToken"

  type marketLaunchIncentive_multipliersReturn = Ethers.BigNumber.t
  @send
  external marketLaunchIncentive_multipliers: (
    t, int,
  ) => JsPromise.t<marketLaunchIncentive_multipliersReturn> = "marketLaunchIncentive_multipliers"

  type marketLaunchIncentive_periodReturn = Ethers.BigNumber.t
  @send
  external marketLaunchIncentive_period: (
    t, int,
  ) => JsPromise.t<marketLaunchIncentive_periodReturn> = "marketLaunchIncentive_period"

  type marketUnstakeFee_e18Return = Ethers.BigNumber.t
  @send
  external marketUnstakeFee_e18: (
    t, int,
  ) => JsPromise.t<marketUnstakeFee_e18Return> = "marketUnstakeFee_e18"

  @send
  external pushUpdatedMarketPricesToUpdateFloatIssuanceCalculations: (
    t,~marketIndex: int,~longPrice: Ethers.BigNumber.t,~shortPrice: Ethers.BigNumber.t,~longValue: Ethers.BigNumber.t,~shortValue: Ethers.BigNumber.t,~stakerTokenShiftIndex_to_longShortMarketPriceSnapshotIndex_mappingIfShiftExecuted: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "pushUpdatedMarketPricesToUpdateFloatIssuanceCalculations"

  type safeExponentBitShiftingReturn = Ethers.BigNumber.t
  @send
  external safeExponentBitShifting: (
    t,
  ) => JsPromise.t<safeExponentBitShiftingReturn> = "safeExponentBitShifting"

  @send
  external shiftTokens: (
    t,~amountSyntheticTokensToShift: Ethers.BigNumber.t,~marketIndex: int,~isShiftFromLong: bool,
  ) => JsPromise.t<transaction> = "shiftTokens"

  @send
  external stakeFromUser: (
    t,~from: Ethers.ethAddress,~amount: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "stakeFromUser"

  type stakerTokenShiftIndex_to_accumulativeFloatIssuanceSnapshotIndex_mappingReturn = Ethers.BigNumber.t
  @send
  external stakerTokenShiftIndex_to_accumulativeFloatIssuanceSnapshotIndex_mapping: (
    t, Ethers.BigNumber.t,
  ) => JsPromise.t<stakerTokenShiftIndex_to_accumulativeFloatIssuanceSnapshotIndex_mappingReturn> = "stakerTokenShiftIndex_to_accumulativeFloatIssuanceSnapshotIndex_mapping"

  type stakerTokenShiftIndex_to_longShortMarketPriceSnapshotIndex_mappingReturn = Ethers.BigNumber.t
  @send
  external stakerTokenShiftIndex_to_longShortMarketPriceSnapshotIndex_mapping: (
    t, Ethers.BigNumber.t,
  ) => JsPromise.t<stakerTokenShiftIndex_to_longShortMarketPriceSnapshotIndex_mappingReturn> = "stakerTokenShiftIndex_to_longShortMarketPriceSnapshotIndex_mapping"

  type syntheticTokensReturn = Ethers.ethAddress
  @send
  external syntheticTokens: (
    t, int, bool,
  ) => JsPromise.t<syntheticTokensReturn> = "syntheticTokens"

  type userAmountStakedReturn = Ethers.BigNumber.t
  @send
  external userAmountStaked: (
    t, Ethers.ethAddress, Ethers.ethAddress,
  ) => JsPromise.t<userAmountStakedReturn> = "userAmountStaked"

  type userIndexOfLastClaimedRewardReturn = Ethers.BigNumber.t
  @send
  external userIndexOfLastClaimedReward: (
    t, int, Ethers.ethAddress,
  ) => JsPromise.t<userIndexOfLastClaimedRewardReturn> = "userIndexOfLastClaimedReward"

  type userNextPrice_amountStakedSyntheticToken_toShiftAwayFrom_longReturn = Ethers.BigNumber.t
  @send
  external userNextPrice_amountStakedSyntheticToken_toShiftAwayFrom_long: (
    t, int, Ethers.ethAddress,
  ) => JsPromise.t<userNextPrice_amountStakedSyntheticToken_toShiftAwayFrom_longReturn> = "userNextPrice_amountStakedSyntheticToken_toShiftAwayFrom_long"

  type userNextPrice_amountStakedSyntheticToken_toShiftAwayFrom_shortReturn = Ethers.BigNumber.t
  @send
  external userNextPrice_amountStakedSyntheticToken_toShiftAwayFrom_short: (
    t, int, Ethers.ethAddress,
  ) => JsPromise.t<userNextPrice_amountStakedSyntheticToken_toShiftAwayFrom_shortReturn> = "userNextPrice_amountStakedSyntheticToken_toShiftAwayFrom_short"

  type userNextPrice_stakedSyntheticTokenShiftIndexReturn = Ethers.BigNumber.t
  @send
  external userNextPrice_stakedSyntheticTokenShiftIndex: (
    t, int, Ethers.ethAddress,
  ) => JsPromise.t<userNextPrice_stakedSyntheticTokenShiftIndexReturn> = "userNextPrice_stakedSyntheticTokenShiftIndex"

  @send
  external withdraw: (
    t,~token: Ethers.ethAddress,~amount: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "withdraw"

  @send
  external withdrawAll: (
    t,~token: Ethers.ethAddress,
  ) => JsPromise.t<transaction> = "withdrawAll"


module Exposed = {
          let contractName = "StakerMockable"

          let make: unit => JsPromise.t<t> = () => deployContract0(contractName)->Obj.magic
          
  type fLOAT_ISSUANCE_FIXED_DECIMALReturn = Ethers.BigNumber.t
  @send
  external fLOAT_ISSUANCE_FIXED_DECIMAL: (
    t,
  ) => JsPromise.t<fLOAT_ISSUANCE_FIXED_DECIMALReturn> = "FLOAT_ISSUANCE_FIXED_DECIMAL"

  @send
  external _calculateAccumulatedFloatExposed: (
    t,~marketIndex: int,~user: Ethers.ethAddress,
  ) => JsPromise.t<transaction> = "_calculateAccumulatedFloatExposed"

    type _calculateAccumulatedFloatExposedReturn = Ethers.BigNumber.t
    @send @scope("callStatic")
    external _calculateAccumulatedFloatExposedCall: (
      t,~marketIndex: int,~user: Ethers.ethAddress,
    ) => JsPromise.t<_calculateAccumulatedFloatExposedReturn> = "_calculateAccumulatedFloatExposed"

  type _calculateAccumulatedFloatInRangeExposedReturn = Ethers.BigNumber.t
  @send
  external _calculateAccumulatedFloatInRangeExposed: (
    t,~marketIndex: int,~amountStakedLong: Ethers.BigNumber.t,~amountStakedShort: Ethers.BigNumber.t,~rewardIndexFrom: Ethers.BigNumber.t,~rewardIndexTo: Ethers.BigNumber.t,
  ) => JsPromise.t<_calculateAccumulatedFloatInRangeExposedReturn> = "_calculateAccumulatedFloatInRangeExposed"

  type _calculateFloatPerSecondExposedReturn = {
longFloatPerSecond: Ethers.BigNumber.t,
shortFloatPerSecond: Ethers.BigNumber.t,
    }
  @send
  external _calculateFloatPerSecondExposed: (
    t,~marketIndex: int,~longPrice: Ethers.BigNumber.t,~shortPrice: Ethers.BigNumber.t,~longValue: Ethers.BigNumber.t,~shortValue: Ethers.BigNumber.t,
  ) => JsPromise.t<_calculateFloatPerSecondExposedReturn> = "_calculateFloatPerSecondExposed"

  type _calculateNewCumulativeIssuancePerStakedSynthExposedReturn = {
longCumulativeRates: Ethers.BigNumber.t,
shortCumulativeRates: Ethers.BigNumber.t,
    }
  @send
  external _calculateNewCumulativeIssuancePerStakedSynthExposed: (
    t,~marketIndex: int,~longPrice: Ethers.BigNumber.t,~shortPrice: Ethers.BigNumber.t,~longValue: Ethers.BigNumber.t,~shortValue: Ethers.BigNumber.t,
  ) => JsPromise.t<_calculateNewCumulativeIssuancePerStakedSynthExposedReturn> = "_calculateNewCumulativeIssuancePerStakedSynthExposed"

  type _calculateTimeDeltaFromLastAccumulativeIssuancePerStakedSynthSnapshotExposedReturn = Ethers.BigNumber.t
  @send
  external _calculateTimeDeltaFromLastAccumulativeIssuancePerStakedSynthSnapshotExposed: (
    t,~marketIndex: int,
  ) => JsPromise.t<_calculateTimeDeltaFromLastAccumulativeIssuancePerStakedSynthSnapshotExposedReturn> = "_calculateTimeDeltaFromLastAccumulativeIssuancePerStakedSynthSnapshotExposed"

  @send
  external _changeBalanceIncentiveEquilibriumOffsetExposed: (
    t,~marketIndex: int,~balanceIncentiveCurve_equilibriumOffset: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "_changeBalanceIncentiveEquilibriumOffsetExposed"

  @send
  external _changeBalanceIncentiveExponentExposed: (
    t,~marketIndex: int,~balanceIncentiveCurve_exponent: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "_changeBalanceIncentiveExponentExposed"

  @send
  external _changeFloatPercentageExposed: (
    t,~newFloatPercentage: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "_changeFloatPercentageExposed"

  @send
  external _changeMarketLaunchIncentiveParametersExposed: (
    t,~marketIndex: int,~period: Ethers.BigNumber.t,~initialMultiplier: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "_changeMarketLaunchIncentiveParametersExposed"

  @send
  external _changeUnstakeFeeExposed: (
    t,~marketIndex: int,~newMarketUnstakeFee_e18: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "_changeUnstakeFeeExposed"

  type _getKValueExposedReturn = Ethers.BigNumber.t
  @send
  external _getKValueExposed: (
    t,~marketIndex: int,
  ) => JsPromise.t<_getKValueExposedReturn> = "_getKValueExposed"

  type _getMarketLaunchIncentiveParametersExposedReturn = {
period: Ethers.BigNumber.t,
multiplier: Ethers.BigNumber.t,
    }
  @send
  external _getMarketLaunchIncentiveParametersExposed: (
    t,~marketIndex: int,
  ) => JsPromise.t<_getMarketLaunchIncentiveParametersExposedReturn> = "_getMarketLaunchIncentiveParametersExposed"

  @send
  external _mintAccumulatedFloatExposed: (
    t,~marketIndex: int,~user: Ethers.ethAddress,
  ) => JsPromise.t<transaction> = "_mintAccumulatedFloatExposed"

  @send
  external _mintAccumulatedFloatMultiExposed: (
    t,~marketIndexes: array<int>,~user: Ethers.ethAddress,
  ) => JsPromise.t<transaction> = "_mintAccumulatedFloatMultiExposed"

  @send
  external _mintFloatExposed: (
    t,~user: Ethers.ethAddress,~floatToMint: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "_mintFloatExposed"

  @send
  external _setCurrentAccumulativeIssuancePerStakeStakedSynthSnapshotExposed: (
    t,~marketIndex: int,~longPrice: Ethers.BigNumber.t,~shortPrice: Ethers.BigNumber.t,~longValue: Ethers.BigNumber.t,~shortValue: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "_setCurrentAccumulativeIssuancePerStakeStakedSynthSnapshotExposed"

  @send
  external _stakeExposed: (
    t,~token: Ethers.ethAddress,~amount: Ethers.BigNumber.t,~user: Ethers.ethAddress,
  ) => JsPromise.t<transaction> = "_stakeExposed"

  @send
  external _withdrawExposed: (
    t,~marketIndex: int,~token: Ethers.ethAddress,~amount: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "_withdrawExposed"

  type accumulativeFloatPerSyntheticTokenSnapshotsReturn = {
timestamp: Ethers.BigNumber.t,
accumulativeFloatPerSyntheticToken_long: Ethers.BigNumber.t,
accumulativeFloatPerSyntheticToken_short: Ethers.BigNumber.t,
    }
  @send
  external accumulativeFloatPerSyntheticTokenSnapshots: (
    t, int, Ethers.BigNumber.t,
  ) => JsPromise.t<accumulativeFloatPerSyntheticTokenSnapshotsReturn> = "accumulativeFloatPerSyntheticTokenSnapshots"

  @send
  external addNewStakingFund: (
    t,~marketIndex: int,~longToken: Ethers.ethAddress,~shortToken: Ethers.ethAddress,~kInitialMultiplier: Ethers.BigNumber.t,~kPeriod: Ethers.BigNumber.t,~unstakeFee_e18: Ethers.BigNumber.t,~balanceIncentiveCurve_exponent: Ethers.BigNumber.t,~balanceIncentiveCurve_equilibriumOffset: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "addNewStakingFund"

  type adminReturn = Ethers.ethAddress
  @send
  external admin: (
    t,
  ) => JsPromise.t<adminReturn> = "admin"

  type balanceIncentiveCurve_equilibriumOffsetReturn = Ethers.BigNumber.t
  @send
  external balanceIncentiveCurve_equilibriumOffset: (
    t, int,
  ) => JsPromise.t<balanceIncentiveCurve_equilibriumOffsetReturn> = "balanceIncentiveCurve_equilibriumOffset"

  type balanceIncentiveCurve_exponentReturn = Ethers.BigNumber.t
  @send
  external balanceIncentiveCurve_exponent: (
    t, int,
  ) => JsPromise.t<balanceIncentiveCurve_exponentReturn> = "balanceIncentiveCurve_exponent"

  type batched_stakerNextTokenShiftIndexReturn = Ethers.BigNumber.t
  @send
  external batched_stakerNextTokenShiftIndex: (
    t, int,
  ) => JsPromise.t<batched_stakerNextTokenShiftIndexReturn> = "batched_stakerNextTokenShiftIndex"

  @send
  external changeAdmin: (
    t,~admin: Ethers.ethAddress,
  ) => JsPromise.t<transaction> = "changeAdmin"

  @send
  external changeBalanceIncentiveEquilibriumOffset: (
    t,~marketIndex: int,~balanceIncentiveCurve_equilibriumOffset: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "changeBalanceIncentiveEquilibriumOffset"

  @send
  external changeBalanceIncentiveExponent: (
    t,~marketIndex: int,~balanceIncentiveCurve_exponent: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "changeBalanceIncentiveExponent"

  @send
  external changeFloatPercentage: (
    t,~newFloatPercentage: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "changeFloatPercentage"

  @send
  external changeMarketLaunchIncentiveParameters: (
    t,~marketIndex: int,~period: Ethers.BigNumber.t,~initialMultiplier: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "changeMarketLaunchIncentiveParameters"

  @send
  external changeUnstakeFee: (
    t,~marketIndex: int,~newMarketUnstakeFee_e18: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "changeUnstakeFee"

  @send
  external claimFloatCustom: (
    t,~marketIndexes: array<int>,
  ) => JsPromise.t<transaction> = "claimFloatCustom"

  @send
  external claimFloatCustomFor: (
    t,~marketIndexes: array<int>,~user: Ethers.ethAddress,
  ) => JsPromise.t<transaction> = "claimFloatCustomFor"

  type floatCapitalReturn = Ethers.ethAddress
  @send
  external floatCapital: (
    t,
  ) => JsPromise.t<floatCapitalReturn> = "floatCapital"

  type floatPercentageReturn = Ethers.BigNumber.t
  @send
  external floatPercentage: (
    t,
  ) => JsPromise.t<floatPercentageReturn> = "floatPercentage"

  type floatTokenReturn = Ethers.ethAddress
  @send
  external floatToken: (
    t,
  ) => JsPromise.t<floatTokenReturn> = "floatToken"

  type floatTreasuryReturn = Ethers.ethAddress
  @send
  external floatTreasury: (
    t,
  ) => JsPromise.t<floatTreasuryReturn> = "floatTreasury"

  type getRequiredAmountOfBitShiftForSafeExponentiationPerfectReturn = Ethers.BigNumber.t
  @send
  external getRequiredAmountOfBitShiftForSafeExponentiationPerfect: (
    t,~number: Ethers.BigNumber.t,~exponent: Ethers.BigNumber.t,
  ) => JsPromise.t<getRequiredAmountOfBitShiftForSafeExponentiationPerfectReturn> = "getRequiredAmountOfBitShiftForSafeExponentiationPerfect"

  @send
  external initialize: (
    t,~admin: Ethers.ethAddress,~longShort: Ethers.ethAddress,~floatToken: Ethers.ethAddress,~floatTreasury: Ethers.ethAddress,~floatCapital: Ethers.ethAddress,~floatPercentage: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "initialize"

  type latestRewardIndexReturn = Ethers.BigNumber.t
  @send
  external latestRewardIndex: (
    t, int,
  ) => JsPromise.t<latestRewardIndexReturn> = "latestRewardIndex"

  type longShortReturn = Ethers.ethAddress
  @send
  external longShort: (
    t,
  ) => JsPromise.t<longShortReturn> = "longShort"

  type marketIndexOfTokenReturn = int
  @send
  external marketIndexOfToken: (
    t, Ethers.ethAddress,
  ) => JsPromise.t<marketIndexOfTokenReturn> = "marketIndexOfToken"

  type marketLaunchIncentive_multipliersReturn = Ethers.BigNumber.t
  @send
  external marketLaunchIncentive_multipliers: (
    t, int,
  ) => JsPromise.t<marketLaunchIncentive_multipliersReturn> = "marketLaunchIncentive_multipliers"

  type marketLaunchIncentive_periodReturn = Ethers.BigNumber.t
  @send
  external marketLaunchIncentive_period: (
    t, int,
  ) => JsPromise.t<marketLaunchIncentive_periodReturn> = "marketLaunchIncentive_period"

  type marketUnstakeFee_e18Return = Ethers.BigNumber.t
  @send
  external marketUnstakeFee_e18: (
    t, int,
  ) => JsPromise.t<marketUnstakeFee_e18Return> = "marketUnstakeFee_e18"

  @send
  external onlyAdminModifierLogicExposed: (
    t,
  ) => JsPromise.t<transaction> = "onlyAdminModifierLogicExposed"

  @send
  external onlyLongShortModifierLogicExposed: (
    t,
  ) => JsPromise.t<transaction> = "onlyLongShortModifierLogicExposed"

  @send
  external onlyValidMarketModifierLogicExposed: (
    t,~marketIndex: int,
  ) => JsPromise.t<transaction> = "onlyValidMarketModifierLogicExposed"

  @send
  external onlyValidSyntheticModifierLogicExposed: (
    t,~synth: Ethers.ethAddress,
  ) => JsPromise.t<transaction> = "onlyValidSyntheticModifierLogicExposed"

  @send
  external pushUpdatedMarketPricesToUpdateFloatIssuanceCalculations: (
    t,~marketIndex: int,~longPrice: Ethers.BigNumber.t,~shortPrice: Ethers.BigNumber.t,~longValue: Ethers.BigNumber.t,~shortValue: Ethers.BigNumber.t,~stakerTokenShiftIndex_to_longShortMarketPriceSnapshotIndex_mappingIfShiftExecuted: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "pushUpdatedMarketPricesToUpdateFloatIssuanceCalculations"

  type safeExponentBitShiftingReturn = Ethers.BigNumber.t
  @send
  external safeExponentBitShifting: (
    t,
  ) => JsPromise.t<safeExponentBitShiftingReturn> = "safeExponentBitShifting"

  @send
  external setAddNewStakingFundParams: (
    t,~marketIndex: int,~longToken: Ethers.ethAddress,~shortToken: Ethers.ethAddress,~mockAddress: Ethers.ethAddress,~longShortAddress: Ethers.ethAddress,
  ) => JsPromise.t<transaction> = "setAddNewStakingFundParams"

  @send
  external setAddNewStateForFloatRewardsGlobals: (
    t,~marketIndex: int,~batched_stakerNextTokenShiftIndex: Ethers.BigNumber.t,~latestRewardIndex: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "setAddNewStateForFloatRewardsGlobals"

  @send
  external setCalculateAccumulatedFloatInRangeGlobals: (
    t,~marketIndex: int,~rewardIndexTo: Ethers.BigNumber.t,~rewardIndexFrom: Ethers.BigNumber.t,~syntheticRewardToLongToken: Ethers.BigNumber.t,~syntheticRewardFromLongToken: Ethers.BigNumber.t,~syntheticRewardToShortToken: Ethers.BigNumber.t,~syntheticRewardFromShortToken: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "setCalculateAccumulatedFloatInRangeGlobals"

  @send
  external setCalculateNewCumulativeRateParams: (
    t,~marketIndex: int,~latestRewardIndexForMarket: Ethers.BigNumber.t,~accumFloatLong: Ethers.BigNumber.t,~accumFloatShort: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "setCalculateNewCumulativeRateParams"

  @send
  external setCalculateTimeDeltaParams: (
    t,~marketIndex: int,~latestRewardIndexForMarket: Ethers.BigNumber.t,~timestamp: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "setCalculateTimeDeltaParams"

  @send
  external setEquilibriumOffset: (
    t,~marketIndex: int,~balanceIncentiveCurve_equilibriumOffset: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "setEquilibriumOffset"

  @send
  external setFloatRewardCalcParams: (
    t,~marketIndex: int,~longToken: Ethers.ethAddress,~shortToken: Ethers.ethAddress,~newLatestRewardIndex: Ethers.BigNumber.t,~user: Ethers.ethAddress,~usersLatestClaimedReward: Ethers.BigNumber.t,~accumulativeFloatPerTokenLatestLong: Ethers.BigNumber.t,~accumulativeFloatPerTokenLatestShort: Ethers.BigNumber.t,~accumulativeFloatPerTokenUserLong: Ethers.BigNumber.t,~accumulativeFloatPerTokenUserShort: Ethers.BigNumber.t,~newUserAmountStakedLong: Ethers.BigNumber.t,~newUserAmountStakedShort: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "setFloatRewardCalcParams"

  @send
  external setFunctionToNotMock: (
    t,~functionToNotMock: string,
  ) => JsPromise.t<transaction> = "setFunctionToNotMock"

  @send
  external setGetKValueParams: (
    t,~marketIndex: int,~timestamp: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "setGetKValueParams"

  @send
  external setGetMarketLaunchIncentiveParametersParams: (
    t,~marketIndex: int,~period: Ethers.BigNumber.t,~multiplier: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "setGetMarketLaunchIncentiveParametersParams"

  @send
  external setLongShort: (
    t,~longShort: Ethers.ethAddress,
  ) => JsPromise.t<transaction> = "setLongShort"

  @send
  external setMintAccumulatedFloatAndClaimFloatParams: (
    t,~marketIndex: int,~latestRewardIndexForMarket: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "setMintAccumulatedFloatAndClaimFloatParams"

  @send
  external setMocker: (
    t,~mocker: Ethers.ethAddress,
  ) => JsPromise.t<transaction> = "setMocker"

  @send
  external setSetRewardObjectsParams: (
    t,~marketIndex: int,~latestRewardIndexForMarket: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "setSetRewardObjectsParams"

  @send
  external setShiftParams: (
    t,~marketIndex: int,~user: Ethers.ethAddress,~shiftAmountLong: Ethers.BigNumber.t,~shiftAmountShort: Ethers.BigNumber.t,~userNextPrice_stakedSyntheticTokenShiftIndex: Ethers.BigNumber.t,~batched_stakerNextTokenShiftIndex: Ethers.BigNumber.t,~takerTokenShiftIndex_to_longShortMarketPriceSnapshotIndex_mapping: Ethers.BigNumber.t,~stakerTokenShiftIndex_to_accumulativeFloatIssuanceSnapshotIndex_mapping: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "setShiftParams"

  @send
  external setShiftTokensParams: (
    t,~marketIndex: int,~isShiftFromLong: bool,~user: Ethers.ethAddress,~amountSyntheticTokensToShift: Ethers.BigNumber.t,~userAmountStaked: Ethers.BigNumber.t,~userNextPrice_stakedSyntheticTokenShiftIndex: Ethers.BigNumber.t,~batched_stakerNextTokenShiftIndex: Ethers.BigNumber.t,~syntheticToken: Ethers.ethAddress,
  ) => JsPromise.t<transaction> = "setShiftTokensParams"

  @send
  external setStakeFromUserParams: (
    t,~longshort: Ethers.ethAddress,~token: Ethers.ethAddress,~marketIndexForToken: int,
  ) => JsPromise.t<transaction> = "setStakeFromUserParams"

  @send
  external setWithdrawAllGlobals: (
    t,~marketIndex: int,~longShort: Ethers.ethAddress,~user: Ethers.ethAddress,~amountStaked: Ethers.BigNumber.t,~token: Ethers.ethAddress,
  ) => JsPromise.t<transaction> = "setWithdrawAllGlobals"

  @send
  external setWithdrawGlobals: (
    t,~marketIndex: int,~longShort: Ethers.ethAddress,~token: Ethers.ethAddress,
  ) => JsPromise.t<transaction> = "setWithdrawGlobals"

  @send
  external set_mintFloatParams: (
    t,~floatToken: Ethers.ethAddress,~floatPercentage: int,
  ) => JsPromise.t<transaction> = "set_mintFloatParams"

  @send
  external set_stakeParams: (
    t,~user: Ethers.ethAddress,~marketIndex: int,~latestRewardIndex: Ethers.BigNumber.t,~token: Ethers.ethAddress,~userAmountStaked: Ethers.BigNumber.t,~userLastRewardIndex: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "set_stakeParams"

  @send
  external set_updateStateParams: (
    t,~longShort: Ethers.ethAddress,~token: Ethers.ethAddress,~tokenMarketIndex: int,
  ) => JsPromise.t<transaction> = "set_updateStateParams"

  @send
  external set_withdrawGlobals: (
    t,~marketIndex: int,~syntheticToken: Ethers.ethAddress,~user: Ethers.ethAddress,~amountStaked: Ethers.BigNumber.t,~fees: Ethers.BigNumber.t,~treasury: Ethers.ethAddress,
  ) => JsPromise.t<transaction> = "set_withdrawGlobals"

  @send
  external shiftTokens: (
    t,~amountSyntheticTokensToShift: Ethers.BigNumber.t,~marketIndex: int,~isShiftFromLong: bool,
  ) => JsPromise.t<transaction> = "shiftTokens"

  @send
  external stakeFromUser: (
    t,~from: Ethers.ethAddress,~amount: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "stakeFromUser"

  type stakerTokenShiftIndex_to_accumulativeFloatIssuanceSnapshotIndex_mappingReturn = Ethers.BigNumber.t
  @send
  external stakerTokenShiftIndex_to_accumulativeFloatIssuanceSnapshotIndex_mapping: (
    t, Ethers.BigNumber.t,
  ) => JsPromise.t<stakerTokenShiftIndex_to_accumulativeFloatIssuanceSnapshotIndex_mappingReturn> = "stakerTokenShiftIndex_to_accumulativeFloatIssuanceSnapshotIndex_mapping"

  type stakerTokenShiftIndex_to_longShortMarketPriceSnapshotIndex_mappingReturn = Ethers.BigNumber.t
  @send
  external stakerTokenShiftIndex_to_longShortMarketPriceSnapshotIndex_mapping: (
    t, Ethers.BigNumber.t,
  ) => JsPromise.t<stakerTokenShiftIndex_to_longShortMarketPriceSnapshotIndex_mappingReturn> = "stakerTokenShiftIndex_to_longShortMarketPriceSnapshotIndex_mapping"

  type syntheticTokensReturn = Ethers.ethAddress
  @send
  external syntheticTokens: (
    t, int, bool,
  ) => JsPromise.t<syntheticTokensReturn> = "syntheticTokens"

  type userAmountStakedReturn = Ethers.BigNumber.t
  @send
  external userAmountStaked: (
    t, Ethers.ethAddress, Ethers.ethAddress,
  ) => JsPromise.t<userAmountStakedReturn> = "userAmountStaked"

  type userIndexOfLastClaimedRewardReturn = Ethers.BigNumber.t
  @send
  external userIndexOfLastClaimedReward: (
    t, int, Ethers.ethAddress,
  ) => JsPromise.t<userIndexOfLastClaimedRewardReturn> = "userIndexOfLastClaimedReward"

  type userNextPrice_amountStakedSyntheticToken_toShiftAwayFrom_longReturn = Ethers.BigNumber.t
  @send
  external userNextPrice_amountStakedSyntheticToken_toShiftAwayFrom_long: (
    t, int, Ethers.ethAddress,
  ) => JsPromise.t<userNextPrice_amountStakedSyntheticToken_toShiftAwayFrom_longReturn> = "userNextPrice_amountStakedSyntheticToken_toShiftAwayFrom_long"

  type userNextPrice_amountStakedSyntheticToken_toShiftAwayFrom_shortReturn = Ethers.BigNumber.t
  @send
  external userNextPrice_amountStakedSyntheticToken_toShiftAwayFrom_short: (
    t, int, Ethers.ethAddress,
  ) => JsPromise.t<userNextPrice_amountStakedSyntheticToken_toShiftAwayFrom_shortReturn> = "userNextPrice_amountStakedSyntheticToken_toShiftAwayFrom_short"

  type userNextPrice_stakedSyntheticTokenShiftIndexReturn = Ethers.BigNumber.t
  @send
  external userNextPrice_stakedSyntheticTokenShiftIndex: (
    t, int, Ethers.ethAddress,
  ) => JsPromise.t<userNextPrice_stakedSyntheticTokenShiftIndexReturn> = "userNextPrice_stakedSyntheticTokenShiftIndex"

  @send
  external withdraw: (
    t,~token: Ethers.ethAddress,~amount: Ethers.BigNumber.t,
  ) => JsPromise.t<transaction> = "withdraw"

  @send
  external withdrawAll: (
    t,~token: Ethers.ethAddress,
  ) => JsPromise.t<transaction> = "withdrawAll"

        }
