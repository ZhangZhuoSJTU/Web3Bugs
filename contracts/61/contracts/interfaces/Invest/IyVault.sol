// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

interface IyVault {
    function earn() external;

    function depositAll() external;

    function deposit(uint256 _amount) external;

    function depositETH() external payable;

    function withdrawAll() external;

    function withdrawAllETH() external;

    function harvest(address reserve, uint256 amount) external;

    function withdraw(uint256 _shares) external;

    function withdrawETH(uint256 _shares) external;

    function getPricePerFullShare() external view returns (uint256);

    function balanceOf(address) external view returns (uint256);

    function setMin(uint256) external;

    function min() external returns (uint256);
}
