// SPDX-License-Identifier: AGPLv3
pragma solidity >=0.6.0 <0.7.0;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "../interfaces/IBuoy.sol";
import "../interfaces/IERC20Detailed.sol";
import {ICurve3Pool} from "../interfaces/ICurve.sol";
import "../common/Whitelist.sol";
import "../common/Constants.sol";

/// @notice Contract for calculating prices of underlying
///     assets and LP tokens in curvepool. Also used to
///     Sanity check pool against external oracle to ensure
///     that pool is healthy by checking pool underlying coin
///     ratios against oracle coin price ratios
contract MockBuoy is IBuoy, IChainPrice, Whitelist, Constants {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    address[] public stablecoins;
    ICurve3Pool public override curvePool;

    uint256 constant vp = 1005330723799997871;
    uint256[] public decimals = [18, 6, 6];
    uint256[] vpSingle = [996343755718242128, 994191500557422927, 993764724471177721];
    uint256[] chainPrices = [10001024, 100000300, 99998869];
    uint256[] public balanced = [30, 30, 40];

    function setStablecoins(address[] calldata _stablecoins) external {
        stablecoins = _stablecoins;
    }

    function lpToUsd(uint256 inAmount) external view override returns (uint256) {
        return _lpToUsd(inAmount);
    }

    function _lpToUsd(uint256 inAmount) private view returns (uint256) {
        return inAmount.mul(vp).div(DEFAULT_DECIMALS_FACTOR);
    }

    function usdToLp(uint256 inAmount) public view override returns (uint256) {
        return inAmount.mul(DEFAULT_DECIMALS_FACTOR).div(vp);
    }

    function stableToUsd(uint256[3] calldata inAmounts, bool _deposit) external view override returns (uint256) {
        return _stableToUsd(inAmounts, _deposit);
    }

    function _stableToUsd(uint256[3] memory inAmounts, bool _deposit) private view returns (uint256) {
        uint256 lp = _stableToLp(inAmounts, _deposit);
        return _lpToUsd(lp);
    }

    function stableToLp(uint256[3] calldata inAmounts, bool _deposit) external view override returns (uint256) {
        return _stableToLp(inAmounts, _deposit);
    }

    function _stableToLp(uint256[3] memory inAmounts, bool deposit) private view returns (uint256) {
        deposit;
        uint256 totalAmount;
        for (uint256 i = 0; i < vpSingle.length; i++) {
            totalAmount = totalAmount.add(inAmounts[i].mul(vpSingle[i]).div(10**decimals[i]));
        }
        return totalAmount;
    }

    function singleStableFromLp(uint256 inAmount, int128 i) external view override returns (uint256) {
        return _singleStableFromLp(inAmount, uint256(i));
    }

    function _singleStableFromLp(uint256 inAmount, uint256 i) private view returns (uint256) {
        return inAmount.mul(10**18).div(vpSingle[i]).div(10**(18 - decimals[i]));
    }

    function singleStableToUsd(uint256 inAmount, uint256 i) external view override returns (uint256) {
        uint256[3] memory inAmounts;
        inAmounts[i] = inAmount;
        return _stableToUsd(inAmounts, true);
    }

    function singleStableFromUsd(uint256 inAmount, int128 i) external view override returns (uint256) {
        return _singleStableFromLp(usdToLp(inAmount), uint256(i));
    }

    function getRatio(uint256 token0, uint256 token1) external view returns (uint256, uint256) {}

    function safetyCheck() external view override returns (bool) {
        return true;
    }

    function getVirtualPrice() external view override returns (uint256) {
        return vp;
    }

    function updateRatios() external override returns (bool) {}

    function updateRatiosWithTolerance(uint256 tolerance) external override returns (bool) {}

    function getPriceFeed(uint256 i) external view override returns (uint256 _price) {
        return chainPrices[i];
    }
}
