import { BigNumber as BN } from "ethers";
import { DEFAULT_DECIMALS } from "./constants";

export { BN };

// Converts an unscaled number to scaled number with the specified number of decimals
// eg convert 3 to 3000000000000000000 with 18 decimals
export const simpleToExactAmount = (amount: number | string | BN, decimals: number | BN = DEFAULT_DECIMALS): BN => {
    // Code is largely lifted from the guts of web3 toWei here:
    // https://github.com/ethjs/ethjs-unit/blob/master/src/index.js
    let amountString = amount.toString();
    const decimalsBN = BN.from(decimals);

    if (decimalsBN.gt(100)) {
        throw new Error(`Invalid decimals amount`);
    }

    const scale = BN.from(10).pow(decimals);
    const scaleString = scale.toString();

    // Is it negative?
    const negative = amountString.substring(0, 1) === "-";
    if (negative) {
        amountString = amountString.substring(1);
    }

    if (amountString === ".") {
        throw new Error(`Error converting number ${amountString} to precise unit, invalid value`);
    }

    // Split it into a whole and fractional part
    // eslint-disable-next-line prefer-const
    let [whole, fraction, ...rest] = amountString.split(".");
    if (rest.length > 0) {
        throw new Error(`Error converting number ${amountString} to precise unit, too many decimal points`);
    }

    if (!whole) {
        whole = "0";
    }
    if (!fraction) {
        fraction = "0";
    }

    if (fraction.length > scaleString.length - 1) {
        throw new Error(`Error converting number ${amountString} to precise unit, too many decimal places`);
    }

    while (fraction.length < scaleString.length - 1) {
        fraction += "0";
    }

    const wholeBN = BN.from(whole);
    const fractionBN = BN.from(fraction);
    let result = wholeBN.mul(scale).add(fractionBN);

    if (negative) {
        result = result.mul("-1");
    }

    return result;
};

export const percentToWeight = (percent: number | string | BN): BN => simpleToExactAmount(percent, 16);

// Returns the smaller number
export const minimum = (a: BN, b: BN): BN => (a.lte(b) ? a : b);

// Returns the bigger number
export const maximum = (a: BN, b: BN): BN => (a.gte(b) ? a : b);

// Returns the square root of a big number, solution taken from https://github.com/ethers-io/ethers.js/issues/1182#issuecomment-744142921
export const sqrt = (value: BN | number): BN => {
    const x = BN.from(value);
    let z = x.add(1).div(2);
    let y = x;
    while (z.sub(y).isNegative()) {
        y = z;
        z = x.div(z).add(z).div(2);
    }
    return y;
};

export const sum = (a: BN, b: BN): BN => a.add(b);
