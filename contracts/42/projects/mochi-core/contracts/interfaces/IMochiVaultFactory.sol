// SPDX-License-Identifier: AGPL-3.0

pragma solidity ^0.8.0;

import "./IMochiVault.sol";

interface IMochiVaultFactory {
    function updateTemplate(address _template) external;

    function deployVault(address _asset) external returns (IMochiVault);

    function getVault(address _asset) external view returns (IMochiVault);
}
