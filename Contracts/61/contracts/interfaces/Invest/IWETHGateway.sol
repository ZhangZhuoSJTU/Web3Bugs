// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.7.6;

interface IWETHGateway {
    function depositETH(
        address lendingPool,
        address onBehalfOf,
        uint16 referralCode
    ) external payable;

    function withdrawETH(uint256 amount, address to) external;

    function getWETHAddress() external view returns (address);

    function getAWETHAddress() external view returns (address);

    function getLendingPoolAddress() external view returns (address);
}
