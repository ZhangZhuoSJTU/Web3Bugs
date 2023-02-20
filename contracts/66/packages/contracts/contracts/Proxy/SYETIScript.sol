// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.6.11;

import "../Dependencies/CheckContract.sol";
import "../Interfaces/ISYETI.sol";


contract SYETIScript is CheckContract {
    ISYETI immutable SYETI;

    constructor(address _sYETIAddress) public {
        checkContract(_sYETIAddress);
        SYETI = ISYETI(_sYETIAddress);
    }

    function stake(uint _YETIamount) external {
        SYETI.mint(_YETIamount);
    }
}
