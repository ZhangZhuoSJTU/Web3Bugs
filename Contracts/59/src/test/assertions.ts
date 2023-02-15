import { utils, BigNumber } from "ethers";

declare global {
  export namespace Chai {
    interface Assertion {
      near(actual: BigNumber, distance?: number): void;
      withinPercent(actual: BigNumber, percent?: number): void;
    }
  }
}

export const DEFAULT_EPSILON = 10000;

function max(x: BigNumber, y: BigNumber): BigNumber {
  if (x.gte(y)) {
    return x;
  } else {
    return y;
  }
}

export function near(chai: Chai.ChaiStatic): void {
  const Assertion = chai.Assertion;

  Assertion.addMethod("near", function (
    actual: BigNumber,
    distance: number = DEFAULT_EPSILON
  ): void {
    const expected = <BigNumber>this._obj;
    const delta: BigNumber = expected.sub(actual).abs();

    const epsilon = BigNumber.from(distance);

    this.assert(
      delta.lte(epsilon),
      `expected ${expected.toString()} to be near ${actual.toString()}`,
      `expected ${expected.toString()} to not be near ${actual.toString()}`,
      expected,
      actual,
    );
  });
}

export function withinPercent(chai: Chai.ChaiStatic): void {
  const Assertion = chai.Assertion;

  Assertion.addMethod("withinPercent", function (
    actual: BigNumber,
    percent: number = 0.01
  ): void {
    const expected = <BigNumber>this._obj;
    const delta: BigNumber = expected.sub(actual).abs();

    const BASE = 10000;
    const percentage = Math.floor(percent * BASE);
    const epsilon = expected.mul(percentage).div(BASE);

    this.assert(
      delta.lte(epsilon),
      `expected ${expected.toString()} to be within ${percent * 100}% of ${actual.toString()}`,
      `expected ${expected.toString()} to not be within ${percent * 100}% of ${actual.toString()}`,
      expected,
      actual,
    );
  });
}
