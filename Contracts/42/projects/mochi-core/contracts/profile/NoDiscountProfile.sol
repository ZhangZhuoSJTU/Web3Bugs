// SPDX-License-Identifier: AGPL-3.0

pragma solidity ^0.8.0;

import "../interfaces/IDiscountProfile.sol";

contract NoDiscountProfile is IDiscountProfile {
    function discount(address) external pure override returns (float memory) {
        return float({numerator: 0, denominator: 1});
    }
}
