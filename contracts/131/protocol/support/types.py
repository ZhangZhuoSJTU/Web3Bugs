from decimal import Decimal
from typing import NamedTuple

from brownie import ZERO_ADDRESS
from eth_abi.abi import encode_abi


class TopUpRecord(NamedTuple):
    threshold: Decimal
    priorityFee: Decimal
    maxFee: Decimal
    registeredAt: int = 0
    actionToken: str = ZERO_ADDRESS
    depositToken: str = ZERO_ADDRESS
    singleTopUpAmount: Decimal = Decimal(0)
    totalTopUpAmount: Decimal = Decimal(0)
    depositTokenBalance: Decimal = Decimal(0)
    extra: str = "0x" + encode_abi(["bool"], [False]).hex()
