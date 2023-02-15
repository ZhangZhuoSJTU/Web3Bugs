import { Signer } from "ethers"

export type EthAddress = string
export type Bytes32 = string

export interface Account {
    signer: Signer
    address: string
}
