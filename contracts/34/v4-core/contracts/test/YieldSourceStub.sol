// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.6;

import "@pooltogether/yield-source-interface/contracts/IYieldSource.sol";

interface YieldSourceStub is IYieldSource {
    function canAwardExternal(address _externalToken) external view returns (bool);
}
