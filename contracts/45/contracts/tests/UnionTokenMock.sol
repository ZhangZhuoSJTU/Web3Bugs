//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20VotesComp.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

/**
 * @title UnionToken Contract
 * @dev Mint and distribute UnionTokens.
 */
contract UnionTokenMock is ERC20VotesComp, ERC20Burnable {
    //The EIP-712 typehash for the contract's domain
    bytes32 public constant DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,uint256 chainId,address verifyingContract)");

    //The EIP-712 typehash for the delegation struct used by the contract
    bytes32 public constant DELEGATION_TYPEHASH =
        keccak256("Delegation(address delegatee,uint256 nonce,uint256 expiry)");

    bytes32 public constant PERMIT_TYPEHASH =
        keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)");

    /// @notice Minimum time between mints
    uint256 public constant minimumTimeBetweenMints = 1 days * 365;

    /// @notice The timestamp after which minting may occur
    uint256 public mintingAllowedAfter;

    uint256 public constant INIT_CIRCULATING = 100000000 * 10**18;

    /// @notice Cap on the percentage of totalSupply that can be minted at each mint
    uint256 public constant mintCap = 4;

    constructor(string memory name, string memory symbol) ERC20(name, symbol) ERC20Permit(name) {
        if (balanceOf(msg.sender) == 0) {
            _mint(msg.sender, INIT_CIRCULATING);
        }
    }

    function mint(address dst, uint256 amount) external returns (bool) {
        require(amount <= (totalSupply() * mintCap) / 100, "exceeded mint cap");

        _mint(dst, amount);

        return true;
    }

    function _mint(address account, uint256 amount) internal override(ERC20, ERC20Votes) {
        super._mint(account, amount);
        require(block.timestamp >= mintingAllowedAfter, "minting not allowed yet");

        // record the mint
        mintingAllowedAfter = minimumTimeBetweenMints + block.timestamp;
    }

    function _burn(address account, uint256 amount) internal override(ERC20, ERC20Votes) {
        super._burn(account, amount);
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override {
        super._beforeTokenTransfer(from, to, amount);
    }

    function _afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override(ERC20, ERC20Votes) {
        super._afterTokenTransfer(from, to, amount);
    }
}
