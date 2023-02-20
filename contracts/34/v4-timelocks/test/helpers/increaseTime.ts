import { providers } from "ethers";

const advanceBlock = (provider: providers.JsonRpcProvider) => {
    return provider.send("evm_mine", []);
};

export const increaseTime = async (
    provider: providers.JsonRpcProvider,
    time: number,
    advance: Boolean = true
) => {
    await provider.send("evm_increaseTime", [time]);
    if (advance) await advanceBlock(provider);
};

export const setTime = async (
    provider: providers.JsonRpcProvider,
    time: number,
    advance: Boolean = true
) => {
    await provider.send("evm_setNextBlockTimestamp", [time]);
    if (advance) await advanceBlock(provider);
};
