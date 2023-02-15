import { BigNumber } from "ethers";
import { Address } from "../types";
import { preciseMul, preciseMulCeil, preciseDiv, preciseDivCeil } from "./mathUtils";
import { PRECISE_UNIT } from "../constants";
import { SetToken, ISetValuer } from "../contracts";

export const getExpectedIssuePositionMultiplier = (
  previousPositionMultiplier: BigNumber,
  previousSupply: BigNumber,
  currentSupply: BigNumber
): BigNumber => {
  // Inflation = (currentSupply - previousSupply) / currentSupply
  const inflation = preciseDivCeil(currentSupply.sub(previousSupply), currentSupply);

  // previousPositionMultiplier * (1 - inflation %)
  return preciseMul(previousPositionMultiplier, PRECISE_UNIT.sub(inflation));
};

export const getExpectedSetTokenIssueQuantity = async(
  setToken: SetToken,
  setValuer: ISetValuer,
  reserveAsset: Address,
  reserveAssetBaseUnits: BigNumber,
  reserveAssetQuantity: BigNumber,
  managerFeePercentage: BigNumber,
  protocolDirectFeePercentage: BigNumber,
  premiumPercentage: BigNumber
): Promise<BigNumber> => {
  const setTokenValuation = await setValuer.calculateSetTokenValuation(setToken.address, reserveAsset);
  const setTokenSupply = await setToken.totalSupply();

  const reserveQuantitySubFees = getExpectedPostFeeQuantity(
    reserveAssetQuantity,
    managerFeePercentage,
    protocolDirectFeePercentage
  );

  const reserveQuantitySubFeesAndPremium = reserveQuantitySubFees.sub(
    preciseMul(reserveQuantitySubFees, premiumPercentage)
  );

  const normalizedReserveQuantitySubFees = preciseDiv(reserveQuantitySubFees, reserveAssetBaseUnits);
  const normalizedReserveQuantitySubFeesAndPremium = preciseDiv(reserveQuantitySubFeesAndPremium, reserveAssetBaseUnits);

  const denominator = preciseMul(setTokenSupply, setTokenValuation)
    .add(normalizedReserveQuantitySubFees)
    .sub(normalizedReserveQuantitySubFeesAndPremium);

  return preciseDiv(preciseMul(normalizedReserveQuantitySubFeesAndPremium, setTokenSupply), denominator);
};

export const getExpectedIssuePositionUnit = (
  previousUnits: BigNumber,
  issueQuantity: BigNumber,
  previousSupply: BigNumber,
  currentSupply: BigNumber,
  newPositionMultiplier: BigNumber,
  managerFeePercentage: BigNumber,
  protocolDirectFeePercentage: BigNumber
): BigNumber => {
  // Account for fees
  const issueQuantitySubFees = getExpectedPostFeeQuantity(
    issueQuantity,
    managerFeePercentage,
    protocolDirectFeePercentage
  );

  // (Previous supply * previous units + issueQuantitySubFees) / current supply
  const numerator = preciseMul(previousSupply, previousUnits).add(issueQuantitySubFees);
  const newPositionUnit = preciseDiv(numerator, currentSupply);

  // Adjust for rounding on the contracts when converting between real and virtual units
  const roundDownPositionUnit = preciseMul(newPositionUnit, newPositionMultiplier);
  return preciseDiv(roundDownPositionUnit, newPositionMultiplier);
};

export const getExpectedPostFeeQuantity = (
  quantity: BigNumber,
  managerFeePercentage: BigNumber,
  protocolDirectFeePercentage: BigNumber,
): BigNumber => {
  const managerFees = preciseMul(quantity, managerFeePercentage);
  const protocolDirectFees = preciseMul(quantity, protocolDirectFeePercentage);

  return quantity.sub(managerFees).sub(protocolDirectFees);
};

export const getExpectedReserveRedeemQuantity = (
  setTokenQuantityToRedeem: BigNumber,
  setTokenValuation: BigNumber,
  reserveAssetBaseUnits: BigNumber,
  managerFeePercentage: BigNumber,
  protocolDirectFeePercentage: BigNumber,
  premiumPercentage: BigNumber
): BigNumber => {
  const totalNotionalReserveQuantity = preciseMul(setTokenValuation, setTokenQuantityToRedeem);

  const totalPremium = preciseMulCeil(totalNotionalReserveQuantity, premiumPercentage);

  const totalNotionalReserveQuantitySubFees = getExpectedPostFeeQuantity(
    totalNotionalReserveQuantity.sub(totalPremium),
    managerFeePercentage,
    protocolDirectFeePercentage
  );

  return preciseMul(totalNotionalReserveQuantitySubFees, reserveAssetBaseUnits);
};

export const getExpectedRedeemPositionMultiplier = (
  previousPositionMultiplier: BigNumber,
  previousSupply: BigNumber,
  currentSupply: BigNumber
): BigNumber => {
  // Inflation = (previousSupply - currentSupply) / currentSupply
  const deflation = preciseDiv(previousSupply.sub(currentSupply), currentSupply);

  // previousPositionMultiplier * (1 + deflation %)
  return preciseMul(previousPositionMultiplier, PRECISE_UNIT.add(deflation));
};

export const getExpectedRedeemPositionUnit = (
  previousUnits: BigNumber,
  setTokenQuantityToRedeem: BigNumber,
  setTokenValuation: BigNumber,
  reserveAssetBaseUnits: BigNumber,
  previousSupply: BigNumber,
  currentSupply: BigNumber,
  newPositionMultiplier: BigNumber,
  managerFeePercentage: BigNumber,
  protocolDirectFeePercentage: BigNumber,
  premiumPercentage: BigNumber,
): BigNumber => {
  const totalNotionalReserveQuantity = preciseMul(setTokenValuation, setTokenQuantityToRedeem);

  const totalPremium = preciseMulCeil(totalNotionalReserveQuantity, premiumPercentage);

  const totalReserveBalance = preciseMul(totalNotionalReserveQuantity.sub(totalPremium), reserveAssetBaseUnits);

  // (Previous supply * previous units - reserveQuantityToRedeem) / current supply
  const numerator = preciseMul(previousSupply, previousUnits).sub(totalReserveBalance);
  const newPositionUnit = preciseDiv(numerator, currentSupply);
  // Adjust for rounding on the contracts when converting between real and virtual units
  const roundDownPositionUnit = preciseMul(newPositionUnit, newPositionMultiplier);
  return preciseDiv(roundDownPositionUnit, newPositionMultiplier);
};
