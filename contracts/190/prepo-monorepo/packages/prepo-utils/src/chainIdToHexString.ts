import { ChainId } from 'prepo-constants'

export const chainIdToHexString = (chainId: ChainId): string => `0x${chainId.toString(16)}`
