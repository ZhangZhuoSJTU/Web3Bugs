import { mulDiv, now, min, shiftRightUp, mulDivUp, advanceTimeAndBlock, setTime, divUp } from '../shared/Helper'

const MAXUINT112 = 2 ** 112
const MAXUINT256 = 2 ** 256




export const getNewLiquidityParams = (
  assetIn: bigint,
  debtIn: bigint,
  collateralIn: bigint,
  currentTime: bigint,
  maturity: bigint
) => {
const xIncrease = assetIn

const duration = maturity - currentTime


let yIncrease = debtIn
yIncrease -=assetIn
yIncrease <<=32n
yIncrease /= duration
if(yIncrease >= MAXUINT256 || yIncrease <=0) return false

let zIncrease = collateralIn
zIncrease <<=25n
let denominator = duration
denominator += 0x2000000n
zIncrease /= denominator

if(yIncrease >= MAXUINT256 || yIncrease <=0) return false
  return { xIncreaseNewLiquidity: xIncrease,yIncreaseNewLiquidity: yIncrease, zIncreaseNewLiquidity: zIncrease }
}

export const getAddLiquidityGivenAssetParams = (state: { x: bigint; y: bigint; z: bigint }, assetIn: bigint, feeStored: bigint) => {
  const xIncrease = assetIn*state.x/(state.x+feeStored)
  const yIncrease = (state.y * assetIn) / state.x
  const zIncrease = (state.z * assetIn) / state.x

  return { xIncreaseAddLiqudity: xIncrease,yIncreaseAddLiquidity: yIncrease, zIncreaseAddLiquidity: zIncrease }
} 
export const getAddLiquidityGivenCollateralParams = (state: { x: bigint; y: bigint; z: bigint }, collateralIn: bigint,maturity:bigint,currentTime:bigint) => {
  const zIncrease = (collateralIn <<25n)/((maturity-currentTime)+BigInt(0x2000000))
  const xIncrease = divUp(state.x*zIncrease,state.z)
  const yIncrease = state.y*zIncrease/state.z
  return {xIncreaseAddLiquidity:xIncrease, yIncreaseAddLiquidity: yIncrease, zIncreaseAddLiquidity: zIncrease }
}
export const getIncreaseAddLiquidityGivenDebtParams = (state: { x: bigint; y: bigint; z: bigint }, debtIn: bigint,maturity,currentTime) => {
  const yIncrease = (debtIn * state.y <<32n)/((BigInt(maturity-currentTime)*state.y)+(state.x<<32n))
  const xIncrease = divUp(state.x*yIncrease,state.y)
  const zIncrease = state.z*yIncrease/state.y

  return { xIncreaseAddLiquidity: xIncrease,yIncreaseAddLiquidity: yIncrease, zIncreaseAddLiquidity: zIncrease }
}




export const getDebtAddLiquidity = (
  delState: { x: bigint; y: bigint; z: bigint },
  maturity: bigint,
  currentTime: bigint
) => {
  return shiftRightUp((maturity - currentTime) * delState.y, 32n) + delState.x
}

export const getCollateralAddLiquidity = (
  delState: { x: bigint; y: bigint; z: bigint },
  maturity: bigint,
  currentTime: bigint
) => {
  return shiftRightUp(((maturity - currentTime)  * delState.z), 25n) + delState.z
}
export const getInitialLiquidity = (xIncrease: bigint) => {
  return xIncrease << 16n
}

export const getLiquidity = (
  state: { x: bigint; y: bigint; z: bigint },
  mintParams: { x: bigint; y: bigint; z: bigint },
  currentTime: bigint,
  maturity: bigint
) => {
  const initialTotalLiquidity = (state.x<<16n)

  const fromX =  mulDiv(initialTotalLiquidity, mintParams.x, state.x)
  const fromY =  mulDiv(initialTotalLiquidity, mintParams.y, state.y)
  const fromZ =  mulDiv(initialTotalLiquidity, mintParams.z, state.z)
  
  console.log('TS',fromX,fromY,fromZ)
  if(fromX>= fromY || fromX >= fromZ){
    return 'E215/E214'
  }
  else return fromY <= fromZ ? fromY : fromZ
}