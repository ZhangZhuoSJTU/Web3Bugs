// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "../interfaces/Idle.sol";

contract MockIdleToken is ERC20, IIdleTokenV3_1 {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    address public override token;
    IERC20 public rewardToken;
    IERC20 public govToken;

    constructor(
        string memory _name,
        string memory _symbol,
        address _underlyingAsset,
        address _rewardToken,
        address _govToken
    )
        public
        ERC20(_name, _symbol)
    {
        token = _underlyingAsset;
        rewardToken = ERC20(_rewardToken);
        govToken = ERC20(_govToken);
    }

    function mintIdleToken(uint256 _amount, bool, address) external override returns (uint256 mintedTokens) {
        mintedTokens = _amount.mul(1e18).div(tokenPrice());
        IERC20(token).safeTransferFrom(msg.sender, address(this), _amount);
        _mint(msg.sender, mintedTokens);
    }

    function redeemIdleToken(uint256 _amount) external override returns (uint256 redeemedTokens) {
        uint256 price = tokenPrice();
        redeemedTokens = _amount.mul(price).div(1e18);
        _burn(msg.sender, _amount);
        rewardToken.safeTransfer(msg.sender, 10e18);
        govToken.safeTransfer(msg.sender, 5e18);
        IERC20(token).safeTransfer(msg.sender, redeemedTokens);
    }

    function tokenPrice() public view override returns (uint256) {
        return 2e18; // 1 idleDAI = 2 DAI
    }
}
