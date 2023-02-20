// Barely enough for an obvious implementation of exp/expm1..

import { BigNumber, BigNumberish } from "ethers";

type BigRationalish = BigRational | BigNumberish;

const _guard = {};

const _gcd = (m, n) => n == 0 ? m : _gcd(n, m % n);
const gcd = (m, n) => {
  const _m = m < 0 ? -m : m;
  const _n = n < 0 ? -n : n;
  return _m < _n ? _gcd(_n, _m) : _gcd(_m, _n);
};

export class BigRational {
  n: bigint;
  d: bigint;

  constructor(n: bigint, d: bigint, normalize: boolean = true) {
    if (normalize) {
      const g = gcd(n, d);
      const s = (d < 0 ? -1n : 1n);
      this.n = s * n / g;
      this.d = s * d / g;
    } else {
      this.n = n;
      this.d = d;
    }
  }

  add(y: BigRationalish) {
    const r = BigRational.from(y);
    return new BigRational(this.n * r.d + r.n * this.d, this.d * r.d);
  }

  mul(y: BigRationalish) {
    const r = BigRational.from(y);
    return new BigRational(this.n * r.n, this.d * r.d);
  }

  div(y: BigRationalish) {
    const r = BigRational.from(y);
    return new BigRational(this.n * r.d, this.d * r.n);
  }

  pow(p: BigNumberish) {
    const bp = BigNumber.from(p).toBigInt();
    if (p >= 0) {
      return new BigRational(this.n ** bp, this.d ** bp, false);
    } else {
      const s = this.n < 0 ? -1n : 1n;
      return new BigRational(s * this.d ** -bp, s * this.n ** -bp, false);
    }
  }

  lt(y: BigRationalish) {
    const r = BigRational.from(y);
    return this.n * r.d < r.n * this.d;
  }

  neg() {
    return new BigRational(-this.n, this.d, false);
  }

  floor(): BigNumber {
    return BigNumber.from(this.n / this.d);
  }

  ceil(): BigNumber {
    return BigNumber.from((this.n + this.d - 1n) / this.d);
  }

  static from(x: BigRationalish, y: BigNumberish = 1n) {
    return x instanceof BigRational ? x :
      new BigRational(
        BigNumber.from(x).toBigInt(),
        BigNumber.from(y).toBigInt()
      );
  }
}

const factorial = (n: number) => {
  let res = 1n;
  let c = 1n;
  for (let i = 2; i <= n; i++) { res *= ++c; }
  return res;
};

export function expApprox(x: BigRational, n: number) {
  let res = BigRational.from(1);
  for (let k = 1; k <= n; k++) {
    res = res.add(x.pow(k).div(factorial(k)));
  }
  return res;
};
