// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

import {EIP712} from '@openzeppelin/contracts/utils/cryptography/draft-EIP712.sol';
import {IERC721Permit} from '../interfaces/IERC721Permit.sol';
import {ERC721} from './ERC721.sol';
import {IERC721Permit} from '../interfaces/IERC721Permit.sol';
import {Counters} from '@openzeppelin/contracts/utils/Counters.sol';
import {ECDSA} from '@openzeppelin/contracts/utils/cryptography/ECDSA.sol';

abstract contract ERC721Permit is IERC721Permit, ERC721, EIP712 {
    using Counters for Counters.Counter;

    mapping(uint256 => Counters.Counter) private _nonces;

    bytes32 public immutable _PERMIT_TYPEHASH =
        keccak256('Permit(address spender,uint256 tokenId,uint256 nonce,uint256 deadline)');

    constructor(string memory name) EIP712(name, '1') {}

    /// @inheritdoc IERC721Permit
    function permit(
        address spender,
        uint256 tokenId,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external override {
        address owner = ownerOf[tokenId];

        require(block.timestamp <= deadline, 'E602');

        bytes32 structHash = keccak256(abi.encode(_PERMIT_TYPEHASH, spender, tokenId, _useNonce(tokenId), deadline));

        bytes32 hash = _hashTypedDataV4(structHash);

        address signer = ECDSA.recover(hash, v, r, s);
        require(signer != address(0), 'E606');
        require(signer == owner, 'E603');
        require(spender != owner, 'E605');

        _approve(spender, tokenId);
    }

    function nonces(uint256 tokenId) public view virtual returns (uint256) {
        return _nonces[tokenId].current();
    }

    function DOMAIN_SEPARATOR() external view override returns (bytes32) {
        return _domainSeparatorV4();
    }

    function _useNonce(uint256 tokenId) internal virtual returns (uint256 current) {
        Counters.Counter storage nonce = _nonces[tokenId];
        current = nonce.current();
        nonce.increment();
    }
}
