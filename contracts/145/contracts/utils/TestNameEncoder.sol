// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {NameEncoder} from "./NameEncoder.sol";

contract TestNameEncoder {
    using NameEncoder for string;

    function encodeName(string memory name)
        public
        pure
        returns (bytes memory, bytes32)
    {
        return name.dnsEncodeName();
    }
}
