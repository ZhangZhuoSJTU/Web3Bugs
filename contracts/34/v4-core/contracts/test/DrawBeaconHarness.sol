// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.6;

import "@pooltogether/pooltogether-rng-contracts/contracts/RNGInterface.sol";

import "../DrawBeacon.sol";
import "../interfaces/IDrawBuffer.sol";

contract DrawBeaconHarness is DrawBeacon {
    constructor(
        address _owner,
        IDrawBuffer _drawBuffer,
        RNGInterface _rng,
        uint32 _nextDrawId,
        uint64 _beaconPeriodStart,
        uint32 _drawPeriodSeconds,
        uint32 _rngTimeout
    ) DrawBeacon(_owner, _drawBuffer, _rng, _nextDrawId, _beaconPeriodStart, _drawPeriodSeconds, _rngTimeout) {}

    uint64 internal time;

    function setCurrentTime(uint64 _time) external {
        time = _time;
    }

    function _currentTime() internal view override returns (uint64) {
        return time;
    }

    function currentTime() external view returns (uint64) {
        return _currentTime();
    }

    function _currentTimeInternal() external view returns (uint64) {
        return super._currentTime();
    }

    function setRngRequest(uint32 requestId, uint32 lockBlock) external {
        rngRequest.id = requestId;
        rngRequest.lockBlock = lockBlock;
    }
}
