// SPDX-License-Identifier: GPL-3.0-only
pragma solidity 0.6.10;

interface IWrappedfCashFactory {
    function deployWrapper(uint16 currencyId, uint40 maturity) external returns(address);
    function computeAddress(uint16 currencyId, uint40 maturity) external view returns(address);
}


