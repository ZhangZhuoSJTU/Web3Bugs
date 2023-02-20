import { Address } from "../types";
import { Account } from "../test/types";
import { BigNumber } from "ethers";

import {
  ether,
  preciseDiv,
  preciseMul
} from "../index";

import { TWO, ZERO, ONE_DAY_IN_SECONDS } from "../constants";
import { PerpV2BasisTradingModule, PerpV2LeverageModuleV2, SetToken } from "../contracts";
import { PerpV2Fixture } from "../fixtures";


// Converts PRECISE_UNIT value into USDC decimals value
export function toUSDCDecimals(quantity: BigNumber): BigNumber {
  return quantity.div(BigNumber.from(10).pow(12));
}

// Allocates all deposited collateral to a levered position. Returns new baseToken position unit
export async function leverUp(
  setToken: SetToken,
  module: PerpV2LeverageModuleV2 | PerpV2BasisTradingModule,
  fixture: PerpV2Fixture,
  owner: Account,
  baseToken: Address,
  leverageRatio: number,
  slippagePercentage: BigNumber,
  isLong: boolean,
  trackFunding?: boolean,
): Promise<BigNumber>{
  const spotPrice = await fixture.getSpotPrice(baseToken);
  const totalSupply = await setToken.totalSupply();
  const collateralBalance = (await module.getAccountInfo(setToken.address)).collateralBalance;
  const baseTradeQuantityNotional = preciseDiv(collateralBalance.mul(leverageRatio), spotPrice);

  const baseTradeQuantityUnit = (isLong)
    ? preciseDiv(baseTradeQuantityNotional, totalSupply)
    : preciseDiv(baseTradeQuantityNotional, totalSupply).mul(-1);

  const estimatedQuoteQuantityNotional =  preciseMul(baseTradeQuantityNotional, spotPrice).abs();
  const allowedSlippage = preciseMul(estimatedQuoteQuantityNotional, ether(.02));

  const slippageAdjustedQuoteQuanitityNotional = (isLong)
    ? estimatedQuoteQuantityNotional.add(allowedSlippage)
    : estimatedQuoteQuantityNotional.sub(allowedSlippage);

  const receiveQuoteQuantityUnit = preciseDiv(
    slippageAdjustedQuoteQuanitityNotional,
    totalSupply
  );

  if (trackFunding) {
    await (module as PerpV2BasisTradingModule).connect(owner.wallet).tradeAndTrackFunding(
      setToken.address,
      baseToken,
      baseTradeQuantityUnit,
      receiveQuoteQuantityUnit
    );
  } else {
    await module.connect(owner.wallet).trade(
      setToken.address,
      baseToken,
      baseTradeQuantityUnit,
      receiveQuoteQuantityUnit
    );
  }

  return baseTradeQuantityUnit;
}

// Returns notional amount of USDC to transfer in on issue. Handles multiple positions, long and short.
// Returned value is converted to USDC decimals.
export async function calculateUSDCTransferIn(
  setToken: SetToken,
  setQuantity: BigNumber,
  module: PerpV2LeverageModuleV2 | PerpV2BasisTradingModule,
  fixture: PerpV2Fixture,
) {
  return toUSDCDecimals(await calculateUSDCTransferInPreciseUnits(setToken, setQuantity, module, fixture));
}

// Returns notional amount of USDC to transfer in on issue. Handles multiple positions, long and short.
export async function calculateUSDCTransferInPreciseUnits(
  setToken: SetToken,
  setQuantity: BigNumber,
  module: PerpV2LeverageModuleV2 | PerpV2BasisTradingModule,
  fixture: PerpV2Fixture,
  includeFunding: boolean = true
) {
  const accountInfo = await module.getAccountInfo(setToken.address);
  let totalCollateralValue = accountInfo.collateralBalance
    .add(accountInfo.owedRealizedPnl)
    .add(accountInfo.netQuoteBalance);

  if (includeFunding) {
    totalCollateralValue = totalCollateralValue.add(accountInfo.pendingFundingPayments);
  }

  const totalSupply = await setToken.totalSupply();
  let usdcAmountIn = preciseMul(
    preciseDiv(totalCollateralValue, totalSupply),
    setQuantity
  );

  const allPositionInfo = await module.getPositionUnitInfo(setToken.address);

  for (const positionInfo of allPositionInfo) {
    const baseTradeQuantityNotional = preciseMul(positionInfo.baseUnit, setQuantity);
    const isLong = (baseTradeQuantityNotional.gte(ZERO));

    const { deltaQuote } = await fixture.getSwapQuote(
      positionInfo.baseToken,
      baseTradeQuantityNotional.abs(),
      isLong
    );

    const idealQuote = preciseMul(baseTradeQuantityNotional, await fixture.getSpotPrice(positionInfo.baseToken));

    const expectedSlippage = isLong
      ? deltaQuote.sub(idealQuote)
      : idealQuote.abs().sub(deltaQuote);

    usdcAmountIn = usdcAmountIn.add(idealQuote).add(expectedSlippage);
  }

  // return toUSDCDecimals(usdcAmountIn);
  return usdcAmountIn;
}

// Returns notional amount of USDC to transfer on redeem. Handles multiple positions, long and short
// Returned value is converted to USDC decimals.
export async function calculateUSDCTransferOut(
  setToken: SetToken,
  setQuantity: BigNumber,
  module: PerpV2LeverageModuleV2 | PerpV2BasisTradingModule,
  fixture: PerpV2Fixture,
) {
  return toUSDCDecimals(await calculateUSDCTransferOutPreciseUnits(setToken, setQuantity, module, fixture));
}

// Returns notional amount of USDC to transfer on redeem. Handles multiple positions, long and short
export async function calculateUSDCTransferOutPreciseUnits(
  setToken: SetToken,
  setQuantity: BigNumber,
  module: PerpV2LeverageModuleV2 | PerpV2BasisTradingModule,
  fixture: PerpV2Fixture,
  includeFunding: boolean = true
) {
  let totalRealizedPnl = BigNumber.from(0);

  const allPositionInfo = await module.getPositionNotionalInfo(setToken.address);
  const accountInfo = await module.getAccountInfo(setToken.address);
  let totalCollateralBalance = accountInfo.collateralBalance.add(accountInfo.owedRealizedPnl);

  if(includeFunding) {
    totalCollateralBalance = totalCollateralBalance.add(accountInfo.pendingFundingPayments);
  }

  const collateralPositionUnit = preciseDiv(totalCollateralBalance, await setToken.totalSupply());
  const collateralQuantityNotional = preciseMul(collateralPositionUnit, setQuantity);


  for (const positionInfo of allPositionInfo) {
    const basePositionUnit = preciseDiv(positionInfo.baseBalance, await setToken.totalSupply());
    const baseTradeQuantityNotional = preciseMul(basePositionUnit, setQuantity);
    const isLong = (basePositionUnit.gte(ZERO));

    const closeRatio = preciseDiv(baseTradeQuantityNotional.abs(), positionInfo.baseBalance.abs());
    const reducedOpenNotional = preciseMul(positionInfo.quoteBalance, closeRatio);

    const { deltaQuote } = await fixture.getSwapQuote(
      positionInfo.baseToken,
      baseTradeQuantityNotional.abs(),
      !isLong
    );

    const realizedPnl = (isLong)
      ? reducedOpenNotional.add(deltaQuote)
      : reducedOpenNotional.sub(deltaQuote);

    totalRealizedPnl = totalRealizedPnl.add(realizedPnl);
  }

  return collateralQuantityNotional.add(totalRealizedPnl).abs();
}


export async function calculateExternalPositionUnit(
  setToken: SetToken,
  fixture: PerpV2Fixture,
  module: PerpV2LeverageModuleV2 | PerpV2BasisTradingModule
): Promise<BigNumber> {
  const accountInfo = await module.getAccountInfo(setToken.address);
  return toUSDCDecimals(preciseDiv(accountInfo.collateralBalance, await setToken.totalSupply()));
}

// On every interaction with perpV2, it settles funding for a trader into owed realized pnl
// This function returns total funding growth for Set after the last settlement (in USDC units)
export async function getUSDCDeltaDueToFundingGrowth(
  setToken: SetToken,
  setQuantity: BigNumber,
  baseToken: Address,
  baseBalance: BigNumber,
  fixture: PerpV2Fixture
): Promise<BigNumber> {

  const netFundingGrowth = await getNetFundingGrowth(baseToken, baseBalance, fixture);

  const totalSupply = await setToken.totalSupply();
  const usdcAmountDelta = preciseMul(
    preciseDiv(netFundingGrowth, totalSupply),   // totalExtraAccruedFunding Unit
    setQuantity
  );

  return usdcAmountDelta;
}

export async function getNetFundingGrowth(
  baseToken: Address,
  baseBalance: BigNumber,
  fixture: PerpV2Fixture
): Promise<BigNumber> {

  // Note: getFundingGrowthGlobalAndTwaps was removed in PerpV2 v0.15.0 and is only available for
  // TS testing use with a custom Exchange.sol artifact generated by modifying the Perp source slightly.
  // See set-protocol-v2/pull/179 for an example of how to do this if updating Perp artifacts
  const [fundingGrowthGlobal, markTwap, indexTwap] = await fixture.exchange.getFundingGrowthGlobalAndTwaps(baseToken);

  // twPremium = (markTwp - indexTwap) * (now - lastSettledTimestamp)
  const twPremium = fundingGrowthGlobal.twPremiumX96
    .mul(ether(1))
    .div(TWO.pow(BigNumber.from(96)));

  const fundingGrowth = preciseMul(
    baseBalance,
    twPremium.div(ONE_DAY_IN_SECONDS)
  ).abs();

  const isLong = baseBalance.gt(ZERO);

  let netFundingGrowth;
  if (markTwap.lt(indexTwap)) {
    // spot price < oracle price
    // if long: funding growth leads to increase in value of set
    // if short: funding growth decrease set value
    netFundingGrowth = isLong
      ? fundingGrowth
      : fundingGrowth.mul(-1);
  } else {
    // spot price > oracle price
    // if long: funding growth decrease set value
    // if short: funding growth leads to increase in value of set
    netFundingGrowth = isLong
      ? fundingGrowth.mul(-1)
      : fundingGrowth;
  }

  return netFundingGrowth;
}

export async function calculateLeverageRatios(
  setToken: Address,
  perpModule: PerpV2LeverageModuleV2 | PerpV2BasisTradingModule,
  fixture: PerpV2Fixture,
): Promise<[Address[], BigNumber[]]> {
  const accountInfo = await perpModule.getAccountInfo(setToken);
  const notionalPositionInfo = await perpModule.getPositionNotionalInfo(setToken);

  const totalCollateralValue = accountInfo.collateralBalance
    .add(accountInfo.owedRealizedPnl)
    .add(accountInfo.pendingFundingPayments);

  const vTokens: Address[] = [];
  const leverageRatios: BigNumber[] = [];
  for (const positionInfo of notionalPositionInfo) {
    const vTokenInstance = await fixture.getVTokenInstance(positionInfo.baseToken);
    const tokenPrice = await vTokenInstance.getIndexPrice(ZERO);
    const positionValue = preciseMul(tokenPrice, positionInfo.baseBalance);
    const accountValue = positionValue.add(totalCollateralValue).add(positionInfo.quoteBalance);

    vTokens.push(vTokenInstance.address);
    leverageRatios.push(preciseDiv(positionValue, accountValue));
  }

  return [vTokens, leverageRatios];
}

export async function calculateMaxIssueQuantity(
  setToken: SetToken,
  slippage: BigNumber,
  perpModule: PerpV2LeverageModuleV2,
  fixture: PerpV2Fixture,
): Promise<BigNumber> {
  const totalSupply = await setToken.totalSupply();
  const imRatio = await fixture.clearingHouseConfig.getImRatio();
  const accountInfo = await perpModule.getAccountInfo(setToken.address);

  const [, unrealizedPnl ] = await fixture.accountBalance.getPnlAndPendingFee(setToken.address);
  const totalDebtValue = await fixture.accountBalance.getTotalDebtValue(setToken.address);

  const totalCollateralValue = accountInfo.collateralBalance.add(accountInfo.owedRealizedPnl).add(accountInfo.pendingFundingPayments);

  let availableDebt;
  if (unrealizedPnl.gte(ZERO)) {
    availableDebt = totalCollateralValue.mul(10 ** 6).div(imRatio).sub(totalDebtValue);
  } else {
    availableDebt = totalCollateralValue.add(unrealizedPnl).mul(10 ** 6).div(imRatio).sub(totalDebtValue);
  }

  const availableDebtWithSlippage = availableDebt.sub(preciseMul(availableDebt, slippage).mul(10 ** 6).div(imRatio));
  const totalAbsPositionValue = await fixture.accountBalance.getTotalAbsPositionValue(setToken.address);

  return preciseMul(preciseDiv(availableDebtWithSlippage, totalAbsPositionValue), totalSupply);
}