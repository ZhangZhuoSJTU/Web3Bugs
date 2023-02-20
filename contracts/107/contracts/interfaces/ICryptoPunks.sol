// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

interface ICryptoPunks {
    function transferPunk(address _to, uint256 _punkIndex) external;

    function punkIndexToAddress(uint256 _punkIndex)
        external
        view
        returns (address);
}
