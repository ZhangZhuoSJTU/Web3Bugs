// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.6;

import "../DrawBuffer.sol";
import "../interfaces/IDrawBeacon.sol";

contract DrawBufferHarness is DrawBuffer {
    constructor(address owner, uint8 card) DrawBuffer(owner, card) {}

    function addMultipleDraws(
        uint256 _start,
        uint256 _numberOfDraws,
        uint32 _timestamp,
        uint256 _winningRandomNumber
    ) external {
        for (uint256 index = _start; index <= _numberOfDraws; index++) {
            IDrawBeacon.Draw memory _draw = IDrawBeacon.Draw({
                winningRandomNumber: _winningRandomNumber,
                drawId: uint32(index),
                timestamp: _timestamp,
                beaconPeriodSeconds: 10,
                beaconPeriodStartedAt: 20
            });

            _pushDraw(_draw);
        }
    }
}
