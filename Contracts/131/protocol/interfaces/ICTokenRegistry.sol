// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "./vendor/CToken.sol";

interface ICTokenRegistry {
    function getCToken(address underlying) external view returns (address);

    function getCToken(address underlying, bool ensureExists) external view returns (address);

    function fetchCToken(address underlying) external returns (address);
}
