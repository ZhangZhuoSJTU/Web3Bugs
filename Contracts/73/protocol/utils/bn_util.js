import BigNumber from "bignumber.js"

export function toSmallestUnits(value, decimals = 18) {
    const bigVal = new BigNumber(value)
    const units = new BigNumber(10).pow(decimals)

    return bigVal.times(units)
}

export function add(...args) {
    return args.reduce((acc, num) => {
        const a = new BigNumber(acc)
        const b = new BigNumber(num)
        return a.plus(b)
    })
}

export function sub(...args) {
    return args.reduce((acc, num) => {
        const a = new BigNumber(acc)
        const b = new BigNumber(num)
        return a.sub(b)
    })
}

export function mul(...args) {
    return args.reduce((acc, num) => {
        const a = new BigNumber(acc)
        const b = new BigNumber(num)
        return a.mul(b)
    })
}

export function div(...args) {
    return args.reduce((acc, num) => {
        const a = new BigNumber(acc)
        const b = new BigNumber(num)
        return a.div(b)
    })
}
