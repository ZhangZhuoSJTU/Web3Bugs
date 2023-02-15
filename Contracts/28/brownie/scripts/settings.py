import time
from brownie import *

# Custom Parameters
TENPOW18 = 10 ** 18

# Number of tokens you wish to auction, you must be able to transfer these
AUCTION_TOKENS = 1000 * TENPOW18
AUCTION_DAYS = 2
# auctions start at a high price per token
AUCTION_START_PRICE = 100 * TENPOW18
# This is minimum reserve price per token
AUCTION_RESERVE = 0.001 * TENPOW18

# Calculated variables
AUCTION_START = int(time.time()) + 200   # Few minutes to deploy
AUCTION_END = AUCTION_START + 60 * 60 * 24 * AUCTION_DAYS

# Constants
SYMBOL = "TT5"
NAME = "Test Token"
ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
ETH_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
