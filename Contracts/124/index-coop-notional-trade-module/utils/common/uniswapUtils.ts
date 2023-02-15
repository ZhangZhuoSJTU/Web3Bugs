import { BigNumber } from "ethers";
import { UniswapV2Pair, SetToken, StakingRewards, StandardTokenMock, WETH9, UniswapV2Router02 } from "../contracts";
import { ZERO } from "../constants";
import { ether, preciseMul } from "../index";
import { preciseDiv } from "./mathUtils";
import { Address } from "../types";

const MINIMUM_LIQUIDITY = BigNumber.from(1000);
export const calculateLPTokensIssued = async(
  pool: UniswapV2Pair,
  amountOne: BigNumber,
  amountTwo: BigNumber,
): Promise<BigNumber> => {
  const reserves = await pool.getReserves();
  const totalSupply = await pool.totalSupply();

  let liquidity;
  if (totalSupply == ZERO) {
    liquidity = sqrt(amountOne.mul(amountTwo)).sub(MINIMUM_LIQUIDITY);
  } else {
    liquidity = min(
      amountOne.mul(totalSupply).div(reserves._reserve0),
      amountTwo.mul(totalSupply).div(reserves._reserve1)
    );
  }

  return liquidity;
};

export const calculateEngageQuantities = async(
  setToken: SetToken,
  assetOne: StandardTokenMock | WETH9,
  assetTwo: StandardTokenMock | WETH9,
  lpToken: UniswapV2Pair,
  stakingRewards: StakingRewards,
  reservePercentage: BigNumber,
  extraAssetOne: BigNumber = ZERO,
  extraAssetTwo: BigNumber = ZERO,
): Promise<[BigNumber, BigNumber]> => {
  const [reserveOne, reserveTwo] = await calculateTokensInReserve(
    setToken,
    assetOne,
    assetTwo,
    lpToken,
    stakingRewards
  );

  const balanceOnTokenAssetOne = (await assetOne.balanceOf(setToken.address)).add(extraAssetOne);
  const balanceOnTokenAssetTwo = (await assetTwo.balanceOf(setToken.address)).add(extraAssetTwo);

  return [
    preciseMul(reserveOne, reservePercentage).sub(preciseMul(balanceOnTokenAssetOne, ether(1).sub(reservePercentage))),
    preciseMul(reserveTwo, reservePercentage).sub(preciseMul(balanceOnTokenAssetTwo, ether(1).sub(reservePercentage))),
  ];
};

export const calculateRebalanceFlows = async(
  setToken: SetToken,
  router: UniswapV2Router02,
  sellTokenQuantity: BigNumber,
  assetOne: StandardTokenMock | WETH9,
  assetTwo: StandardTokenMock | WETH9,
  assetOneToTwoPrice: BigNumber,
  extraAssetOne: BigNumber = ZERO,
  extraAssetTwo: BigNumber = ZERO,
): Promise<BigNumber[]> => {
  const [quantityToSell, assetToSell, assetToBuy] = await calculateRebalanceQuantity(
    sellTokenQuantity,
    setToken,
    assetOne,
    assetTwo,
    assetOneToTwoPrice,
    extraAssetOne,
    extraAssetTwo
  );

  return await router.getAmountsOut(
    quantityToSell,
    [assetToSell, assetToBuy]
  );
};

export const calculateRebalanceQuantity = async(
  sellTokenQuantity: BigNumber,
  setToken: SetToken,
  assetOne: StandardTokenMock | WETH9,
  assetTwo: StandardTokenMock | WETH9,
  assetOneToTwoPrice: BigNumber,
  extraAssetOne: BigNumber = ZERO,
  extraAssetTwo: BigNumber = ZERO,
): Promise<[BigNumber, Address, Address]> => {

  const balanceAssetOne = (await assetOne.balanceOf(setToken.address)).add(extraAssetOne);
  const balanceAssetTwo = (await assetTwo.balanceOf(setToken.address)).add(extraAssetTwo);

  const valueAssetTwoDenomOne = preciseDiv(balanceAssetTwo, assetOneToTwoPrice);

  let quantityToSell: BigNumber;
  let assetToSell: Address;
  let assetToBuy: Address;
  if (balanceAssetOne.gt(valueAssetTwoDenomOne)) {
    quantityToSell = balanceAssetOne.sub(valueAssetTwoDenomOne).div(2);
    assetToSell = assetOne.address;
    assetToBuy = assetTwo.address;
  } else {
    quantityToSell = preciseMul(valueAssetTwoDenomOne.sub(balanceAssetOne).div(2), assetOneToTwoPrice);
    assetToSell = assetTwo.address;
    assetToBuy = assetOne.address;
  }

  if (sellTokenQuantity > ZERO) {
    quantityToSell = sellTokenQuantity;
  }

  return [quantityToSell, assetToSell, assetToBuy];
};

export const calculateTokensInReserve = async(
  setToken: SetToken,
  assetOne: StandardTokenMock | WETH9,
  assetTwo: StandardTokenMock | WETH9,
  lpToken: UniswapV2Pair,
  stakingRewards: StakingRewards,
): Promise<[BigNumber, BigNumber]> => {
  const [reserveOne, reserveTwo] = await getReservesSafe(assetOne.address, assetTwo.address, lpToken);
  const totalSupply = await lpToken.totalSupply();
  const lpTokenBalance = await stakingRewards.balanceOf(setToken.address);

  return [
    preciseMul(preciseDiv(reserveOne, totalSupply), lpTokenBalance),
    preciseMul(preciseDiv(reserveTwo, totalSupply), lpTokenBalance),
  ];
};

export const getReservesSafe = async(
  assetOne: Address,
  assetTwo: Address,
  lpToken: UniswapV2Pair
): Promise<[BigNumber, BigNumber]> => {
  const firstAsset = assetOne < assetTwo ? assetOne : assetTwo;
  const reserves = await lpToken.getReserves();
  return assetOne == firstAsset ? [reserves._reserve0, reserves._reserve1] : [reserves._reserve1, reserves._reserve0];
};

const sqrt = (
  value: BigNumber
): BigNumber => {
  let z: BigNumber = value;
  if (value > BigNumber.from(3)) {
    let x = value.div(2).add(1);
    while (x < z) {
      z = x;
      x = value.div(x).add(x).div(2);
    }
  } else if (value != ZERO) {
    z = BigNumber.from(1);
  }

  return z;
};

export const min = (
  valueOne: BigNumber,
  valueTwo: BigNumber
): BigNumber => {
  return valueOne < valueTwo ? valueOne : valueTwo;
};
