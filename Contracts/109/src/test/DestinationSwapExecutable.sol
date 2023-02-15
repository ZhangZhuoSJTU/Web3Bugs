// SPDX-License-Identifier: MIT

pragma solidity 0.8.9;

import { IAxelarExecutable } from '../interfaces/IAxelarExecutable.sol';
import { IERC20 } from '../interfaces/IERC20.sol';
import { TokenSwapper } from './TokenSwapper.sol';

contract DestinationSwapExecutable is IAxelarExecutable {
    address swapper;

    constructor(address gatewayAddress, address swapperAddress) IAxelarExecutable(gatewayAddress) {
        swapper = swapperAddress;
    }

    function _executeWithToken(
        string memory,
        string memory,
        bytes calldata payload,
        string memory tokenSymbol,
        uint256 amount
    ) internal override {
        (address toTokenAddress, address recipient) = abi.decode(payload, (address, address));

        address tokenAddress = _getTokenAddress(tokenSymbol);
        IERC20(tokenAddress).approve(swapper, amount);
        TokenSwapper(swapper).swap(tokenAddress, amount, toTokenAddress, recipient);
    }
}
