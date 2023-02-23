// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity =0.8.7;

/**
 * @title   StableMath
 * @author  mStable
 * @notice  A library providing safe mathematical operations to multiply and
 *          divide with standardised precision.
 * @dev     Derives from OpenZeppelin's SafeMath lib and uses generic system
 *          wide variables for managing precision.
 */
library StableMath {
  /**
   * @dev Scaling unit for use in specific calculations,
   * where 1 * 10**18, or 1e18 represents a unit '1'
   */
  uint256 private constant FULL_SCALE = 1e18;

  /**
   * @dev Token Ratios are used when converting between units of bAsset, mAsset and MTA
   * Reasoning: Takes into account token decimals, and difference in base unit (i.e. grams to Troy oz for gold)
   * bAsset ratio unit for use in exact calculations,
   * where (1 bAsset unit * bAsset.ratio) / ratioScale == x mAsset unit
   */
  uint256 private constant RATIO_SCALE = 1e8;

  /**
   * @dev Provides an interface to the scaling unit
   * @return Scaling unit (1e18 or 1 * 10**18)
   */
  function getFullScale() internal pure returns (uint256) {
    return FULL_SCALE;
  }

  /**
   * @dev Provides an interface to the ratio unit
   * @return Ratio scale unit (1e8 or 1 * 10**8)
   */
  function getRatioScale() internal pure returns (uint256) {
    return RATIO_SCALE;
  }

  /**
   * @dev Scales a given integer to the power of the full scale.
   * @param x   Simple uint256 to scale
   * @return    Scaled value a to an exact number
   */
  function scaleInteger(uint256 x) internal pure returns (uint256) {
    return x * FULL_SCALE;
  }

  /***************************************
              PRECISE ARITHMETIC
    ****************************************/

  /**
   * @dev Multiplies two precise units, and then truncates by the full scale
   * @param x     Left hand input to multiplication
   * @param y     Right hand input to multiplication
   * @return      Result after multiplying the two inputs and then dividing by the shared
   *              scale unit
   */
  function mulTruncate(uint256 x, uint256 y) internal pure returns (uint256) {
    return mulTruncateScale(x, y, FULL_SCALE);
  }

  /**
   * @dev Multiplies two precise units, and then truncates by the given scale. For example,
   * when calculating 90% of 10e18, (10e18 * 9e17) / 1e18 = (9e36) / 1e18 = 9e18
   * @param x     Left hand input to multiplication
   * @param y     Right hand input to multiplication
   * @param scale Scale unit
   * @return      Result after multiplying the two inputs and then dividing by the shared
   *              scale unit
   */
  function mulTruncateScale(
    uint256 x,
    uint256 y,
    uint256 scale
  ) internal pure returns (uint256) {
    // e.g. assume scale = fullScale
    // z = 10e18 * 9e17 = 9e36
    // return 9e36 / 1e18 = 9e18
    return (x * y) / scale;
  }

  /**
   * @dev Multiplies two precise units, and then truncates by the full scale, rounding up the result
   * @param x     Left hand input to multiplication
   * @param y     Right hand input to multiplication
   * @return      Result after multiplying the two inputs and then dividing by the shared
   *              scale unit, rounded up to the closest base unit.
   */
  function mulTruncateCeil(uint256 x, uint256 y)
    internal
    pure
    returns (uint256)
  {
    // e.g. 8e17 * 17268172638 = 138145381104e17
    uint256 scaled = x * y;
    // e.g. 138145381104e17 + 9.99...e17 = 138145381113.99...e17
    uint256 ceil = scaled + FULL_SCALE - 1;
    // e.g. 13814538111.399...e18 / 1e18 = 13814538111
    return ceil / FULL_SCALE;
  }

  /**
   * @dev Precisely divides two units, by first scaling the left hand operand. Useful
   *      for finding percentage weightings, i.e. 8e18/10e18 = 80% (or 8e17)
   * @param x     Left hand input to division
   * @param y     Right hand input to division
   * @return      Result after multiplying the left operand by the scale, and
   *              executing the division on the right hand input.
   */
  function divPrecisely(uint256 x, uint256 y) internal pure returns (uint256) {
    // e.g. 8e18 * 1e18 = 8e36
    // e.g. 8e36 / 10e18 = 8e17
    return (x * FULL_SCALE) / y;
  }

  /***************************************
                  RATIO FUNCS
    ****************************************/

  /**
   * @dev Multiplies and truncates a token ratio, essentially flooring the result
   *      i.e. How much mAsset is this bAsset worth?
   * @param x     Left hand operand to multiplication (i.e Exact quantity)
   * @param ratio bAsset ratio
   * @return c    Result after multiplying the two inputs and then dividing by the ratio scale
   */
  function mulRatioTruncate(uint256 x, uint256 ratio)
    internal
    pure
    returns (uint256 c)
  {
    return mulTruncateScale(x, ratio, RATIO_SCALE);
  }

  /**
   * @dev Multiplies and truncates a token ratio, rounding up the result
   *      i.e. How much mAsset is this bAsset worth?
   * @param x     Left hand input to multiplication (i.e Exact quantity)
   * @param ratio bAsset ratio
   * @return      Result after multiplying the two inputs and then dividing by the shared
   *              ratio scale, rounded up to the closest base unit.
   */
  function mulRatioTruncateCeil(uint256 x, uint256 ratio)
    internal
    pure
    returns (uint256)
  {
    // e.g. How much mAsset should I burn for this bAsset (x)?
    // 1e18 * 1e8 = 1e26
    uint256 scaled = x * ratio;
    // 1e26 + 9.99e7 = 100..00.999e8
    uint256 ceil = scaled + RATIO_SCALE - 1;
    // return 100..00.999e8 / 1e8 = 1e18
    return ceil / RATIO_SCALE;
  }

  /**
   * @dev Precisely divides two ratioed units, by first scaling the left hand operand
   *      i.e. How much bAsset is this mAsset worth?
   * @param x     Left hand operand in division
   * @param ratio bAsset ratio
   * @return c    Result after multiplying the left operand by the scale, and
   *              executing the division on the right hand input.
   */
  function divRatioPrecisely(uint256 x, uint256 ratio)
    internal
    pure
    returns (uint256 c)
  {
    // e.g. 1e14 * 1e8 = 1e22
    // return 1e22 / 1e12 = 1e10
    return (x * RATIO_SCALE) / ratio;
  }

  /***************************************
                    HELPERS
    ****************************************/

  /**
   * @dev Calculates minimum of two numbers
   * @param x     Left hand input
   * @param y     Right hand input
   * @return      Minimum of the two inputs
   */
  function min(uint256 x, uint256 y) internal pure returns (uint256) {
    return x > y ? y : x;
  }

  /**
   * @dev Calculated maximum of two numbers
   * @param x     Left hand input
   * @param y     Right hand input
   * @return      Maximum of the two inputs
   */
  function max(uint256 x, uint256 y) internal pure returns (uint256) {
    return x > y ? x : y;
  }

  /**
   * @dev Clamps a value to an upper bound
   * @param x           Left hand input
   * @param upperBound  Maximum possible value to return
   * @return            Input x clamped to a maximum value, upperBound
   */
  function clamp(uint256 x, uint256 upperBound)
    internal
    pure
    returns (uint256)
  {
    return x > upperBound ? upperBound : x;
  }
}
