// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

interface ITwitterVerifier {
    function registerSelf(
        bool _isMasterLinked,
        uint8 _v,
        bytes32 _r,
        bytes32 _s,
        string memory _twitterId,
        uint256 _deadline
    ) external;

    function unregisterSelf() external;
}
