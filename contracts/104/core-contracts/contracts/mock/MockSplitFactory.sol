// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import {SplitFactory} from "@chestrnft/splits/contracts/SplitFactory.sol";

contract MockSplitFactory is SplitFactory {
    constructor(address _splitter, address _royaltyVault)
        SplitFactory(_splitter, _royaltyVault)
    {}
}
