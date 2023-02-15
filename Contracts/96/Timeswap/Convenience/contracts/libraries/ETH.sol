// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

library ETH {
    function transfer(address payable to, uint256 amount) internal {
        (bool success, ) = to.call{value: amount}('');
        require(success, 'E521');
    }
}
