// SPDX-License-Identifier: MIT

pragma solidity ^0.8.11;

interface Iauction {
    function isWinningSignature(bytes32 _hash, bytes memory _signature)
        external
        view
        returns (bool);
}
