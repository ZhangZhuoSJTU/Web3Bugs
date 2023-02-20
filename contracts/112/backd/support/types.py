from decimal import Decimal
from typing import NamedTuple

from eth_abi.abi import encode_abi


class TopUpRecord(NamedTuple):
    threshold: Decimal
    priorityFee: Decimal
    maxFee: Decimal
    actionToken: str
    depositToken: str
    singleTopUpAmount: Decimal
    totalTopUpAmount: Decimal
    depositTokenBalance: Decimal = Decimal(0)
    extra: str = "0x" + encode_abi(["bool"], [False]).hex()
