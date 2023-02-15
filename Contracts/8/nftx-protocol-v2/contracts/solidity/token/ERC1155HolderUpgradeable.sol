// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import "./IERC1155ReceiverUpgradeable.sol";

contract ERC1155HolderUpgradeable is IERC1155ReceiverUpgradeable {
    
   function onERC1155Received(
        address,
        address,
        uint256,
        uint256,
        bytes memory
    ) public virtual override returns (bytes4) {
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address,
        address,
        uint256[] memory,
        uint256[] memory,
        bytes memory
    ) public virtual override returns (bytes4) {
        return this.onERC1155BatchReceived.selector;
    }

    function supportsInterface(bytes4 interfaceId)
        external
        override
        view
        returns (bool)
    {}
}
