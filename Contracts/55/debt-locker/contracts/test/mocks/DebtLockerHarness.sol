// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.7;

import { DebtLocker } from "../../DebtLocker.sol";

contract DebtLockerHarness is DebtLocker {

    /*************************/
    /*** Harness Functions ***/
    /*************************/

    function getGlobals() external view returns (address) {
        return _getGlobals();
    }

    function getPoolDelegate() external view returns(address) {
        return _getPoolDelegate();
    }

    function isLiquidationActive() external view returns (bool) {
        return _isLiquidationActive();
    }

}
