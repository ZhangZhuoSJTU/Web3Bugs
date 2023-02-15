// SPDX-License-Identifier: AGPLv3
pragma solidity >=0.6.0 <0.7.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "../interfaces/ILifeGuard.sol";
import "../interfaces/IController.sol";
import "../interfaces/IVault.sol";
import "../interfaces/IBuoy.sol";
import "../common/Constants.sol";
import "../common/Controllable.sol";

// LP -> Liquidity pool token
contract MockLifeGuard is Constants, Controllable, ILifeGuard {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    address[] public stablecoins;
    address public buoy;

    uint256 constant vp = 1005330723799997871;
    uint256[] public decimals = [18, 6, 6];
    uint256[] vpSingle = [996343755718242128, 994191500557422927, 993764724471177721];
    uint256[] public balanced = [30, 30, 40];
    uint256[] public inAmounts;

    uint256 private _totalAssets;
    uint256 private _totalAssetsUsd;
    uint256 private _depositStableAmount;

    mapping(uint256 => uint256) public override assets;

    function setDepositStableAmount(uint256 depositStableAmount) external {
        _depositStableAmount = depositStableAmount;
    }

    function setStablecoins(address[] calldata _stablecoins) external {
        stablecoins = _stablecoins;
    }

    function setBuoy(address _buoy) external {
        buoy = _buoy;
    }

    function totalAssets() external view override returns (uint256) {
        return usdToLp(_totalAssetsUsd);
    }

    function _stableToUsd(uint256[] memory inAmounts, bool _deposit) private view returns (uint256) {
        uint256 lp = _stableToLp(inAmounts, _deposit);
        return _lpToUsd(lp);
    }

    function stableToLp(uint256[] calldata inAmounts, bool _deposit) external view returns (uint256) {
        return _stableToLp(inAmounts, _deposit);
    }

    function _stableToLp(uint256[] memory inAmounts, bool _deposit) private view returns (uint256) {
        uint256 totalAmount;
        for (uint256 i = 0; i < vpSingle.length; i++) {
            totalAmount = totalAmount.add(inAmounts[i].mul(vpSingle[i]).div(10**decimals[i]));
        }
        return totalAmount;
    }

    function singleStableFromLp(uint256 inAmount, uint256 i) external view returns (uint256) {
        return _singleStableFromLp(inAmount, i);
    }

    function _singleStableFromLp(uint256 inAmount, uint256 i) private view returns (uint256) {
        return inAmount.mul(10**decimals[i]).div(vpSingle[i]);
    }

    function underlyingCoins(uint256 index) external view returns (address coin) {
        return stablecoins[index];
    }

    function depositStable(bool curve) external override returns (uint256) {
        return _depositStableAmount;
    }

    function setInAmounts(uint256[] memory _inAmounts) external {
        inAmounts = _inAmounts;
    }

    function deposit() external override returns (uint256 usdAmount) {
        usdAmount = _stableToUsd(inAmounts, true);
        _totalAssetsUsd += usdAmount;
    }

    function withdraw(uint256 inAmount, address recipient)
        external
        returns (uint256 usdAmount, uint256[] memory amounts)
    {
        usdAmount = _lpToUsd(inAmount);
        if (_totalAssetsUsd > usdAmount) _totalAssetsUsd -= usdAmount;
        else _totalAssetsUsd = 0;
        amounts = new uint256[](3);
        address[N_COINS] memory vaults = _controller().vaults();
        for (uint256 i = 0; i < 3; i++) {
            uint256 lpAmount = inAmount.mul(balanced[i]).div(100);
            amounts[i] = _singleStableFromLp(lpAmount, i);
            IERC20 token = IERC20(IVault(vaults[i]).token());
            if (token.balanceOf(vaults[i]) > amounts[i]) token.transferFrom(vaults[i], recipient, amounts[i]);
        }
    }

    function withdrawSingleByLiquidity(
        uint256 i,
        uint256 minAmount,
        address recipient
    ) external override returns (uint256 usdAmount, uint256 amount) {
        usdAmount = _lpToUsd(inAmounts[0]);
        amount = _singleStableFromLp(inAmounts[0], i);
        address[N_COINS] memory vaults = _controller().vaults();
        IERC20 token = IERC20(IVault(vaults[i]).token());
        if (token.balanceOf(vaults[i]) > amount) token.transferFrom(vaults[i], recipient, amount);
    }

    function withdrawSingleByExchange(
        uint256 i,
        uint256 minAmount,
        address recipient
    ) external override returns (uint256 usdAmount, uint256 amount) {
        usdAmount = _lpToUsd(inAmounts[0]);
        amount = _singleStableFromLp(inAmounts[0], i);
        address[N_COINS] memory vaults = _controller().vaults();
        IERC20 token = IERC20(IVault(vaults[i]).token());
        if (token.balanceOf(vaults[i]) > amount) token.transferFrom(vaults[i], recipient, amount);
    }

    function invest(uint256 whaleDepositAmount, uint256[3] calldata delta) external override returns (uint256) {
        address[N_COINS] memory vaults = _controller().vaults();
        for (uint256 i; i < vaults.length; i++) {
            IERC20 token = IERC20(IVault(vaults[i]).token());
            token.transfer(vaults[i], token.balanceOf(address(this)));
        }
        _totalAssetsUsd -= whaleDepositAmount;
        return whaleDepositAmount;
    }

    function getEmergencyPrice(uint256 token) external view returns (uint256, uint256) {
        uint256 ratios = uint256(10)**decimals[token];
        uint256 decimals = uint256(10)**decimals[token];
        return (ratios, decimals);
    }

    function singleStableToUsd(uint256 inAmount, uint256 i) external view returns (uint256) {
        uint256[] memory inAmounts = new uint256[](stablecoins.length);
        inAmounts[i] = inAmount;
        return _stableToUsd(inAmounts, true);
    }

    function singleStableFromUsd(uint256 inAmount, uint256 i) public view returns (uint256) {
        return _singleStableFromLp(_lpToUsd(inAmount), i);
    }

    function _lpToUsd(uint256 inAmount) private pure returns (uint256) {
        return inAmount.mul(vp).div(DEFAULT_DECIMALS_FACTOR);
    }

    function usdToLp(uint256 inAmount) private view returns (uint256) {
        return inAmount.mul(DEFAULT_DECIMALS_FACTOR).div(vp);
    }

    function getBuoy() external view override returns (address) {
        return buoy;
    }

    address public exchanger;

    function setExchanger(address _exchanger) external {
        exchanger = _exchanger;
    }

    function investSingle(
        uint256[3] calldata inAmounts,
        uint256 i,
        uint256 j
    ) external override returns (uint256 dollarAmount) {
        dollarAmount = IBuoy(buoy).stableToUsd(inAmounts, true);
        for (uint256 k; k < 3; k++) {
            if (k == i || k == j) continue;
            uint256 inBalance = inAmounts[k];
            if (inBalance > 0) {
                _exchange(inBalance, k, i);
            }
        }
        if (inAmounts[i] > 0) {
            address vault = _controller().vaults()[i];
            IERC20 token = IERC20(IVault(vault).token());
            token.transfer(vault, token.balanceOf(address(this)));
        }
        if (inAmounts[j] > 0) {
            address vault = _controller().vaults()[j];
            IERC20 token = IERC20(IVault(vault).token());
            token.transfer(vault, token.balanceOf(address(this)));
        }
    }

    function _exchange(
        uint256 amount,
        uint256 src,
        uint256 dest
    ) private returns (uint256) {
        IERC20(stablecoins[src]).transfer(exchanger, amount);
        uint256 descAmount = amount.mul(10**decimals[dest]).div(10**decimals[src]);
        IERC20(stablecoins[dest]).transferFrom(exchanger, address(this), descAmount);
        return descAmount;
    }

    function availableLP() external view override returns (uint256) {}

    function availableUsd() external view override returns (uint256 dollar) {}

    function investToCurveVault() external override {}

    function distributeCurveVault(uint256 amount, uint256[3] memory delta)
        external
        override
        returns (uint256[3] memory)
    {}

    function totalAssetsUsd() external view override returns (uint256) {
        return _totalAssetsUsd;
    }

    function investToCurveVaultTrigger() external view override returns (bool) {}

    function getAssets() external view override returns (uint256[3] memory) {}
}
