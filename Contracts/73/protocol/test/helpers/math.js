import {constants} from "../../utils/constants"
import {BigNumber} from "ethers"
// Returns a / b scaled by PERC_DIVISOR
// See percPoints() in contracts/libraries/MathUtils.sol
const percPoints = (a, b) => {
    return _percPoints(a, b, BigNumber.from(constants.PERC_DIVISOR))
}

// Returns a * (b / c) scaled by PERC_DIVISOR
// See percOf() in contracts/libraries/MathUtils.sol
const percOf = (a, b, c) => {
    return _percOf(a, b, c, BigNumber.from(constants.PERC_DIVISOR))
}

const precise = {
    percPoints: (a, b) => {
        return _percPoints(a, b, constants.PERC_DIVISOR_PRECISE)
    },
    percOf: (a, b, c) => {
        return _percOf(a, b, c, constants.PERC_DIVISOR_PRECISE)
    }
}

const _percPoints = (a, b, percDivisor) => {
    return a.mul(percDivisor).div(b)
}

const _percOf = (a, b, c, percDivisor) => {
    return a.mul(_percPoints(b, c, percDivisor)).div(percDivisor)
}

module.exports = {
    percPoints,
    percOf,
    precise
}
