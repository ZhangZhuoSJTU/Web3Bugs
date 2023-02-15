import {BigNumber, ethers} from "ethers"

export const constants = {
    NULL_ADDRESS: "0x0000000000000000000000000000000000000000",
    NULL_BYTES: "0x0000000000000000000000000000000000000000000000000000000000000000",
    TOKEN_UNIT: ethers.utils.parseEther("1"),
    PERC_DIVISOR: 1000000,
    PERC_MULTIPLIER: 10000,
    PERC_DIVISOR_PRECISE: BigNumber.from(10).pow(27),
    RESCALE_FACTOR: BigNumber.from(10).pow(21),
    MAX_UINT256: ethers.constants.MaxUint256,
    DelegatorStatus: {
        Pending: 0,
        Bonded: 1,
        Unbonded: 2
    },
    TranscoderStatus: {
        NotRegistered: 0,
        Registered: 1
    }
}
