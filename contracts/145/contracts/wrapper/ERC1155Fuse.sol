//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/IERC1155MetadataURI.sol";
import "@openzeppelin/contracts/utils/Address.sol";

/* This contract is a variation on ERC1155 with the additions of _setData, getData and _canTransfer and ownerOf. _setData and getData allows the use of the other 96 bits next to the address of the owner for extra data. We use this to store 'fuses' that control permissions that can be burnt. 32 bits are used for the fuses themselves and 64 bits are used for the expiry of the name. When a name has expired, its fuses will be be set back to 0 */

error OperationProhibited(bytes32 node);

abstract contract ERC1155Fuse is ERC165, IERC1155, IERC1155MetadataURI {
    using Address for address;
    mapping(uint256 => uint256) public _tokens;

    // Mapping from owner to operator approvals
    mapping(address => mapping(address => bool)) private _operatorApprovals;

    /**************************************************************************
     * ERC721 methods
     *************************************************************************/

    function ownerOf(uint256 id) public view virtual returns (address) {
        (address owner, , ) = getData(id);
        return owner;
    }

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC165, IERC165)
        returns (bool)
    {
        return
            interfaceId == type(IERC1155).interfaceId ||
            interfaceId == type(IERC1155MetadataURI).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    /**
     * @dev See {IERC1155-balanceOf}.
     *
     * Requirements:
     *
     * - `account` cannot be the zero address.
     */
    function balanceOf(address account, uint256 id)
        public
        view
        virtual
        override
        returns (uint256)
    {
        require(
            account != address(0),
            "ERC1155: balance query for the zero address"
        );
        (address owner, , ) = getData(id);
        if (owner == account) {
            return 1;
        }
        return 0;
    }

    /**
     * @dev See {IERC1155-balanceOfBatch}.
     *
     * Requirements:
     *
     * - `accounts` and `ids` must have the same length.
     */
    function balanceOfBatch(address[] memory accounts, uint256[] memory ids)
        public
        view
        virtual
        override
        returns (uint256[] memory)
    {
        require(
            accounts.length == ids.length,
            "ERC1155: accounts and ids length mismatch"
        );

        uint256[] memory batchBalances = new uint256[](accounts.length);

        for (uint256 i = 0; i < accounts.length; ++i) {
            batchBalances[i] = balanceOf(accounts[i], ids[i]);
        }

        return batchBalances;
    }

    /**
     * @dev See {IERC1155-setApprovalForAll}.
     */
    function setApprovalForAll(address operator, bool approved)
        public
        virtual
        override
    {
        require(
            msg.sender != operator,
            "ERC1155: setting approval status for self"
        );

        _operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    /**
     * @dev See {IERC1155-isApprovedForAll}.
     */
    function isApprovedForAll(address account, address operator)
        public
        view
        virtual
        override
        returns (bool)
    {
        return _operatorApprovals[account][operator];
    }

    /**
     * @dev Returns the Name's owner address and fuses
     */
    function getData(uint256 tokenId)
        public
        view
        returns (
            address owner,
            uint32 fuses,
            uint64 expiry
        )
    {
        uint256 t = _tokens[tokenId];
        owner = address(uint160(t));
        expiry = uint64(t >> 192);
        if (block.timestamp > expiry) {
            fuses = 0;
        } else {
            fuses = uint32(t >> 160);
        }
    }

    /**
     * @dev Sets the Name's owner address and fuses
     */
    function _setData(
        uint256 tokenId,
        address owner,
        uint32 fuses,
        uint64 expiry
    ) internal virtual {
        _tokens[tokenId] =
            uint256(uint160(owner)) |
            (uint256(fuses) << 160) |
            (uint256(expiry) << 192);
    }

    /**
     * @dev See {IERC1155-safeTransferFrom}.
     */
    function safeTransferFrom(
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) public virtual override {
        require(to != address(0), "ERC1155: transfer to the zero address");
        require(
            from == msg.sender || isApprovedForAll(from, msg.sender),
            "ERC1155: caller is not owner nor approved"
        );

        _transfer(from, to, id, amount, data);
    }

    /**
     * @dev See {IERC1155-safeBatchTransferFrom}.
     */
    function safeBatchTransferFrom(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) public virtual override {
        require(
            ids.length == amounts.length,
            "ERC1155: ids and amounts length mismatch"
        );
        require(to != address(0), "ERC1155: transfer to the zero address");
        require(
            from == msg.sender || isApprovedForAll(from, msg.sender),
            "ERC1155: transfer caller is not owner nor approved"
        );

        for (uint256 i = 0; i < ids.length; ++i) {
            uint256 id = ids[i];
            uint256 amount = amounts[i];

            (address oldOwner, uint32 fuses, uint64 expiration) = getData(id);

            if (!_canTransfer(fuses)) {
                revert OperationProhibited(bytes32(id));
            }

            require(
                amount == 1 && oldOwner == from,
                "ERC1155: insufficient balance for transfer"
            );
            _setData(id, to, fuses, expiration);
        }

        emit TransferBatch(msg.sender, from, to, ids, amounts);

        _doSafeBatchTransferAcceptanceCheck(
            msg.sender,
            from,
            to,
            ids,
            amounts,
            data
        );
    }

    /**************************************************************************
     * Internal/private methods
     *************************************************************************/

    function _canTransfer(uint32 fuses) internal virtual returns (bool);

    function _mint(
        bytes32 node,
        address newOwner,
        uint32 fuses,
        uint64 expiry
    ) internal virtual {
        uint256 tokenId = uint256(node);
        address owner = ownerOf(tokenId);
        require(owner == address(0), "ERC1155: mint of existing token");
        require(newOwner != address(0), "ERC1155: mint to the zero address");
        require(
            newOwner != address(this),
            "ERC1155: newOwner cannot be the NameWrapper contract"
        );

        _setData(tokenId, newOwner, fuses, expiry);
        emit TransferSingle(msg.sender, address(0x0), newOwner, tokenId, 1);
        _doSafeTransferAcceptanceCheck(
            msg.sender,
            address(0),
            newOwner,
            tokenId,
            1,
            ""
        );
    }

    function _burn(uint256 tokenId) internal virtual {
        address owner = ownerOf(tokenId);
        // Clear fuses and set owner to 0
        _setData(tokenId, address(0x0), 0, 0);
        emit TransferSingle(msg.sender, owner, address(0x0), tokenId, 1);
    }

    function _transfer(
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) internal {
        (address oldOwner, uint32 fuses, uint64 expiry) = getData(id);
        if (oldOwner == to) {
            return;
        }

        if (!_canTransfer(fuses)) {
            revert OperationProhibited(bytes32(id));
        }

        require(
            amount == 1 && oldOwner == from,
            "ERC1155: insufficient balance for transfer"
        );
        _setData(id, to, fuses, expiry);

        emit TransferSingle(msg.sender, from, to, id, amount);

        _doSafeTransferAcceptanceCheck(msg.sender, from, to, id, amount, data);
    }

    function _doSafeTransferAcceptanceCheck(
        address operator,
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) private {
        if (to.isContract()) {
            try
                IERC1155Receiver(to).onERC1155Received(
                    operator,
                    from,
                    id,
                    amount,
                    data
                )
            returns (bytes4 response) {
                if (
                    response != IERC1155Receiver(to).onERC1155Received.selector
                ) {
                    revert("ERC1155: ERC1155Receiver rejected tokens");
                }
            } catch Error(string memory reason) {
                revert(reason);
            } catch {
                revert("ERC1155: transfer to non ERC1155Receiver implementer");
            }
        }
    }

    function _doSafeBatchTransferAcceptanceCheck(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) private {
        if (to.isContract()) {
            try
                IERC1155Receiver(to).onERC1155BatchReceived(
                    operator,
                    from,
                    ids,
                    amounts,
                    data
                )
            returns (bytes4 response) {
                if (
                    response !=
                    IERC1155Receiver(to).onERC1155BatchReceived.selector
                ) {
                    revert("ERC1155: ERC1155Receiver rejected tokens");
                }
            } catch Error(string memory reason) {
                revert(reason);
            } catch {
                revert("ERC1155: transfer to non ERC1155Receiver implementer");
            }
        }
    }
}
