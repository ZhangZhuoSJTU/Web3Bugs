import json

from brownie import accounts
from brownie.network.state import Chain
from scripts.config import CurrencyDefaults, nTokenDefaults
from scripts.deployment import TestEnvironment
from tests.constants import SECONDS_IN_QUARTER
from tests.helpers import get_balance_action, get_balance_trade_action, get_tref

chain = Chain()

gasLog = {
    "deposit.underlying": None,
    "deposit.underlying.hasTransferFee": None,
    "deposit.asset": None,
    "withdraw.asset.partialBalance": None,
    "withdraw.underlying.partialBalance": None,
    "withdraw.asset.entireBalance": None,
    "withdraw.underlying.entireBalance": None,
    "batch.deposit.underlying": None,
    "batch.deposit.underlying.hasTransferFee": None,
    "batch.deposit.asset": None,
    "batch.deposit.asset.hasTransferFee": None,
    "batch.withdraw.asset.partialBalance": None,
    "batch.withdraw.underlying.partialBalance": None,
    "batch.withdraw.asset.entireBalance": None,
    "batch.withdraw.underlying.entireBalance": None,
    "nToken.initializeMarkets.2": None,
    "nToken.initializeMarkets.3": None,
    "nToken.initializeMarkets.4": None,
    "nToken.initializeMarkets.5": None,
    "nToken.initializeMarkets.6": None,
    "nToken.initializeMarkets.7": None,
    "nToken.DepositAssetAndMintNToken.0": None,
    "nToken.DepositAssetAndMintNToken.2": None,
    "nToken.DepositAssetAndMintNToken.3": None,
    "nToken.DepositAssetAndMintNToken.4": None,
    "nToken.DepositAssetAndMintNToken.5": None,
    "nToken.DepositAssetAndMintNToken.6": None,
    "nToken.DepositAssetAndMintNToken.7": None,
    "nToken.DepositUnderlyingAndMintNToken.0": None,
    "nToken.DepositUnderlyingAndMintNToken.2": None,
    "nToken.DepositUnderlyingAndMintNToken.3": None,
    "nToken.DepositUnderlyingAndMintNToken.4": None,
    "nToken.DepositUnderlyingAndMintNToken.5": None,
    "nToken.DepositUnderlyingAndMintNToken.6": None,
    "nToken.DepositUnderlyingAndMintNToken.7": None,
    "nToken.ConvertCashToNToken.0": None,
    "nToken.ConvertCashToNToken.2": None,
    "nToken.ConvertCashToNToken.3": None,
    "nToken.ConvertCashToNToken.4": None,
    "nToken.ConvertCashToNToken.5": None,
    "nToken.ConvertCashToNToken.6": None,
    "nToken.ConvertCashToNToken.7": None,
    "nToken.RedeemNToken.0": None,
    "nToken.RedeemNToken.2": None,
    "nToken.RedeemNToken.3": None,
    "nToken.RedeemNToken.4": None,
    "nToken.RedeemNToken.5": None,
    "nToken.RedeemNToken.6": None,
    "nToken.RedeemNToken.7": None,
    "batchAction.lend.DepositAsset": None,
    "batchAction.lend.DepositUnderlying": None,
    "batchAction.lend.NoDeposit": None,
    "batchAction.lend.WithdrawToAsset": None,
    "batchAction.lend.WithdrawToUnderlying": None,
    "batchAction.lend.RollToMaturity": None,
    "batchAction.liquidity.DepositAsset": None,
    "batchAction.liquidity.DepositUnderlying": None,
    "batchAction.liquidity.NoDeposit": None,
    "batchAction.liquidity.WithdrawToAsset": None,
    "batchAction.liquidity.WithdrawToUnderlying": None,
    "batchAction.liquidity.RollToMaturity": None,
    "batchAction.borrowNoWithdraw.NoDeposit": None,
    "batchAction.borrowNoWithdraw.DepositAssetCollateral": None,
    "batchAction.borrowNoWithdraw.DepositUnderlyingCollateral": None,
    "batchAction.borrowNoWithdraw.DepositETHCollateral": None,
    "batchAction.borrowNoWithdraw.DepositNTokenCollateral": None,
    "batchAction.borrowWithdrawAsset.NoDeposit": None,
    "batchAction.borrowWithdrawAsset.DepositAssetCollateral": None,
    "batchAction.borrowWithdrawAsset.DepositUnderlyingCollateral": None,
    "batchAction.borrowWithdrawAsset.DepositETHCollateral": None,
    "batchAction.borrowWithdrawAsset.DepositNTokenCollateral": None,
    "batchAction.borrowWithdrawUnderlying.NoDeposit": None,
    "batchAction.borrowWithdrawUnderlying.DepositAssetCollateral": None,
    "batchAction.borrowWithdrawUnderlying.DepositUnderlyingCollateral": None,
    "batchAction.borrowWithdrawUnderlying.DepositETHCollateral": None,
    "batchAction.borrowWithdrawUnderlying.DepositNTokenCollateral": None,
    "batchAction.borrow.RollToMaturity": None,
    #     "Other": {
    #         "PurchaseNTokenResidualPartial": None,
    #         "PurchaseNTokenResidualAll": None,
    #         "SettleCashDebtPartial": None,
    #         "SettleCashDebtAll": None,
    #     },
    # },
    # "nTokenTransfer": None,
    # "nTokenClaimIncentives": {"nTokenBalances": range(1, 10)},
    # "liquidateLocalCurrency": {
    #     "transferCash": None,
    #     "withdrawTokens": None,
    #     "transferNTokens": None,
    # },
    # "liquidateCollateralCurrency": {
    #     "transferCash": None,
    #     "withdrawTokens": None,
    #     "transferNTokens": None,
    # },
    # "liquidatefCashLocal": {"fCashAssets": range(1, 5),},
    # "liquidatefCashCrossCurrency": {"fCashAssets": range(1, 5)},
    # "freeCollateral": {
    #     "assetArrayLength": range(1, 7),
    #     "assetsBitmapSize": range(1, 20),
    #     "activeCurrencies": range(1, 9),
    # },
    # "settleAssets": {
    #     "assetArrayLength": range(1, 7),
    #     "assetsBitmapSize": range(1, 20),
    #     "activeCurrencies": range(1, 9),
    # },
}


def environment(accounts):
    return TestEnvironment(accounts[0])


def log_gas(key, txnCold, txnWarm):
    gasLog[key] = {"cold": txnCold.gas_used, "warm": txnWarm.gas_used}


def deposits(env):
    txnCold = env.notional.depositAssetToken(accounts[0].address, 2, 5000e8, {"from": accounts[0]})
    txnWarm = env.notional.depositAssetToken(accounts[0].address, 2, 5000e8, {"from": accounts[0]})
    log_gas("deposit.asset", txnCold, txnWarm)

    chain.undo(2)
    txnCold = env.notional.depositUnderlyingToken(
        accounts[0].address, 2, 5000e8, {"from": accounts[0]}
    )
    txnWarm = env.notional.depositUnderlyingToken(
        accounts[0].address, 2, 5000e8, {"from": accounts[0]}
    )
    log_gas("deposit.underlying", txnCold, txnWarm)

    chain.undo(2)
    txnCold = env.notional.depositUnderlyingToken(
        accounts[0].address, 3, 5000e8, {"from": accounts[0]}
    )
    txnWarm = env.notional.depositUnderlyingToken(
        accounts[0].address, 3, 5000e8, {"from": accounts[0]}
    )
    log_gas("deposit.underlying.hasTransferFee", txnCold, txnWarm)

    chain.undo(2)
    txnCold = env.notional.batchBalanceAction(
        accounts[0], [get_balance_action(2, "DepositAsset", depositActionAmount=5000e8)]
    )
    txnWarm = env.notional.batchBalanceAction(
        accounts[0], [get_balance_action(2, "DepositAsset", depositActionAmount=5000e8)]
    )
    log_gas("batch.deposit.asset", txnCold, txnWarm)

    chain.undo(2)
    txnCold = env.notional.batchBalanceAction(
        accounts[0], [get_balance_action(3, "DepositAsset", depositActionAmount=5000e8)]
    )
    txnWarm = env.notional.batchBalanceAction(
        accounts[0], [get_balance_action(3, "DepositAsset", depositActionAmount=5000e8)]
    )
    log_gas("batch.deposit.asset.hasTransferFee", txnCold, txnWarm)

    chain.undo(2)
    txnCold = env.notional.batchBalanceAction(
        accounts[0], [get_balance_action(2, "DepositUnderlying", depositActionAmount=5000e8)]
    )
    txnWarm = env.notional.batchBalanceAction(
        accounts[0], [get_balance_action(2, "DepositUnderlying", depositActionAmount=5000e8)]
    )
    log_gas("batch.deposit.underlying", txnCold, txnWarm)

    chain.undo(2)
    txnCold = env.notional.batchBalanceAction(
        accounts[0], [get_balance_action(3, "DepositUnderlying", depositActionAmount=5000e8)]
    )
    txnWarm = env.notional.batchBalanceAction(
        accounts[0], [get_balance_action(3, "DepositUnderlying", depositActionAmount=5000e8)]
    )
    log_gas("batch.deposit.underlying.hasTransferFee", txnCold, txnWarm)


def withdraws(env):
    # TODO: warm / cold should incorporate second currency to ensure account context is not blank
    env.notional.depositAssetToken(accounts[0].address, 2, 5000e8, {"from": accounts[0]})

    txn = env.notional.withdraw(2, 1000e8, False)
    log_gas("withdraw.asset.partialBalance", txn, txn)

    txn = env.notional.withdraw(2, 4000e8, False)
    log_gas("withdraw.asset.entireBalance", txn, txn)

    chain.undo(2)

    txn = env.notional.withdraw(2, 1000e8, True)
    log_gas("withdraw.underlying.partialBalance", txn, txn)

    txn = env.notional.withdraw(2, 4000e8, True)
    log_gas("withdraw.underlying.entireBalance", txn, txn)

    chain.undo(2)
    txn = env.notional.batchBalanceAction(
        accounts[0], [get_balance_action(2, "None", withdrawAmountInternalPrecision=1000e8)]
    )
    log_gas("batch.withdraw.asset.partialBalance", txn, txn)
    txn = env.notional.batchBalanceAction(
        accounts[0], [get_balance_action(2, "None", withdrawEntireCashBalance=True)]
    )
    log_gas("batch.withdraw.asset.entireBalance", txn, txn)

    chain.undo(2)
    txn = env.notional.batchBalanceAction(
        accounts[0],
        [
            get_balance_action(
                2, "None", withdrawAmountInternalPrecision=1000e8, redeemToUnderlying=True
            )
        ],
    )
    log_gas("batch.withdraw.underlying.partialBalance", txn, txn)
    txn = env.notional.batchBalanceAction(
        accounts[0],
        [get_balance_action(2, "None", withdrawEntireCashBalance=True, redeemToUnderlying=True)],
    )
    log_gas("batch.withdraw.underlying.entireBalance", txn, txn)


def ntoken(env, maxMarkets):
    currencyId = 2

    txnCold = env.notional.batchBalanceAction(
        accounts[0],
        [
            get_balance_action(
                currencyId, "DepositAssetAndMintNToken", depositActionAmount=1000000e8
            )
        ],
        {"from": accounts[0]},
    )
    txnWarm = env.notional.batchBalanceAction(
        accounts[0],
        [
            get_balance_action(
                currencyId, "DepositAssetAndMintNToken", depositActionAmount=10000000e8
            )
        ],
        {"from": accounts[0]},
    )
    log_gas("nToken.DepositAssetAndMintNToken.{}".format(maxMarkets), txnCold, txnWarm)

    chain.undo(2)
    txnCold = env.notional.batchBalanceAction(
        accounts[0],
        [
            get_balance_action(
                currencyId, "DepositUnderlyingAndMintNToken", depositActionAmount=1000000e18
            )
        ],
        {"from": accounts[0]},
    )
    txnWarm = env.notional.batchBalanceAction(
        accounts[0],
        [
            get_balance_action(
                currencyId, "DepositUnderlyingAndMintNToken", depositActionAmount=1000000e18
            )
        ],
        {"from": accounts[0]},
    )
    log_gas("nToken.DepositUnderlyingAndMintNToken.{}".format(maxMarkets), txnCold, txnWarm)

    chain.undo(2)
    env.notional.batchBalanceAction(
        accounts[0], [get_balance_action(2, "DepositAsset", depositActionAmount=1000000e8)]
    )
    txn = env.notional.batchBalanceAction(
        accounts[0],
        [get_balance_action(currencyId, "ConvertCashToNToken", depositActionAmount=1000000e8)],
        {"from": accounts[0]},
    )
    log_gas("nToken.ConvertCashToNToken.{}".format(maxMarkets), txn, txn)

    if maxMarkets > 0:
        txnCold = env.notional.batchBalanceAction(
            accounts[0],
            [get_balance_action(currencyId, "RedeemNToken", depositActionAmount=10000e8)],
            {"from": accounts[0]},
        )

        chain.undo(1)
        txnWarm = env.notional.batchBalanceAction(
            accounts[0],
            [
                get_balance_action(
                    currencyId,
                    "RedeemNToken",
                    depositActionAmount=10000e8,
                    withdrawEntireCashBalance=True,
                )
            ],
            {"from": accounts[0]},
        )
        log_gas("nToken.RedeemNToken.{}".format(maxMarkets), txnCold, txnWarm)


def lend(env):
    currencyId = 2
    lendAction = [
        {"tradeActionType": "Lend", "marketIndex": 1, "notional": 100e8, "minSlippage": 0}
    ]
    txnCold = env.notional.batchBalanceAndTradeAction(
        accounts[1],
        [
            get_balance_trade_action(
                currencyId,
                "DepositAsset",
                lendAction,
                depositActionAmount=5000e8,
                withdrawEntireCashBalance=True,
            )
        ],
        {"from": accounts[1]},
    )
    txnWarm = env.notional.batchBalanceAndTradeAction(
        accounts[1],
        [
            get_balance_trade_action(
                currencyId,
                "DepositAsset",
                lendAction,
                depositActionAmount=5000e8,
                withdrawEntireCashBalance=True,
            )
        ],
        {"from": accounts[1]},
    )
    log_gas("batchAction.lend.DepositAsset", txnCold, txnWarm)

    chain.undo(2)
    txnCold = env.notional.batchBalanceAndTradeAction(
        accounts[1],
        [
            get_balance_trade_action(
                currencyId,
                "DepositUnderlying",
                lendAction,
                depositActionAmount=100e18,
                withdrawEntireCashBalance=True,
            )
        ],
        {"from": accounts[1]},
    )
    txnWarm = env.notional.batchBalanceAndTradeAction(
        accounts[1],
        [
            get_balance_trade_action(
                currencyId,
                "DepositUnderlying",
                lendAction,
                depositActionAmount=100e18,
                withdrawEntireCashBalance=True,
            )
        ],
        {"from": accounts[1]},
    )
    log_gas("batchAction.lend.DepositUnderlying", txnCold, txnWarm)

    chain.undo(2)
    env.notional.depositAssetToken(accounts[1].address, currencyId, 10000e8, {"from": accounts[1]})
    txnCold = env.notional.batchBalanceAndTradeAction(
        accounts[1],
        [get_balance_trade_action(currencyId, "None", lendAction)],
        {"from": accounts[1]},
    )
    txnWarm = env.notional.batchBalanceAndTradeAction(
        accounts[1],
        [get_balance_trade_action(currencyId, "None", lendAction)],
        {"from": accounts[1]},
    )
    log_gas("batchAction.lend.NoDeposit", txnCold, txnWarm)

    chain.undo(2)
    withdrawAction = [
        {"tradeActionType": "Borrow", "marketIndex": 1, "notional": 100e8, "maxSlippage": 0}
    ]
    env.notional.batchBalanceAndTradeAction(
        accounts[1],
        [
            get_balance_trade_action(
                currencyId,
                "DepositUnderlying",
                lendAction,
                depositActionAmount=100e18,
                withdrawEntireCashBalance=True,
            )
        ],
        {"from": accounts[1]},
    )
    txn = env.notional.batchBalanceAndTradeAction(
        accounts[1],
        [
            get_balance_trade_action(
                currencyId, "None", withdrawAction, withdrawEntireCashBalance=True
            )
        ],
        {"from": accounts[1]},
    )
    log_gas("batchAction.lend.WithdrawToAsset", txn, txn)

    chain.undo(1)
    txn = env.notional.batchBalanceAndTradeAction(
        accounts[1],
        [
            get_balance_trade_action(
                currencyId,
                "None",
                withdrawAction,
                withdrawEntireCashBalance=True,
                redeemToUnderlying=True,
            )
        ],
        {"from": accounts[1]},
    )
    log_gas("batchAction.lend.WithdrawToUnderlying", txn, txn)

    chain.undo(1)
    txn = env.notional.batchBalanceAndTradeAction(
        accounts[1],
        [
            get_balance_trade_action(
                currencyId,
                "None",
                [
                    {
                        "tradeActionType": "Borrow",
                        "marketIndex": 1,
                        "notional": 100e8,
                        "maxSlippage": 0,
                    },
                    {
                        "tradeActionType": "Lend",
                        "marketIndex": 2,
                        "notional": 80e8,
                        "minSlippage": 0,
                    },
                ],
                withdrawEntireCashBalance=True,
            )
        ],
        {"from": accounts[1]},
    )
    log_gas("batchAction.lend.RollToMaturity", txn, txn)


def liquidity(env):
    currencyId = 2
    addLiquidityAction = [
        {
            "tradeActionType": "AddLiquidity",
            "marketIndex": 1,
            "notional": 5000e8,
            "minSlippage": 0,
            "maxSlippage": 0,
        }
    ]
    removeLiquidityAction = [
        {
            "tradeActionType": "RemoveLiquidity",
            "marketIndex": 1,
            "notional": 5000e8,
            "minSlippage": 0,
            "maxSlippage": 0,
        }
    ]

    txnCold = env.notional.batchBalanceAndTradeAction(
        accounts[1],
        [
            get_balance_trade_action(
                currencyId,
                "DepositAsset",
                addLiquidityAction,
                depositActionAmount=5000e8,
                withdrawEntireCashBalance=True,
            )
        ],
        {"from": accounts[1]},
    )
    txnWarm = env.notional.batchBalanceAndTradeAction(
        accounts[1],
        [
            get_balance_trade_action(
                currencyId,
                "DepositAsset",
                addLiquidityAction,
                depositActionAmount=5000e8,
                withdrawEntireCashBalance=True,
            )
        ],
        {"from": accounts[1]},
    )
    log_gas("batchAction.liquidity.DepositAsset", txnCold, txnWarm)

    chain.undo(2)
    txnCold = env.notional.batchBalanceAndTradeAction(
        accounts[1],
        [
            get_balance_trade_action(
                currencyId, "DepositUnderlying", addLiquidityAction, depositActionAmount=100e18
            )
        ],
        {"from": accounts[1]},
    )
    txnWarm = env.notional.batchBalanceAndTradeAction(
        accounts[1],
        [
            get_balance_trade_action(
                currencyId, "DepositUnderlying", addLiquidityAction, depositActionAmount=100e18
            )
        ],
        {"from": accounts[1]},
    )
    log_gas("batchAction.liquidity.DepositUnderlying", txnCold, txnWarm)

    chain.undo(2)
    txnCold = env.notional.batchBalanceAndTradeAction(
        accounts[1],
        [
            get_balance_trade_action(
                currencyId, "DepositUnderlying", addLiquidityAction, depositActionAmount=100e18
            )
        ],
        {"from": accounts[1]},
    )
    txnWarm = env.notional.batchBalanceAndTradeAction(
        accounts[1],
        [
            get_balance_trade_action(
                currencyId, "DepositUnderlying", addLiquidityAction, depositActionAmount=100e18
            )
        ],
        {"from": accounts[1]},
    )
    log_gas("batchAction.liquidity.DepositUnderlying", txnCold, txnWarm)

    chain.undo(2)
    env.notional.depositAssetToken(accounts[1].address, currencyId, 10000e8, {"from": accounts[1]})
    txn = env.notional.batchBalanceAndTradeAction(
        accounts[1],
        [get_balance_trade_action(currencyId, "None", addLiquidityAction)],
        {"from": accounts[1]},
    )
    log_gas("batchAction.liquidity.NoDeposit", txn, txn)

    chain.undo(2)
    # Setup withdraw liquidity, add liquidity
    env.notional.batchBalanceAndTradeAction(
        accounts[1],
        [
            get_balance_trade_action(
                currencyId, "DepositUnderlying", addLiquidityAction, depositActionAmount=100e18
            )
        ],
        {"from": accounts[1]},
    )
    # Create some fCash residual
    env.notional.batchBalanceAndTradeAction(
        accounts[0],
        [
            get_balance_trade_action(
                currencyId,
                "DepositUnderlying",
                [
                    {
                        "tradeActionType": "Borrow",
                        "marketIndex": 1,
                        "notional": 100e8,
                        "maxSlippage": 0,
                    }
                ],
                depositActionAmount=100e18,
            )
        ],
        {"from": accounts[0]},
    )

    txn = env.notional.batchBalanceAndTradeAction(
        accounts[1],
        [
            get_balance_trade_action(
                currencyId, "None", removeLiquidityAction, withdrawEntireCashBalance=True
            )
        ],
        {"from": accounts[1]},
    )
    log_gas("batchAction.liquidity.WithdrawToAsset", txn, txn)

    chain.undo(1)
    txn = env.notional.batchBalanceAndTradeAction(
        accounts[1],
        [
            get_balance_trade_action(
                currencyId,
                "None",
                removeLiquidityAction,
                withdrawEntireCashBalance=True,
                redeemToUnderlying=True,
            )
        ],
        {"from": accounts[1]},
    )
    log_gas("batchAction.liquidity.WithdrawToUnderlying", txn, txn)

    chain.undo(1)
    txn = env.notional.batchBalanceAndTradeAction(
        accounts[1],
        [
            get_balance_trade_action(
                currencyId,
                "None",
                removeLiquidityAction,
                withdrawEntireCashBalance=True,
                redeemToUnderlying=True,
            )
        ],
        {"from": accounts[1]},
    )
    log_gas("batchAction.liquidity.WithdrawToUnderlying", txn, txn)

    chain.undo(1)
    txn = env.notional.batchBalanceAndTradeAction(
        accounts[1],
        [
            get_balance_trade_action(
                currencyId,
                "None",
                [
                    {
                        "tradeActionType": "RemoveLiquidity",
                        "marketIndex": 1,
                        "notional": 5000e8,
                        "minSlippage": 0,
                        "maxSlippage": 0,
                    },
                    {
                        "tradeActionType": "AddLiquidity",
                        "marketIndex": 2,
                        "notional": 0,
                        "minSlippage": 0,
                        "maxSlippage": 0,
                    },
                ],
            )
        ],
        {"from": accounts[1]},
    )
    log_gas("batchAction.liquidity.RollToMaturity", txn, txn)


def borrow(env):
    chain.revert()
    borrowActions(env, False, False)
    chain.revert()
    borrowActions(env, True, False)
    chain.revert()
    borrowActions(env, True, True)


def borrowActions(env, withdrawCash, redeem):
    borrowAction = get_balance_trade_action(
        2,
        "None",
        [{"tradeActionType": "Borrow", "marketIndex": 1, "notional": 100e8, "maxSlippage": 0}],
        withdrawEntireCashBalance=withdrawCash,
        redeemToUnderlying=redeem,
    )
    collateralAction = get_balance_trade_action(4, "DepositAsset", [], depositActionAmount=10000e8)
    key = None
    if withdrawCash and redeem:
        key = "borrowWithdrawUnderlying"
    elif withdrawCash:
        key = "borrowWithdrawAsset"
    else:
        key = "borrowNoWithdraw"

    txnCold = env.notional.batchBalanceAndTradeAction(
        accounts[1], [borrowAction, collateralAction], {"from": accounts[1]}
    )
    txnWarm = env.notional.batchBalanceAndTradeAction(
        accounts[1], [borrowAction, collateralAction], {"from": accounts[1]}
    )
    log_gas("batchAction.{}.DepositAssetCollateral".format(key), txnCold, txnWarm)

    chain.undo(2)
    collateralAction = get_balance_trade_action(
        4, "DepositUnderlying", [], depositActionAmount=200e6
    )
    txnCold = env.notional.batchBalanceAndTradeAction(
        accounts[1], [borrowAction, collateralAction], {"from": accounts[1]}
    )
    txnWarm = env.notional.batchBalanceAndTradeAction(
        accounts[1], [borrowAction, collateralAction], {"from": accounts[1]}
    )
    log_gas("batchAction.{}.DepositUnderlyingCollateral".format(key), txnCold, txnWarm)

    chain.undo(2)
    collateralAction = get_balance_trade_action(
        4, "DepositAssetAndMintNToken", [], depositActionAmount=10000e8
    )
    txnCold = env.notional.batchBalanceAndTradeAction(
        accounts[1], [borrowAction, collateralAction], {"from": accounts[1]}
    )
    txnWarm = env.notional.batchBalanceAndTradeAction(
        accounts[1], [borrowAction, collateralAction], {"from": accounts[1]}
    )
    log_gas("batchAction.{}.DepositNTokenCollateral".format(key), txnCold, txnWarm)

    chain.undo(2)
    env.notional.depositAssetToken(accounts[1].address, 4, 20000e8, {"from": accounts[1]})
    txnCold = env.notional.batchBalanceAndTradeAction(
        accounts[1], [borrowAction], {"from": accounts[1]}
    )
    txnWarm = env.notional.batchBalanceAndTradeAction(
        accounts[1], [borrowAction], {"from": accounts[1]}
    )
    log_gas("batchAction.{}.NoDeposit".format(key), txnCold, txnWarm)

    chain.undo(2)
    ethCollateral = get_balance_trade_action(1, "DepositUnderlying", [], depositActionAmount=10e18)
    txnCold = env.notional.batchBalanceAndTradeAction(
        accounts[1], [ethCollateral, borrowAction], {"from": accounts[1], "value": 10e18}
    )
    txnWarm = env.notional.batchBalanceAndTradeAction(
        accounts[1], [ethCollateral, borrowAction], {"from": accounts[1], "value": 10e18}
    )
    log_gas("batchAction.{}.DepositETHCollateral".format(key), txnCold, txnWarm)


DEPOSIT_PARAMETERS = {
    2: [[int(0.4e8), int(0.6e8)], [int(0.8e9)] * 2],
    3: [[int(0.4e8), int(0.4e8), int(0.2e8)], [int(0.8e9)] * 3],
    4: [[int(0.4e8), int(0.2e8), int(0.2e8), int(0.2e8)], [int(0.8e9)] * 4],
    5: [[int(0.2e8), int(0.2e8), int(0.2e8), int(0.2e8), int(0.2e8)], [int(0.8e9)] * 5],
    6: [[int(0.2e8), int(0.2e8), int(0.2e8), int(0.2e8), int(0.1e8), int(0.1e8)], [int(0.8e9)] * 6],
    7: [
        [int(0.2e8), int(0.2e8), int(0.2e8), int(0.2e8), int(0.1e8), int(0.05e8), int(0.05e8)],
        [int(0.8e9)] * 7,
    ],
}

INIT_PARAMETERS = {
    2: [[int(0.01e9)] * 2, [int(0.5e9)] * 2],
    3: [[int(0.01e9)] * 3, [int(0.5e9)] * 3],
    4: [[int(0.01e9)] * 4, [int(0.5e9)] * 4],
    5: [[int(0.01e9)] * 5, [int(0.5e9)] * 5],
    6: [[int(0.01e9)] * 6, [int(0.5e9)] * 6],
    7: [[int(0.01e9)] * 7, [int(0.5e9)] * 7],
}


def main():
    env = environment(accounts)

    # Set time
    blockTime = chain.time()
    newTime = get_tref(blockTime) + SECONDS_IN_QUARTER + 1
    chain.mine(1, timestamp=newTime)

    cToken = env.cToken["DAI"]
    env.token["DAI"].approve(env.notional.address, 2 ** 255, {"from": accounts[0]})
    env.token["DAI"].approve(cToken.address, 2 ** 255, {"from": accounts[0]})
    cToken.mint(100000000e18, {"from": accounts[0]})
    cToken.approve(env.notional.address, 2 ** 255, {"from": accounts[0]})

    cToken.approve(env.notional.address, 2 ** 255, {"from": accounts[1]})
    env.token["DAI"].approve(env.notional.address, 2 ** 255, {"from": accounts[1]})
    env.token["DAI"].transfer(accounts[1], 1000e18, {"from": accounts[0]})
    cToken.transfer(accounts[1], 500000e8, {"from": accounts[0]})

    env.enableCurrency("DAI", CurrencyDefaults)
    currencyId = 2
    env.notional.updateDepositParameters(currencyId, *(nTokenDefaults["Deposit"]))
    env.notional.updateInitializationParameters(currencyId, *(nTokenDefaults["Initialization"]))
    env.notional.updateTokenCollateralParameters(currencyId, *(nTokenDefaults["Collateral"]))
    env.notional.updateIncentiveEmissionRate(currencyId, CurrencyDefaults["incentiveEmissionRate"])

    cToken = env.cToken["USDT"]
    env.token["USDT"].approve(env.notional.address, 2 ** 255, {"from": accounts[0]})
    env.token["USDT"].approve(cToken.address, 2 ** 255, {"from": accounts[0]})
    cToken.mint(100000000e18, {"from": accounts[0]})
    cToken.approve(env.notional.address, 2 ** 255, {"from": accounts[0]})
    env.enableCurrency("USDT", CurrencyDefaults)

    cToken = env.cToken["USDC"]
    env.token["USDC"].approve(env.notional.address, 2 ** 255, {"from": accounts[0]})
    env.token["USDC"].approve(cToken.address, 2 ** 255, {"from": accounts[0]})
    cToken.mint(100000000e6, {"from": accounts[0]})
    cToken.approve(env.notional.address, 2 ** 255, {"from": accounts[0]})

    cToken.approve(env.notional.address, 2 ** 255, {"from": accounts[1]})
    env.token["USDC"].approve(env.notional.address, 2 ** 255, {"from": accounts[1]})
    env.token["USDC"].transfer(accounts[1], 10000e6, {"from": accounts[0]})
    cToken.transfer(accounts[1], 500000e8, {"from": accounts[0]})
    env.enableCurrency("USDC", CurrencyDefaults)

    currencyId = 4
    # TODO: what if this isnt initialized?
    env.notional.updateDepositParameters(currencyId, *(nTokenDefaults["Deposit"]))
    env.notional.updateInitializationParameters(currencyId, *(nTokenDefaults["Initialization"]))
    env.notional.updateTokenCollateralParameters(currencyId, *(nTokenDefaults["Collateral"]))
    env.notional.updateIncentiveEmissionRate(currencyId, CurrencyDefaults["incentiveEmissionRate"])

    chain.snapshot()

    deposits(env)
    chain.revert()

    withdraws(env)
    chain.revert()

    ntoken(env, 0)
    currencyId = 2
    for maxMarkets in range(2, 8):
        chain.revert()

        cashGroup = list(env.notional.getCashGroup(currencyId))
        cashGroup[0] = maxMarkets
        cashGroup[9] = CurrencyDefaults["tokenHaircut"][0:maxMarkets]
        cashGroup[10] = CurrencyDefaults["rateScalar"][0:maxMarkets]
        env.notional.updateCashGroup(currencyId, cashGroup)
        env.notional.updateDepositParameters(currencyId, *(DEPOSIT_PARAMETERS[maxMarkets]))
        env.notional.updateInitializationParameters(currencyId, *(INIT_PARAMETERS[maxMarkets]))

        # initialize markets
        env.notional.batchBalanceAction(
            accounts[1],
            [
                get_balance_action(
                    currencyId, "DepositAssetAndMintNToken", depositActionAmount=100e8
                )
            ],
            {"from": accounts[1]},
        )
        txn = env.notional.initializeMarkets(currencyId, True)
        log_gas("nToken.initializeMarkets.{}".format(maxMarkets), txn, txn)

        ntoken(env, maxMarkets)

    chain.revert()
    env.notional.batchBalanceAction(
        accounts[0],
        [
            get_balance_action(2, "DepositAssetAndMintNToken", depositActionAmount=5000000e8),
            get_balance_action(4, "DepositAssetAndMintNToken", depositActionAmount=5000000e8),
        ],
        {"from": accounts[0]},
    )
    env.notional.initializeMarkets(2, True)
    env.notional.initializeMarkets(4, True)
    chain.snapshot()

    lend(env)
    chain.revert()

    liquidity(env)
    chain.revert()

    borrow(env)
    chain.revert()

    with open("gas_stats.json", "w") as f:
        json.dump(gasLog, f, sort_keys=True, indent=4)
