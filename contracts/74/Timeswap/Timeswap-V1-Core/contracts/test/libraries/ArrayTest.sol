// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

import {Array} from '../../libraries/Array.sol';
import {IPair} from '../../interfaces/IPair.sol';

contract ArrayTest {
    using Array for IPair.Due[];

    IPair.Due[] public duesStorage;
    
    function insert(
        IPair.Due[] calldata dues,
        IPair.Due memory dueOut
    ) external returns (uint256 id) {
        for (uint256 i; i < duesStorage.length; i++) duesStorage.pop;
        
        for (uint256 i; i < dues.length; i++) {
            duesStorage.push(dues[i]);
        }

        return duesStorage.insert(dueOut);
    }
}