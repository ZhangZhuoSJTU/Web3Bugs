import { Contracts } from '../../existingContracts/compound.json';

import { USDTWhale, USDCWhale, DAIWhale, LINKWhale, ChainLinkAggregators, WBTCWhale, WhaleAccount, UNIWhale } from '../constants-rahul';

export const poolCreationTestCases = [
    {
        Amount: 100,
        Whale1: UNIWhale,
        Whale2: WhaleAccount,
        BorrowTokenParam: Contracts.USDC,
        CollateralTokenParam: Contracts.UNI,
        liquidityBorrowTokenParam: Contracts.cUSDC,
        liquidityCollateralTokenParam: Contracts.cUNI,
        chainlinkBorrowParam: ChainLinkAggregators['USDC/USD'],
        chainlinkCollateralParam: ChainLinkAggregators['UNI/USD'],
    },
    {
        Amount: 1,
        Whale1: WBTCWhale,
        Whale2: WhaleAccount,
        BorrowTokenParam: Contracts.DAI,
        CollateralTokenParam: Contracts.WBTC,
        liquidityBorrowTokenParam: Contracts.cDAI,
        liquidityCollateralTokenParam: Contracts.cWBTC2,
        chainlinkBorrowParam: ChainLinkAggregators['DAI/USD'],
        chainlinkCollateralParam: ChainLinkAggregators['BTC/USD'],
    },
    {
        Amount: 275,
        Whale1: USDCWhale,
        Whale2: DAIWhale,
        BorrowTokenParam: Contracts.USDC,
        CollateralTokenParam: Contracts.DAI,
        liquidityBorrowTokenParam: Contracts.cUSDC,
        liquidityCollateralTokenParam: Contracts.cDAI,
        chainlinkBorrowParam: ChainLinkAggregators['USDC/USD'],
        chainlinkCollateralParam: ChainLinkAggregators['DAI/USD'],
    },
];
