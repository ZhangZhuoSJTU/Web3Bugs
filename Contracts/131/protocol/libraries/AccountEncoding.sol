// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

library AccountEncoding {
    function addr(bytes32 account) internal pure returns (address) {
        return address(bytes20(account));
    }

    function meta(bytes32 account) internal pure returns (bytes12) {
        return bytes12(account << 160);
    }
}
