package vaulttrackertesting

import "math/big"

const ONE_ETH = 1000000000000000000

var ZERO = big.NewInt(0)

// MATURITY is one day, in seconds
const MATURITY = 86400

// REDEEM_INTEREST_EVENT_SIG = crypto.Keccak256Hash([]byte("RedeemInterest(address,uint256))").Hex()
const REDEEM_INTEREST_EVENT_SIG = "0x83a945bd12c713615b59a6e48a3467c05d1a7442350600d6f7fce6af9f7190e9"