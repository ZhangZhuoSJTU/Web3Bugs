//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

/**
 * @title UnionToken Interface
 * @dev Mint and distribute UnionTokens.
 */
interface IUnionToken {
    /**
     *  @dev Get total supply
     *  @return Total supply
     */
    function totalSupply() external view returns (uint256);

    function balanceOf(address account) external view returns (uint256);

    function transfer(address recipient, uint256 amount) external returns (bool);

    function mint(address account, uint256 amount) external returns (bool);

    /**
     *  @dev Determine the prior number of votes for an account as of a block number. Block number must be a finalized block or else this function will revert to prevent misinformation.
     *  @param account The address of the account to check
     *  @param blockNumber The block number to get the vote balance at
     *  @return The number of votes the account had as of the given block
     */
    function getPriorVotes(address account, uint256 blockNumber) external view returns (uint256);

    /**
     *  @dev Allows to spend owner's Union tokens by the specified spender.
     *  The function can be called by anyone, but requires having allowance parameters
     *  signed by the owner according to EIP712.
     *  @param owner The owner's address, cannot be zero address.
     *  @param spender The spender's address, cannot be zero address.
     *  @param value The allowance amount, in wei.
     *  @param deadline The allowance expiration date (unix timestamp in UTC).
     *  @param v A final byte of signature (ECDSA component).
     *  @param r The first 32 bytes of signature (ECDSA component).
     *  @param s The second 32 bytes of signature (ECDSA component).
     */
    function permit(
        address owner,
        address spender,
        uint256 value,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;

    function burnFrom(address account, uint256 amount) external;
}
