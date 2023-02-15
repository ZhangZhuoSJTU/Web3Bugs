// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '../interfaces/Invest/ICEther.sol';

// @dev This contract should be able to mint underlying tokens to work
contract MockCEther is ERC20, ICEther {
    uint256 exchangeRateStored;
    uint256 lastExchangeRateAt;

    constructor() ERC20('CEther', 'cETH') {
        exchangeRateStored = 1e18;
        lastExchangeRateAt = block.timestamp;
    }

    function mint() external payable override {
        uint256 _shares = (msg.value * 1e18) / _exchangeRateCurrent();
        _mint(msg.sender, _shares);
    }

    function redeem(uint256 redeemTokens) external override returns (uint256) {
        uint256 _amount = (redeemTokens * _exchangeRateCurrent()) / 1e18;
        _burn(msg.sender, redeemTokens);

        payable(msg.sender).transfer(_amount);
        return 0;
    }

    function balanceOfUnderlying(address account) external returns (uint256) {
        return (balanceOf(account) * _exchangeRateCurrent()) / 1e18;
    }

    function exchangeRateCurrent() external returns (uint256) {
        return _exchangeRateCurrent();
    }

    function _exchangeRateCurrent() internal returns (uint256) {
        uint256 _currentExchangeRate = (exchangeRateStored * (1e18 + ((block.timestamp - lastExchangeRateAt) * 1e8))) / 1e18;
        exchangeRateStored = _currentExchangeRate;
        lastExchangeRateAt = block.timestamp;
        return _currentExchangeRate;
    }

    function getCash() external override returns (uint256) {
        return (90 * totalSupply()) / 100;
    }
}
