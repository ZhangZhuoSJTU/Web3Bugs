package marketplacetesting

import "math/big"

const ONE_ETH = 1000000000000000000
const ONE_GWEI = 1000000000
const ONE_WEI = 1

var ZERO = big.NewInt(0)

// MATURITY is one day, in seconds
const MATURITY = 86400

// MATURE_EVENT_SIG = crypto.Keccak256Hash([]byte("Mature(address,uint256,uint256,uint256))").Hex()
const MATURE_EVENT_SIG = "0x0080e09d7b4544aa5a923873be1df3e31945593d40cb1c874d99259ec3ac43a4"