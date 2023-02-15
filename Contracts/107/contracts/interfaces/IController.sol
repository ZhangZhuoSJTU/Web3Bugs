// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

interface IController {
    function withdraw(address, uint256) external;

    function balanceOf(address) external view returns (uint256);

    function earn(address, uint256) external;

    function want(address) external view returns (address);

    function feeAddress() external view returns (address);

    function vaults(address) external view returns (address);

    function strategies(address) external view returns (address);

    function balanceOfJPEG(address strategyToken)
        external
        view
        returns (uint256);

    function withdrawJPEG(address strategyToken, address to) external;
}
