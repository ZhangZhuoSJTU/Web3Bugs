import {keccak256, bufferToHex} from "ethereumjs-util"
import ethAbi from "ethereumjs-abi"
import {ethers} from "hardhat"
export function contractId(name) {
    return ethers.utils.solidityKeccak256(["string"], [name])
}

export function functionSig(name) {
    return bufferToHex(keccak256(name).slice(0, 4))
}

export function eventSig(name) {
    return bufferToHex(keccak256(name))
}

export function functionEncodedABI(name, params, values) {
    return bufferToHex(Buffer.concat([keccak256(name).slice(0, 4), ethAbi.rawEncode(params, values)]))
}
