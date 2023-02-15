//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

contract CompoundAdapterMock is Initializable {
    bool public isSupport;
    mapping(address => uint256) public floorMap;
    mapping(address => uint256) public ceilingMap;

    function __CompoundAdapterMock_init() public initializer {}

    function setSupport() external {
        isSupport = !isSupport;
    }

    function setFloor(address tokenAddress, uint256 floor) external {
        floorMap[tokenAddress] = floor;
    }

    function setCeiling(address tokenAddress, uint256 ceiling) external {
        ceilingMap[tokenAddress] = ceiling;
    }

    function claimTokens(address tokenAddress, address recipient) external {
        IERC20Upgradeable token = IERC20Upgradeable(tokenAddress);
        uint256 balance = token.balanceOf(address(this));
        token.transfer(recipient, balance);
    }

    function supportsToken(address) external view returns (bool) {
        return isSupport;
    }

    function getSupplyView(address tokenAddress) external view returns (uint256) {
        IERC20Upgradeable token = IERC20Upgradeable(tokenAddress);
        return token.balanceOf(address(this));
    }

    function getSupply(address tokenAddress) external view returns (uint256) {
        IERC20Upgradeable token = IERC20Upgradeable(tokenAddress);
        return token.balanceOf(address(this));
    }

    function deposit(address) external {}

    function withdraw(
        address tokenAddress,
        address recipient,
        uint256 tokenAmount
    ) external {
        IERC20Upgradeable token = IERC20Upgradeable(tokenAddress);
        token.transfer(recipient, tokenAmount);
    }

    function withdrawAll(address tokenAddress, address recipient) external {
        IERC20Upgradeable token = IERC20Upgradeable(tokenAddress);
        token.transfer(recipient, token.balanceOf(address(this)));
    }
}
