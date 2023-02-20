// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity >=0.8.0;

/// @notice Trident pool ERC-20 with EIP-2612 extension.
/// @author Adapted from RariCapital, https://github.com/Rari-Capital/solmate/blob/main/src/erc20/ERC20.sol,
/// License-Identifier: AGPL-3.0-only.
abstract contract TridentERC20 {
    event Transfer(address indexed sender, address indexed recipient, uint256 amount);
    event Approval(address indexed owner, address indexed spender, uint256 amount);

    string public constant name = "Sushi LP Token";
    string public constant symbol = "SLP";
    uint8 public constant decimals = 18;

    uint256 public totalSupply;
    /// @notice owner -> balance mapping.
    mapping(address => uint256) public balanceOf;
    /// @notice owner -> spender -> allowance mapping.
    mapping(address => mapping(address => uint256)) public allowance;

    /// @notice Chain Id at this contract's deployment.
    uint256 internal immutable DOMAIN_SEPARATOR_CHAIN_ID;
    /// @notice EIP-712 typehash for this contract's domain at deployment.
    bytes32 internal immutable _DOMAIN_SEPARATOR;
    /// @notice EIP-712 typehash for this contract's {permit} struct.
    bytes32 public constant PERMIT_TYPEHASH =
        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");
    /// @notice owner -> nonce mapping used in {permit}.
    mapping(address => uint256) public nonces;

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

    /// @notice Approves `amount` from `msg.sender` to be spent by `spender`.
    /// @param spender Address of the party that can pull tokens from `msg.sender`'s account.
    /// @param amount The maximum collective `amount` that `spender` can pull.
    /// @return (bool) Returns 'true' if succeeded.
    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    /// @notice Transfers `amount` tokens from `msg.sender` to `recipient`.
    /// @param recipient The address to move tokens to.
    /// @param amount The token `amount` to move.
    /// @return (bool) Returns 'true' if succeeded.
    function transfer(address recipient, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        // @dev This is safe from overflow - the sum of all user
        // balances can't exceed 'type(uint256).max'.
        unchecked {
            balanceOf[recipient] += amount;
        }
        emit Transfer(msg.sender, recipient, amount);
        return true;
    }

    /// @notice Transfers `amount` tokens from `sender` to `recipient`. Caller needs approval from `from`.
    /// @param sender Address to pull tokens `from`.
    /// @param recipient The address to move tokens to.
    /// @param amount The token `amount` to move.
    /// @return (bool) Returns 'true' if succeeded.
    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external returns (bool) {
        if (allowance[sender][msg.sender] != type(uint256).max) {
            allowance[sender][msg.sender] -= amount;
        }
        balanceOf[sender] -= amount;
        // @dev This is safe from overflow - the sum of all user
        // balances can't exceed 'type(uint256).max'.
        unchecked {
            balanceOf[recipient] += amount;
        }
        emit Transfer(sender, recipient, amount);
        return true;
    }

    /// @notice Triggers an approval from `owner` to `spender`.
    /// @param owner The address to approve from.
    /// @param spender The address to be approved.
    /// @param amount The number of tokens that are approved (2^256-1 means infinite).
    /// @param deadline The time at which to expire the signature.
    /// @param v The recovery byte of the signature.
    /// @param r Half of the ECDSA signature pair.
    /// @param s Half of the ECDSA signature pair.
    function permit(
        address owner,
        address spender,
        uint256 amount,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        require(deadline >= block.timestamp, "PERMIT_DEADLINE_EXPIRED");
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                DOMAIN_SEPARATOR(),
                keccak256(abi.encode(PERMIT_TYPEHASH, owner, spender, amount, nonces[owner]++, deadline))
            )
        );
        address recoveredAddress = ecrecover(digest, v, r, s);
        require(recoveredAddress != address(0) && recoveredAddress == owner, "INVALID_PERMIT_SIGNATURE");
        allowance[recoveredAddress][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    function _mint(address recipient, uint256 amount) internal {
        totalSupply += amount;
        // @dev This is safe from overflow - the sum of all user
        // balances can't exceed 'type(uint256).max'.
        unchecked {
            balanceOf[recipient] += amount;
        }
        emit Transfer(address(0), recipient, amount);
    }

    function _burn(address sender, uint256 amount) internal {
        balanceOf[sender] -= amount;
        // @dev This is safe from underflow - users won't ever
        // have a balance larger than `totalSupply`.
        unchecked {
            totalSupply -= amount;
        }
        emit Transfer(sender, address(0), amount);
    }
}
