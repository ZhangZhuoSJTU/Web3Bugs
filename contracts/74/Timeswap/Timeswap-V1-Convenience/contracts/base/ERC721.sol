// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

import {IERC721Extended} from '../interfaces/IERC721Extended.sol';
import {IERC721Receiver} from '@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol';

abstract contract ERC721 is IERC721Extended {
    bytes4 private constant _INTERFACE_ID_ERC165 = 0x01ffc9a7;
    bytes4 private constant _INTERFACE_ID_ERC721 = 0x80ac58cd;

    mapping(address => uint256) public override balanceOf;
    mapping(uint256 => address) public override ownerOf;
    mapping(uint256 => address) public override getApproved;
    mapping(address => mapping(address => bool)) public override isApprovedForAll;

    function supportsInterface(bytes4 interfaceID) external pure override returns (bool) {
        return interfaceID == _INTERFACE_ID_ERC165 || interfaceID == _INTERFACE_ID_ERC721;
    }

    modifier isApproved(address owner, uint256 id) {
        require(
            owner == msg.sender || getApproved[id] == msg.sender || isApprovedForAll[owner][msg.sender],
            'Forrbidden'
        );
        _;
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 id
    ) external override isApproved(from, id) {
        _safeTransfer(from, to, id, '');
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 id,
        bytes memory data
    ) external override isApproved(from, id) {
        _safeTransfer(from, to, id, data);
    }

    function transferFrom(
        address from,
        address to,
        uint256 id
    ) external override isApproved(from, id) {
        _transfer(from, to, id);
    }

    function approve(address to, uint256 id) external override {
        address owner = ownerOf[id];
        require(
            owner == msg.sender || isApprovedForAll[owner][msg.sender],
            'ERC721 :: approve : Approve caller is not owner nor approved for all'
        );
        require(to != owner, 'E605');

        _approve(to, id);
    }

    function setApprovalForAll(address operator, bool approved) external override {
        require(operator != msg.sender, 'E607');

        _setApprovalForAll(operator, approved);
    }

    function _safeTransfer(
        address from,
        address to,
        uint256 id,
        bytes memory data
    ) private {
        _transfer(from, to, id);

        require(_checkOnERC721Received(from, to, id, data), 'E608');
    }

    function _approve(address to, uint256 id) internal {
        getApproved[id] = to;

        emit Approval(ownerOf[id], to, id);
    }

    function _setApprovalForAll(address operator, bool approved) private {
        isApprovedForAll[msg.sender][operator] = approved;

        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function _safeMint(address to, uint256 id) internal {
        _mint(to, id);

        require(
            _checkOnERC721Received(address(0), to, id, ''),
            'ERC721 :: _safeMint : Transfer to non ERC721Receiver implementer'
        );
    }

    function _mint(address to, uint256 id) private {
        require(to != address(0), 'E601');
        require(ownerOf[id] == address(0), 'E604');

        balanceOf[to]++;
        ownerOf[id] = to;

        emit Transfer(address(0), to, id);
    }

    function _transfer(
        address from,
        address to,
        uint256 id
    ) private {
        require(to != address(0), 'E601');

        ownerOf[id] = to;
        balanceOf[from]--;
        balanceOf[to]++;

        _approve(address(0), id);

        emit Transfer(from, to, id);
    }

    function _checkOnERC721Received(
        address from,
        address to,
        uint256 id,
        bytes memory data
    ) private returns (bool) {
        uint256 size;
        assembly {
            size := extcodesize(to)
        }
        if (size == 0) {
            return true;
        } else {
            bytes memory returnData;
            (bool success, bytes memory _return) = to.call(
                abi.encodeWithSelector(IERC721Receiver(to).onERC721Received.selector, msg.sender, from, id, data)
            );
            if (success) {
                returnData = _return;
            } else if (_return.length > 0) {
                assembly {
                    let returnDataSize := mload(_return)
                    revert(add(32, _return), returnDataSize)
                }
            } else {
                revert('ERC721 :: _checkOnERC721Received : Transfer to non ERC721Receiver implementer');
            }
            bytes4 retval = abi.decode(returnData, (bytes4));
            return (retval == 0x150b7a02);
        }
    }
}
