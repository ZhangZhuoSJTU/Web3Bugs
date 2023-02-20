export enum Chain {
    mainnet,
    rinkeby,
    kovan,
    local,
}

export interface Token {
    symbol: string;
    address: string;
    chain: Chain;
    decimals: number;
}

export const assetAddressTypes = ["address"] as const;
export type AssetAddressTypes = typeof assetAddressTypes[number];

export const tokens: Array<Token> = [];
