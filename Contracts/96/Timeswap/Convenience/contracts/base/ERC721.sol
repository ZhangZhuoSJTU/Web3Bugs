// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

import {IERC721Extended} from '../interfaces/IERC721Extended.sol';
import {IERC721Receiver} from '@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol';

abstract contract ERC721 is IERC721Extended {
    bytes4 private constant _INTERFACE_ID_ERC165 = 0x01ffc9a7;
    bytes4 private constant _INTERFACE_ID_ERC721 = 0x80ac58cd;
    bytes4 private constant _INTERFACE_ID_ERC721METADATA = 0x5b5e139f;
    bytes4 private constant _INTERFACE_ID_ERC721ENUMERABLE = 0x780e9d63;

    mapping(address => uint256) private _balances;
    mapping(uint256 => address) internal _owners;
    mapping(uint256 => address) private _tokenApprovals;
    mapping(address => mapping(address => bool)) private _operatorApprovals;
    mapping(address => mapping(uint256 => uint256)) private _ownedTokens;
    mapping(uint256 => uint256) private _ownedTokensIndex;

    function balanceOf(address owner) external view override returns (uint256) {
        require(owner != address(0), 'E613');
        return _balances[owner];
    }

    function ownerOf(uint256 id) external view override returns (address) {
        address owner = _owners[id];
        require(owner != address(0), 'E613');
        return owner;
    }

    function getApproved(uint256 id) external view override returns (address) {
        require(_owners[id] != address(0), 'E614');
        return _tokenApprovals[id];
    }

    function isApprovedForAll(address owner, address operator) external view override returns (bool) {
        return _operatorApprovals[owner][operator];
    }

    function tokenOfOwnerByIndex(address owner, uint256 id) external view override returns (uint256) {
        require(id < _balances[owner], 'E614');
        return _ownedTokens[owner][id];
    }

    function supportsInterface(bytes4 interfaceID) external pure override returns (bool) {
        return
            interfaceID == _INTERFACE_ID_ERC165 ||
            interfaceID == _INTERFACE_ID_ERC721 ||
            interfaceID == _INTERFACE_ID_ERC721METADATA ||
            interfaceID == _INTERFACE_ID_ERC721ENUMERABLE;
    }

    modifier isApproved(address owner, uint256 id) {
        require(
            owner == msg.sender || _tokenApprovals[id] == msg.sender || _operatorApprovals[owner][msg.sender],
            '611'
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
        address owner = _owners[id];
        require(owner == msg.sender || _operatorApprovals[owner][msg.sender], '609');
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
        _tokenApprovals[id] = to;

        emit Approval(_owners[id], to, id);
    }

    function _setApprovalForAll(address operator, bool approved) private {
        _operatorApprovals[msg.sender][operator] = approved;

        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function _safeMint(address to, uint256 id) internal {
        _mint(to, id);

        require(_checkOnERC721Received(address(0), to, id, ''), 'E610');
    }

    function _mint(address to, uint256 id) private {
        require(to != address(0), 'E601');
        require(_owners[id] == address(0), 'E604');

        uint256 length = _balances[to];
        _ownedTokens[to][length] = id;
        _ownedTokensIndex[id] = length;

        _balances[to]++;
        _owners[id] = to;

        emit Transfer(address(0), to, id);
    }

    function _transfer(
        address from,
        address to,
        uint256 id
    ) private {
        require(to != address(0), 'E601');

        if (from != to) {
            uint256 lastTokenIndex = _balances[from] - 1;
            uint256 tokenIndex = _ownedTokensIndex[id];

            if (lastTokenIndex != tokenIndex) {
                uint256 lastTokenId = _ownedTokens[from][lastTokenIndex];

                _ownedTokens[from][tokenIndex] = lastTokenId;
                _ownedTokensIndex[lastTokenId] = tokenIndex;
            }

            delete _ownedTokens[from][lastTokenIndex];

            uint256 length = _balances[to];
            _ownedTokens[to][length] = id;
            _ownedTokensIndex[id] = length;
        }

        _owners[id] = to;
        _balances[from]--;
        _balances[to]++;

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
            } else if (_return.length != 0) {
                assembly {
                    let returnDataSize := mload(_return)
                    revert(add(32, _return), returnDataSize)
                }
            } else {
                revert('E610');
            }
            bytes4 retval = abi.decode(returnData, (bytes4));
            return (retval == 0x150b7a02);
        }
    }
}
