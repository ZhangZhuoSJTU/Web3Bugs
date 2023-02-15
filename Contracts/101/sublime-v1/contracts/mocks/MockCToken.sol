// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '../interfaces/Invest/ICToken.sol';

interface IERC20Minter is IERC20 {
    function mint(address to, uint256 amount) external;
}

// @dev This contract should be able to mint underlying tokens to work
contract MockCToken is ERC20, ICToken {
    address public override underlying;

    uint256 exchangeRateStored;
    uint256 lastExchangeRateAt;

    constructor(address _underlying) ERC20('CToken', 'CT') {
        underlying = _underlying;
        exchangeRateStored = 1e18;
        lastExchangeRateAt = block.timestamp;
    }

    function mint(uint256 mintAmount) external override returns (uint256) {
        uint256 _shares = (mintAmount * 1e18) / _exchangeRateCurrent();
        IERC20(underlying).transferFrom(msg.sender, address(this), mintAmount);
        _mint(msg.sender, _shares);
        return 0;
    }

    function redeem(uint256 redeemTokens) external override returns (uint256) {
        uint256 _amount = (redeemTokens * _exchangeRateCurrent()) / 1e18;
        _burn(msg.sender, redeemTokens);
        uint256 _balance = IERC20(underlying).balanceOf(msg.sender);
        if (_amount > _balance) {
            IERC20Minter(underlying).mint(address(this), _amount - _balance);
        }
        IERC20(underlying).transfer(msg.sender, _amount);
        return 0;
    }

    function balanceOfUnderlying(address account) external override returns (uint256) {
        return (balanceOf(account) * _exchangeRateCurrent()) / 1e18;
    }

    function exchangeRateCurrent() external override returns (uint256) {
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

    function comptroller() external view override returns (address) {
        return address(0);
    }

    function borrow(uint256 borrowAmount) external override returns (uint256) {
        return 0;
    }

    function repayBorrow(uint256 repayAmount) external override returns (uint256) {
        return 0;
    }

    function mockExchangeRateStored(uint256 _mockedExchangeRate) external returns (uint256) {
        exchangeRateStored = _mockedExchangeRate;
        lastExchangeRateAt = block.timestamp;
        return 0;
    }
}
