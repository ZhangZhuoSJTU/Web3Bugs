// SPDX-License-Identifier: AGPL-3.0

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

library CheapERC20 {
    function cheapTransfer(IERC20 asset, address to, uint value) internal {
        (bool success, bytes memory data) = address(asset).call(abi.encodeWithSelector(IERC20.transfer.selector, to, value));
        require(success && (data.length == 0 || abi.decode(data, (bool))), 'Mochi Vault: TRANSFER_FAILED');
    }
    
    function cheapTransferFrom(IERC20 asset, address from, address to, uint value) internal {
        (bool success, bytes memory data) = address(asset).call(abi.encodeWithSelector(IERC20.transferFrom.selector, from, to, value));
        require(success && (data.length == 0 || abi.decode(data, (bool))), 'Mochi Vault: TRANSFER_FROM_FAILED');
    }
}
