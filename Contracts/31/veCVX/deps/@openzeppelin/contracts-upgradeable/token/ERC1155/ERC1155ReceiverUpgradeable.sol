// SPDX-License-Identifier: MIT

pragma solidity ^0.6.0;

import "./IERC1155ReceiverUpgradeable.sol";
import "../../introspection/ERC165Upgradeable.sol";
import "../../proxy/Initializable.sol";

/**
 * @dev _Available since v3.1._
 */
abstract contract ERC1155ReceiverUpgradeable is
    Initializable,
    ERC165Upgradeable,
    IERC1155ReceiverUpgradeable
{
    function __ERC1155Receiver_init() internal initializer {
        __ERC165_init_unchained();
        __ERC1155Receiver_init_unchained();
    }

    function __ERC1155Receiver_init_unchained() internal initializer {
        _registerInterface(
            ERC1155ReceiverUpgradeable(0).onERC1155Received.selector ^
                ERC1155ReceiverUpgradeable(0).onERC1155BatchReceived.selector
        );
    }

    uint256[50] private __gap;
}
