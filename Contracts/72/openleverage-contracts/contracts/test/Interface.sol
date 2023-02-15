// SPDX-License-Identifier: BUSL-1.1
pragma solidity >=0.4.22 <0.8.0;

import './Storage.sol';

abstract contract  Interface is Storage {
    function changeOwner(address newOwner) external virtual;
}
