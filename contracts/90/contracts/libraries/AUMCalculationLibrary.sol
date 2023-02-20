// SPDX-License-Identifier: GPL-2.0-or-later

pragma solidity >=0.8.7;

/// @title AUM fee calculation library
/// @notice More details https://github.com/enzymefinance/protocol/blob/b671b3dfea92596dd2e962c73b233dcdb22bf753/contracts/release/utils/MakerDaoMath.sol
/// @dev Taken from https://github.com/enzymefinance/protocol
library AUMCalculationLibrary {
    /// @dev A constant used for AUM fee calculation to prevent underflow
    uint constant RATE_SCALE_BASE = 1e27;

    /// @notice Power function for AUM fee calculation
    /// @param _x Base number
    /// @param _n Exponent number
    /// @param _base Base number multiplier
    /// @return z_ Returns value of `_x` raised to power of `_n`
    function rpow(
        uint _x,
        uint _n,
        uint _base
    ) internal pure returns (uint z_) {
        assembly {
            switch _x
            case 0 {
                switch _n
                case 0 {
                    z_ := _base
                }
                default {
                    z_ := 0
                }
            }
            default {
                switch mod(_n, 2)
                case 0 {
                    z_ := _base
                }
                default {
                    z_ := _x
                }
                let half := div(_base, 2)
                for {
                    _n := div(_n, 2)
                } _n {
                    _n := div(_n, 2)
                } {
                    let xx := mul(_x, _x)
                    if iszero(eq(div(xx, _x), _x)) {
                        revert(0, 0)
                    }
                    let xxRound := add(xx, half)
                    if lt(xxRound, xx) {
                        revert(0, 0)
                    }
                    _x := div(xxRound, _base)
                    if mod(_n, 2) {
                        let zx := mul(z_, _x)
                        if and(iszero(iszero(_x)), iszero(eq(div(zx, _x), z_))) {
                            revert(0, 0)
                        }
                        let zxRound := add(zx, half)
                        if lt(zxRound, zx) {
                            revert(0, 0)
                        }
                        z_ := div(zxRound, _base)
                    }
                }
            }
        }

        return z_;
    }
}
