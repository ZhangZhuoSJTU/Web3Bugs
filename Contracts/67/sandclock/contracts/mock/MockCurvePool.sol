// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.10;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../strategy/curve/ICurve.sol";

contract MockCurvePool is ICurve {
    using SafeERC20 for IERC20;

    mapping(int128 => IERC20) public tokens;
    mapping(int128 => mapping(int128 => uint256)) public rate;

    function addToken(int128 i, IERC20 token) external {
        tokens[i] = token;
    }

    function updateRate(
        int128 i,
        int128 j,
        uint256 _rate
    ) external {
        rate[i][j] = _rate;
    }

    function exchange_underlying(
        int128 i,
        int128 j,
        uint256 dx,
        uint256 min_dy
    ) external override returns (uint256) {
        tokens[i].safeTransferFrom(msg.sender, address(this), dx);
        uint256 amount = (dx * 1e18) / rate[i][j];
        tokens[j].safeTransfer(msg.sender, amount);
        require(amount >= min_dy);
        return amount;
    }

    function get_dy_underlying(
        int128 i,
        int128 j,
        uint256 dx
    ) external view override returns (uint256) {
        return (dx * 1e18) / rate[i][j];
    }
}
