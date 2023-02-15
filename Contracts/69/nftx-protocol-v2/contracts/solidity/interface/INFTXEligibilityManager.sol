// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface INFTXEligibilityManager {
    function nftxVaultFactory() external returns (address);
    function eligibilityImpl() external returns (address);

    function deployEligibility(uint256 vaultId, bytes calldata initData)
        external
        returns (address);
}
