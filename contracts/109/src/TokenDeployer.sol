// SPDX-License-Identifier: MIT

pragma solidity 0.8.9;

import { BurnableMintableCappedERC20 } from './BurnableMintableCappedERC20.sol';

contract TokenDeployer {
    function deployToken(
        string memory name,
        string memory symbol,
        uint8 decimals,
        uint256 cap,
        bytes32 salt
    ) external returns (address tokenAddress) {
        tokenAddress = address(new BurnableMintableCappedERC20{ salt: salt }(name, symbol, decimals, cap));
    }
}
