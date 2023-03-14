// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;
pragma experimental ABIEncoderV2;

abstract contract DNSSEC {

    bytes public anchors;

    struct RRSetWithSignature {
        bytes rrset;
        bytes sig;
    }

    event AlgorithmUpdated(uint8 id, address addr);
    event DigestUpdated(uint8 id, address addr);

    function verifyRRSet(RRSetWithSignature[] memory input) external virtual view returns(bytes memory);
    function verifyRRSet(RRSetWithSignature[] memory input, uint256 now) public view virtual returns(bytes memory);
}
