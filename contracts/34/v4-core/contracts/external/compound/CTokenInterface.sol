// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface CTokenInterface is IERC20 {
    function decimals() external view returns (uint8);

    function totalSupply() external view override returns (uint256);

    function underlying() external view returns (address);

    function balanceOfUnderlying(address owner) external returns (uint256);

    function supplyRatePerBlock() external returns (uint256);

    function exchangeRateCurrent() external returns (uint256);

    function mint(uint256 mintAmount) external returns (uint256);

    function redeem(uint256 amount) external returns (uint256);

    function balanceOf(address user) external view override returns (uint256);

    function redeemUnderlying(uint256 redeemAmount) external returns (uint256);
}
