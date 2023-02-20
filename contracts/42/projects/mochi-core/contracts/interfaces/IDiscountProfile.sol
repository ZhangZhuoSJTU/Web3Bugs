// SPDX-License-Identifier: AGPL-3.0

pragma solidity ^0.8.0;

import "@mochifi/library/contracts/Float.sol";

interface IDiscountProfile {
    function discount(address _user) external view returns (float memory);
}
