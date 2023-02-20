"""
Inlined version of bantegs' multicall.py for brownie compatibility
https://github.com/banteg/multicall.py
"""
__version__ = "0.1.1"

from helpers.multicall.signature import Signature
from helpers.multicall.call import Call
from helpers.multicall.multicall import Multicall
from helpers.multicall.functions import func, as_wei
