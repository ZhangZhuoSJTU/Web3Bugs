import { assert } from "chai";
import { BN, simpleToExactAmount } from "./math";
import { fullScale } from "./constants";

/**
 *  Convenience method to assert that two BN.js instances are within 100 units of each other.
 *  @param actual The BN.js instance you received
 *  @param expected The BN.js amount you expected to receive, allowing a varience of +/- 10 units
 */
export const assertBNClose = (
    actual: BN | string,
    expected: BN,
    variance: BN | number = BN.from(10),
    reason: string = null,
): void => {
    const actualBN = BN.from(actual);
    const actualDelta = actualBN.gt(expected) ? actualBN.sub(expected) : expected.sub(actualBN);

    const str = reason ? `\n\tReason: ${reason}\n\t${actualBN.toString()} vs ${expected.toString()}` : "";
    assert.ok(
        actualBN.gte(expected.sub(variance)),
        `Number is too small to be close (Delta between actual and expected is ${actualDelta.toString()}, but variance was only ${variance.toString()}${str}`,
    );
    assert.ok(
        actualBN.lte(expected.add(variance)),
        `Number is too large to be close (Delta between actual and expected is ${actualDelta.toString()}, but variance was only ${variance.toString()})${str}`,
    );
};

/**
 *  Convenience method to assert that two BN.js instances are within 100 units of each other.
 *  @param actual The BN.js instance you received
 *  @param expected The BN.js amount you expected to receive, allowing a varience of +/- 10 units
 */
export const assertBNClosePercent = (a: BN, b: BN, variance: string | number = "0.02", reason: string = null): void => {
    if (a.eq(b)) return;
    const varianceBN = simpleToExactAmount(variance.toString().substr(0, 6), 16);
    const diff = a.sub(b).abs().mul(2).mul(fullScale).div(a.add(b));
    const str = reason ? `\n\tReason: ${reason}\n\t${a.toString()} vs ${b.toString()}` : "";
    assert.ok(
        diff.lte(varianceBN),
        `Numbers exceed ${variance}% diff (Delta between a and b is ${diff.toString()}%, but variance was only ${varianceBN.toString()})${str}`,
    );
};

/**
 *  Convenience method to assert that one BN.js instance is GTE the other
 *  @param actual The BN.js instance you received
 *  @param expected The operant to compare against
 */
export const assertBnGte = (actual: BN, comparison: BN): void => {
    assert.ok(
        actual.gte(comparison),
        `Number must be GTE comparitor, got: ${actual.toString()}; comparitor: ${comparison.toString()}`,
    );
};

/**
 *  Convenience method to assert that one BN.js number is eq to, or greater than an expected value by some small amount
 *  @param actual The BN.js instance you received
 *  @param equator The BN.js to equate to
 *  @param maxActualShouldExceedExpected Upper limit for the growth
 *  @param mustBeGreater Fail if the operands are equal
 */
export const assertBNSlightlyGT = (
    actual: BN,
    equator: BN,
    maxActualShouldExceedExpected = BN.from(100),
    mustBeGreater = false,
    reason: string = null,
): void => {
    const actualDelta = actual.gt(equator) ? actual.sub(equator) : equator.sub(actual);

    const str = reason ? `\n\t${reason}\n\t${actual.toString()} vs ${equator.toString()}` : "";

    assert.ok(
        mustBeGreater ? actual.gt(equator) : actual.gte(equator),
        `Actual value should be greater than the expected value ${str}`,
    );
    assert.ok(
        actual.lte(equator.add(maxActualShouldExceedExpected)),
        `Actual value should not exceed ${maxActualShouldExceedExpected.toString()} units greater than expected. Variance was ${actualDelta.toString()} ${str}`,
    );
};

/**
 *  Convenience method to assert that one BN.js number is eq to, or greater than an expected value by some small amount
 *  @param actual The BN.js instance you received
 *  @param equator The BN.js to equate to
 *  @param maxActualShouldExceedExpected Percentage amount of increase, as a string (1% = 1)
 *  @param mustBeGreater Fail if the operands are equal
 */
export const assertBNSlightlyGTPercent = (
    actual: BN,
    equator: BN,
    maxPercentIncrease = "0.1",
    mustBeGreater = false,
): void => {
    const maxIncreaseBN = simpleToExactAmount(maxPercentIncrease, 16);
    const maxIncreaseUnits = equator.mul(maxIncreaseBN).div(fullScale);
    // const actualDelta = actual.gt(equator) ? actual.sub(equator) : equator.sub(actual);

    assert.ok(
        mustBeGreater ? actual.gt(equator) : actual.gte(equator),
        `Actual value should be greater than the expected value`,
    );
    assert.ok(
        actual.lte(equator.add(maxIncreaseUnits)),
        `Actual value should not exceed ${maxPercentIncrease}% greater than expected`,
    );
};
