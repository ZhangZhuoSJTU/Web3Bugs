from brownie.convert import to_bytes, to_uint
from brownie.convert.datatypes import Wei
from eth_abi.packed import encode_abi_packed
from tests.constants import (
    BALANCE_FLAG_INT,
    CASH_GROUP_PARAMETERS,
    CURVE_SHAPES,
    DEPOSIT_ACTION_TYPE,
    MARKET_LENGTH,
    MARKETS,
    PORTFOLIO_FLAG_INT,
    RATE_PRECISION,
    SECONDS_IN_DAY,
    SECONDS_IN_QUARTER,
    START_TIME,
    TRADE_ACTION_TYPE,
)


def get_balance_action(currencyId, depositActionType, **kwargs):
    depositActionAmount = (
        0 if "depositActionAmount" not in kwargs else kwargs["depositActionAmount"]
    )
    withdrawAmountInternalPrecision = (
        0
        if "withdrawAmountInternalPrecision" not in kwargs
        else kwargs["withdrawAmountInternalPrecision"]
    )
    withdrawEntireCashBalance = (
        False if "withdrawEntireCashBalance" not in kwargs else kwargs["withdrawEntireCashBalance"]
    )
    redeemToUnderlying = (
        False if "redeemToUnderlying" not in kwargs else kwargs["redeemToUnderlying"]
    )

    return (
        DEPOSIT_ACTION_TYPE[depositActionType],
        currencyId,
        int(depositActionAmount),
        int(withdrawAmountInternalPrecision),
        withdrawEntireCashBalance,
        redeemToUnderlying,
    )


def get_balance_trade_action(currencyId, depositActionType, tradeActionData, **kwargs):
    tradeActions = [get_trade_action(**t) for t in tradeActionData]
    balanceAction = list(get_balance_action(currencyId, depositActionType, **kwargs))
    balanceAction.append(tradeActions)

    return tuple(balanceAction)


def get_trade_action(**kwargs):
    tradeActionType = kwargs["tradeActionType"]

    if tradeActionType == "Lend":
        return encode_abi_packed(
            ["uint8", "uint8", "uint88", "uint32", "uint120"],
            [
                TRADE_ACTION_TYPE[tradeActionType],
                kwargs["marketIndex"],
                int(kwargs["notional"]),
                int(kwargs["minSlippage"]),
                0,
            ],
        )
    elif tradeActionType == "Borrow":
        return encode_abi_packed(
            ["uint8", "uint8", "uint88", "uint32", "uint120"],
            [
                TRADE_ACTION_TYPE[tradeActionType],
                kwargs["marketIndex"],
                int(kwargs["notional"]),
                int(kwargs["maxSlippage"]),
                0,
            ],
        )
    elif tradeActionType == "AddLiquidity":
        return encode_abi_packed(
            ["uint8", "uint8", "uint88", "uint32", "uint32", "uint88"],
            [
                TRADE_ACTION_TYPE[tradeActionType],
                kwargs["marketIndex"],
                int(kwargs["notional"]),
                int(kwargs["minSlippage"]),
                int(kwargs["maxSlippage"]),
                0,
            ],
        )
    elif tradeActionType == "RemoveLiquidity":
        return encode_abi_packed(
            ["uint8", "uint8", "uint88", "uint32", "uint32", "uint88"],
            [
                TRADE_ACTION_TYPE[tradeActionType],
                kwargs["marketIndex"],
                int(kwargs["notional"]),
                int(kwargs["minSlippage"]),
                int(kwargs["maxSlippage"]),
                0,
            ],
        )
    elif tradeActionType == "PurchaseNTokenResidual":
        return encode_abi_packed(
            ["uint8", "uint32", "int88", "uint128"],
            [
                TRADE_ACTION_TYPE[tradeActionType],
                kwargs["maturity"],
                int(kwargs["fCashAmountToPurchase"]),
                0,
            ],
        )
    elif tradeActionType == "SettleCashDebt":
        return encode_abi_packed(
            ["uint8", "address", "uint88"],
            [
                TRADE_ACTION_TYPE[tradeActionType],
                kwargs["counterparty"],
                int(kwargs["amountToSettle"]),
            ],
        )

def get_lend_action(currencyId, tradeActionData, depositUnderlying):
    tradeActions = [get_trade_action(**t) for t in tradeActionData]
    return (currencyId, depositUnderlying, tradeActions)
