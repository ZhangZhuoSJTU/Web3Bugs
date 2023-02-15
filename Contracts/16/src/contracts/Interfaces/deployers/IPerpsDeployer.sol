//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

interface IPerpsDeployer {
    function deploy(bytes calldata _data) external returns (address);
}
