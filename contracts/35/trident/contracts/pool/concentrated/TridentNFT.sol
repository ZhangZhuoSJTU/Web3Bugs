// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity >=0.8.0;

/// @notice Trident Concentrated Liquidity Pool ERC-721 implementation with ERC-20/EIP-2612-like extensions,
// as well as partially, MetaData and Enumerable extensions.
/// @author Adapted from RariCapital, https://github.com/Rari-Capital/solmate/blob/main/src/erc721/ERC721.sol,
// License-Identifier: AGPL-3.0-only, and Shoyu, https://github.com/sushiswap/shoyu/blob/master/contracts/base/BaseNFT721.sol,
// License-Identifier: MIT.
abstract contract TridentNFT {
    event Transfer(address indexed sender, address indexed recipient, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed spender, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);

    string public constant name = "TridentNFT";
    string public constant symbol = "tNFT";
    /// @notice Tracks total liquidity range positions.
    uint256 public totalSupply;
    /// @notice 'owner' -> balance mapping.
    mapping(address => uint256) public balanceOf;
    /// @notice `tokenId` -> 'owner' mapping.
    mapping(uint256 => address) public ownerOf;
    /// @notice `tokenId` -> 'spender' mapping.
    mapping(uint256 => address) public getApproved;
    /// @notice 'owner' -> 'operator' status mapping.
    mapping(address => mapping(address => bool)) public isApprovedForAll;

    /// @notice EIP-712 typehash for this contract's {permit} struct for {approve}.
    bytes32 public constant PERMIT_TYPEHASH = keccak256("Permit(address spender,uint256 tokenId,uint256 nonce,uint256 deadline)");
    /// @notice EIP-712 typehash for this contract's {permitAll} struct for {setApprovalForAll}.
    bytes32 public constant PERMIT_ALL_TYPEHASH = keccak256("Permit(address owner,address spender,uint256 nonce,uint256 deadline)");

    /// @notice Chain Id at this contract's deployment.
    uint256 internal immutable DOMAIN_SEPARATOR_CHAIN_ID;
    /// @notice EIP-712 typehash for this contract's domain at deployment.
    bytes32 internal immutable _DOMAIN_SEPARATOR;
    /// @notice 'tokenId' -> `nonce` mapping used in {permit} for {approve}.
    mapping(uint256 => uint256) public nonces;
    /// @notice 'owner' -> `tokenId` mapping used in {permitAll} for {setApprovalForAll}.
    mapping(address => uint256) public noncesForAll;

    constructor() {
        DOMAIN_SEPARATOR_CHAIN_ID = block.chainid;
        _DOMAIN_SEPARATOR = _calculateDomainSeparator();
    }

    function _calculateDomainSeparator() internal view returns (bytes32 domainSeperator) {
        domainSeperator = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes(name)),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    /// @notice EIP-712 typehash for this contract's domain.
    function DOMAIN_SEPARATOR() public view returns (bytes32 domainSeperator) {
        domainSeperator = block.chainid == DOMAIN_SEPARATOR_CHAIN_ID ? _DOMAIN_SEPARATOR : _calculateDomainSeparator();
    }

    /// @notice Provides ERC-165-compatible confirmation for ERC-721 interfaces supported by this contract.
    /// @param interfaceId XOR of all function selectors in the reference interface.
    /// @return supported Returns 'true' if `interfaceId` is flagged as implemented.
    function supportsInterface(bytes4 interfaceId) external pure returns (bool supported) {
        supported = interfaceId == 0x80ac58cd || interfaceId == 0x5b5e139f;
    }

    /// @notice Approves `tokenId` from `msg.sender` 'owner' or 'operator' to be spent by `spender`.
    /// @param spender Address of the party that can pull `tokenId` from 'owner''s account.
    /// @param tokenId The Id to approve for `spender`.
    function approve(address spender, uint256 tokenId) external {
        address owner = ownerOf[tokenId];
        require(msg.sender == owner || isApprovedForAll[owner][msg.sender], "NOT_APPROVED");
        getApproved[tokenId] = spender;
        emit Approval(owner, spender, tokenId);
    }

    /// @notice Approves an 'operator' for `msg.sender` 'owner' that can spend or {approve} spends of 'owner''s `tokenId`s.
    /// @param operator Address of the party that can pull `tokenId`s from 'owner''s account or approve others to do same.
    /// @param approved The approval status of `operator`.
    function setApprovalForAll(address operator, bool approved) external {
        isApprovedForAll[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    /// @notice Transfers `tokenId` from 'owner' to `recipient`. Caller needs ownership.
    /// @param recipient The address to move `tokenId` to.
    /// @param tokenId The Id to move.
    function transfer(address recipient, uint256 tokenId) external {
        require(msg.sender == ownerOf[tokenId], "NOT_OWNER");
        /// @dev This is safe from under/overflow -
        // ownership is checked against decrement,
        // and sum of all user balances can't reasonably exceed type(uint256).max (see {_mint}).
        unchecked {
            balanceOf[msg.sender]--;
            balanceOf[recipient]++;
        }
        delete getApproved[tokenId];
        ownerOf[tokenId] = recipient;
        emit Transfer(msg.sender, recipient, tokenId);
    }

    /// @notice Transfers `tokenId` from 'owner' to `recipient`. Caller needs ownership or approval from 'owner'.
    /// @param recipient The address to move `tokenId` to.
    /// @param tokenId The Id to move.
    function transferFrom(
        address,
        address recipient,
        uint256 tokenId
    ) public {
        address owner = ownerOf[tokenId];
        require(msg.sender == owner || msg.sender == getApproved[tokenId] || isApprovedForAll[owner][msg.sender], "NOT_APPROVED");
        /// @dev This is safe from under/overflow -
        // ownership is checked against decrement,
        // and sum of all user balances can't reasonably exceed type(uint256).max (see {_mint}).
        unchecked {
            balanceOf[owner]--;
            balanceOf[recipient]++;
        }
        delete getApproved[tokenId];
        ownerOf[tokenId] = recipient;
        emit Transfer(owner, recipient, tokenId);
    }

    /// @notice Transfers `tokenId` from 'owner' to `recipient` with no data. Caller needs ownership or approval from 'owner',
    /// and `recipient` must have compatible {onERC721Received} function.
    /// @param recipient The address to move `tokenId` to.
    /// @param tokenId The Id to move.
    function safeTransferFrom(
        address,
        address recipient,
        uint256 tokenId
    ) external {
        safeTransferFrom(address(0), recipient, tokenId, "");
    }

    /// @notice Transfers `tokenId` from 'owner' to `recipient` with data. Caller needs ownership or approval from 'owner',
    /// and `recipient` must have compatible {onERC721Received} function.
    /// @param recipient The address to move `tokenId` to.
    /// @param tokenId The Id to move.
    function safeTransferFrom(
        address,
        address recipient,
        uint256 tokenId,
        bytes memory data
    ) public {
        transferFrom(address(0), recipient, tokenId);
        if (recipient.code.length != 0) {
            /// @dev `onERC721Received(address,address,uint,bytes)`.
            (, bytes memory returned) = recipient.staticcall(abi.encodeWithSelector(0x150b7a02, msg.sender, address(0), tokenId, data));
            bytes4 selector = abi.decode(returned, (bytes4));
            require(selector == 0x150b7a02, "NOT_ERC721_RECEIVER");
        }
    }

    /// @notice Triggers an approval from 'owner' to `spender` for a given `tokenId`.
    /// @param spender The address to be approved.
    /// @param tokenId The Id that is approved for `spender`.
    /// @param deadline The time at which to expire the signature.
    /// @param v The recovery byte of the signature.
    /// @param r Half of the ECDSA signature pair.
    /// @param s Half of the ECDSA signature pair.
    function permit(
        address spender,
        uint256 tokenId,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        require(deadline >= block.timestamp, "PERMIT_DEADLINE_EXPIRED");
        address owner = ownerOf[tokenId];
        /// @dev This is reasonably safe from overflow - incrementing `nonces` beyond
        // 'type(uint256).max' is exceedingly unlikely compared to optimization benefits.
        unchecked {
            bytes32 digest = keccak256(
                abi.encodePacked(
                    "\x19\x01",
                    DOMAIN_SEPARATOR(),
                    keccak256(abi.encode(PERMIT_TYPEHASH, spender, tokenId, nonces[tokenId]++, deadline))
                )
            );
            address recoveredAddress = ecrecover(digest, v, r, s);
            require(
                (recoveredAddress != address(0) && recoveredAddress == owner) || isApprovedForAll[owner][recoveredAddress],
                "INVALID_PERMIT_SIGNATURE"
            );
        }
        getApproved[tokenId] = spender;
        emit Approval(owner, spender, tokenId);
    }

    /// @notice Triggers an approval from 'owner' to `operator` that can spend or {approve} spends of 'owner''s `tokenId`s.
    /// @param owner The address to be approved.
    /// @param operator Address of the party that can pull `tokenId`s from 'owner''s account or approve others to do same.
    /// @param deadline The time at which to expire the signature.
    /// @param v The recovery byte of the signature.
    /// @param r Half of the ECDSA signature pair.
    /// @param s Half of the ECDSA signature pair.
    function permitAll(
        address owner,
        address operator,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        require(deadline >= block.timestamp, "PERMIT_DEADLINE_EXPIRED");
        /// @dev This is reasonably safe from overflow - incrementing `nonces` beyond
        // 'type(uint256).max' is exceedingly unlikely compared to optimization benefits.
        unchecked {
            bytes32 digest = keccak256(
                abi.encodePacked(
                    "\x19\x01",
                    DOMAIN_SEPARATOR(),
                    keccak256(abi.encode(PERMIT_ALL_TYPEHASH, owner, operator, noncesForAll[owner]++, deadline))
                )
            );
            address recoveredAddress = ecrecover(digest, v, r, s);
            require(
                (recoveredAddress != address(0) && recoveredAddress == owner) || isApprovedForAll[owner][recoveredAddress],
                "INVALID_PERMIT_SIGNATURE"
            );
        }
        isApprovedForAll[owner][operator] = true;
        emit ApprovalForAll(owner, operator, true);
    }

    function _mint(address recipient) internal {
        /// @dev This is reasonably safe from overflow - incrementing beyond
        // 'type(uint256).max' is exceedingly unlikely compared to optimization benefits.
        unchecked {
            uint256 tokenId = totalSupply++;
            require(ownerOf[tokenId] == address(0), "ALREADY_MINTED");
            balanceOf[recipient]++;
            ownerOf[tokenId] = recipient;
            emit Transfer(address(0), recipient, tokenId);
        }
    }

    function _burn(uint256 tokenId) internal {
        address owner = ownerOf[tokenId];
        require(owner != address(0), "NOT_MINTED");
        /// @dev This is safe from underflow - balance of any 'owner' is greater than 0.
        unchecked {
            balanceOf[owner]--;
        }
        delete ownerOf[tokenId];
        emit Transfer(owner, address(0), tokenId);
    }
}
