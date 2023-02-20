// SPDX-License-Identifier: MIT
pragma solidity =0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IYearnVault is IERC20 {
    function decimals() external view returns (uint256);

    function pricePerShare() external view returns (uint256);

    function deposit(uint256 amount, address recipient) external returns (uint256);

    // Default maxLoss = 1, i.e. 0.01% [BPS]
    function withdraw(
        uint256 maxShares,
        address recipient,
        uint256 maxLoss
    ) external returns (uint256);
}
