import {
  FEE_STEP,
  MAX_FEE,
  MAX_REWARD,
  STEP_NUMBER_INPUT_STEPS,
  SWAP_FEE_APY_STEP,
} from '../../constants'

type StepNumberInputType = 'APR' | 'APY' | 'Fee'
type ActionVariable = 'plus' | 'minus'

const toBase10 = (value: number): number => value * 100

const findNearestMultipleUpperValue = (value: number, multipleNumber: number): number =>
  multipleNumber * Math.ceil(Math.abs(value / multipleNumber))

const findNearestMultipleLowerValue = (value: number, multipleNumber: number): number =>
  multipleNumber * Math.floor(Math.abs(value / multipleNumber))

/* 
  Returns how many steps should it move depending on the following amounts:
  - > 10% step by 5 steps
  - <= 10% step by 1 step
  - <= 1% step by 0.1% step
*/
const getStepLimit = (value: number, action: ActionVariable): number => {
  const shouldGoByOneStep =
    (value <= STEP_NUMBER_INPUT_STEPS.LIMIT_10 && action === 'minus') ||
    (value < STEP_NUMBER_INPUT_STEPS.LIMIT_10 && action === 'plus')
  const shouldGoByOneDecimalStep =
    (value <= STEP_NUMBER_INPUT_STEPS.LIMIT_1 && action === 'minus') ||
    (value < STEP_NUMBER_INPUT_STEPS.LIMIT_1 && action === 'plus')

  if (shouldGoByOneDecimalStep) {
    return STEP_NUMBER_INPUT_STEPS.DECIMAL_STEP
  }

  if (shouldGoByOneStep) {
    return STEP_NUMBER_INPUT_STEPS.ONE_STEP
  }

  return STEP_NUMBER_INPUT_STEPS.FIVE_STEP
}

const getValueBase10 = (value: number): number => {
  // Hardcode fix to javascript not handling number operations properly
  // 0.07 * 100 = 7.000000000000001
  // Reference: http://adripofjavascript.com/blog/drips/avoiding-problems-with-decimal-math-in-javascript.html
  if (value === 0.07) {
    return 7.0
  }

  if (value > STEP_NUMBER_INPUT_STEPS.LIMIT_1 && value < STEP_NUMBER_INPUT_STEPS.LIMIT_10) {
    return value * 100
  }

  return Math.round(toBase10(value))
}

const getAPRInputStep = (value: number, action: ActionVariable): number => {
  const valueBase10 = getValueBase10(value)
  let preliminaryStep = getStepLimit(value, action)

  const closestMultipleUpper = findNearestMultipleUpperValue(valueBase10, toBase10(preliminaryStep))
  const closestMultipleLower = findNearestMultipleLowerValue(valueBase10, toBase10(preliminaryStep))
  const newPreliminaryStepBase10Plus = closestMultipleUpper - valueBase10
  const newPreliminaryStepBase10Minus = valueBase10 - closestMultipleLower

  if (action === 'plus' && closestMultipleUpper !== valueBase10) {
    preliminaryStep = newPreliminaryStepBase10Plus / 100
  }

  if (action === 'minus' && closestMultipleLower !== valueBase10) {
    preliminaryStep = newPreliminaryStepBase10Minus / 100
  }

  return preliminaryStep
}

export function getCalculationVariables(
  inputType: StepNumberInputType,
  value: number,
  action: ActionVariable
): { MAX: number; STEP: number } {
  const dictionary = {
    APR: {
      MAX: MAX_REWARD,
      STEP: getAPRInputStep(value, action),
    },
    APY: {
      MAX: MAX_REWARD,
      STEP: SWAP_FEE_APY_STEP,
    },
    Fee: {
      MAX: MAX_FEE,
      STEP: FEE_STEP,
    },
  }

  return dictionary[inputType]
}
