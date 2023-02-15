// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.10;

/**
 * @title IIntegration interface
 *
 * Integrations act as claimers for IVault contracts, and process funds on
 * behalf of their final beneficiaries
 */
interface IIntegration {
    /**
     * Called when a new deposit is created is created for which this contract is the beneficiary
     *
     * @notice msg.sender will be the IVault instance
     *
     * @param _depositID new deposit ID
     * @param _shares The amount of shares assigned to this deposit
     * @param _data Additional data with no specified format
     * @return `bytes4(keccak256("onDepositMinted(uint256,uint256,bytes)"))` unless throwing
     */
    function onDepositMinted(
        uint256 _depositID,
        uint256 _shares,
        bytes memory _data
    ) external returns (bytes4);

    /**
     * Called when an existing deposit is withdrawn
     *
     * @notice msg.sender will be the IVault instance
     *
     * @param _depositID claim ID
     * @return `bytes4(keccak256("onDepositBurned(uint256)"))` unless throwing
     */
    function onDepositBurned(uint256 _depositID) external returns (bytes4);
}
