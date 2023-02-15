// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

interface IRoyaltyVault {
    function getSplitter() external view returns (address);

    function getVaultBalance() external view returns (uint256);

    function sendToSplitter() external;

    function setPlatformFee(uint256 _platformFee) external;

    function setPlatformFeeRecipient(address _platformFeeRecipient) external;

    function supportsInterface(bytes4 _interfaceId)
        external
        view
        returns (bool);
}
