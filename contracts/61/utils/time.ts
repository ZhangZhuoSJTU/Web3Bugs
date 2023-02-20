import { Network } from 'hardhat/types';

export async function timeTravel(network: Network, time: number) {
    await network.provider.request({
        method: 'evm_increaseTime',
        params: [time],
    });
}

export async function blocksTravel(network: Network, blocks: number) {
    for (let index = 0; index < blocks; index++) {
        await network.provider.request({
            method: 'evm_mine',
            params: [],
        });
    }
}

export async function blockTravel(network: Network, time: number) {
    await network.provider.request({
        method: 'evm_mine',
        params: [time],
    });
}

export async function incrementChain(network: Network, blocks: number, blockTime: number = 15000) {
    await network.provider.request({
        method: 'evm_increaseTime',
        params: [blocks * blockTime],
    });

    for (let index = 0; index < blocks; index++) {
        await network.provider.request({
            method: 'evm_mine',
            params: [],
        });
    }
    return;
}
