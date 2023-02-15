// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;
pragma abicoder v2;

import './PCLUser.t.sol';

contract MaliciousLender is PCLUser {
    constructor(address _pclAddress, address _lpAddress) PCLUser(_pclAddress, _lpAddress) {}

    function onERC1155Received(
        address,
        address,
        uint256 id,
        uint256,
        bytes calldata
    ) external override returns (bytes4) {
        // any code can be executed here
        ILenderPool(msg.sender).start(id);
        return bytes4(keccak256('onERC1155Received(address,address,uint256,uint256,bytes)'));
    }
}
