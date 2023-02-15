//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

contract CompoundMock is Initializable, ERC20Upgradeable {
    uint256 public rate;
    uint256 public constant EXCHANGE_RATE = 1e18;
    IERC20Upgradeable public underlyingToken;

    function __CompoundMock_init(uint256 _rate, address _underlyingToken) public initializer {
        rate = _rate;
        underlyingToken = IERC20Upgradeable(_underlyingToken);
    }

    function supplyRatePerBlock() external view returns (uint256) {
        return rate;
    }

    function mint(uint256 mintAmount) external returns (uint256) {
        underlyingToken.transferFrom(msg.sender, address(this), mintAmount);
        _mint(msg.sender, (mintAmount * EXCHANGE_RATE) / 10**18);
        return 0;
    }

    function mintOther(address account, uint256 mintAmount) external returns (uint256) {
        underlyingToken.transferFrom(msg.sender, address(this), mintAmount);
        _mint(account, (mintAmount * EXCHANGE_RATE) / 10**18);
        return 0;
    }

    function redeemUnderlying(uint256 redeemAmount) external returns (uint256) {
        underlyingToken.transfer(msg.sender, redeemAmount);
        _burn(msg.sender, (redeemAmount * EXCHANGE_RATE) / 10**18);
        return 0;
    }

    function balanceOfUnderlying(address owner) external view returns (uint256) {
        return (balanceOf(owner) * EXCHANGE_RATE) / 10**18;
    }

    function exchangeRateStored() external pure returns (uint256) {
        return EXCHANGE_RATE;
    }
}
