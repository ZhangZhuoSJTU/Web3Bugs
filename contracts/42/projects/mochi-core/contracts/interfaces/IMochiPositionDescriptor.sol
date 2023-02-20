// SPDX-License-Identifier: AGPL-3.0

pragma solidity ^0.8.0;

interface IMochiPositionDescriptor {
    function getTokenURI(address _position, uint256 _positionId)
        external
        view
        returns (string memory);
}
