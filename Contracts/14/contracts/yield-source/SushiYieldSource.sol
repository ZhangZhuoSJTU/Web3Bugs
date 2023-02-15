// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.6.12;

import { IYieldSource } from "@pooltogether/yield-source-interface/contracts/IYieldSource.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

import "./ISushiBar.sol";
import "./ISushi.sol";

/// @title A pooltogether yield source for sushi token
/// @author Steffel Fenix
contract SushiYieldSource is IYieldSource {
    
    using SafeMath for uint256;
    
    ISushiBar public immutable sushiBar;
    ISushi public immutable sushiAddr;
    
    mapping(address => uint256) public balances;

    constructor(ISushiBar _sushiBar, ISushi _sushiAddr) public {
        sushiBar = _sushiBar;
        sushiAddr = _sushiAddr;
    }

    /// @notice Returns the ERC20 asset token used for deposits.
    /// @return The ERC20 asset token
    function depositToken() public view override returns (address) {
        return address(sushiAddr);
    }

    /// @notice Returns the total balance (in asset tokens).  This includes the deposits and interest.
    /// @return The underlying balance of asset tokens
    function balanceOfToken(address addr) public override returns (uint256) {
        if (balances[addr] == 0) return 0;

        uint256 totalShares = sushiBar.totalSupply();
        uint256 barSushiBalance = sushiAddr.balanceOf(address(sushiBar));

        return balances[addr].mul(barSushiBalance).div(totalShares);       
    }

    /// @notice Allows assets to be supplied on other user's behalf using the `to` param.
    /// @param amount The amount of `token()` to be supplied
    /// @param to The user whose balance will receive the tokens
    function supplyTokenTo(uint256 amount, address to) public override {
        sushiAddr.transferFrom(msg.sender, address(this), amount);
        sushiAddr.approve(address(sushiBar), amount);

        ISushiBar bar = sushiBar;
        uint256 beforeBalance = bar.balanceOf(address(this));
        
        bar.enter(amount);
        
        uint256 afterBalance = bar.balanceOf(address(this));
        uint256 balanceDiff = afterBalance.sub(beforeBalance);
        
        balances[to] = balances[to].add(balanceDiff);
    }

    /// @notice Redeems tokens from the yield source to the msg.sender, it burns yield bearing tokens and returns token to the sender.
    /// @param amount The amount of `token()` to withdraw.  Denominated in `token()` as above.
    /// @dev The maxiumum that can be called for token() is calculated by balanceOfToken() above.
    /// @return The actual amount of tokens that were redeemed. This may be different from the amount passed due to the fractional math involved. 
    function redeemToken(uint256 amount) public override returns (uint256) {
        ISushiBar bar = sushiBar;
        ISushi sushi = sushiAddr;

        uint256 totalShares = bar.totalSupply();
        if(totalShares == 0) return 0; 

        uint256 barSushiBalance = sushi.balanceOf(address(bar));
        if(barSushiBalance == 0) return 0;

        uint256 sushiBeforeBalance = sushi.balanceOf(address(this));

        uint256 requiredShares = ((amount.mul(totalShares) + totalShares)).div(barSushiBalance);
        if(requiredShares == 0) return 0;
        
        uint256 requiredSharesBalance = requiredShares.sub(1);
        bar.leave(requiredSharesBalance);

        uint256 sushiAfterBalance = sushi.balanceOf(address(this));
        
        uint256 sushiBalanceDiff = sushiAfterBalance.sub(sushiBeforeBalance);

        balances[msg.sender] = balances[msg.sender].sub(requiredSharesBalance);
        sushi.transfer(msg.sender, sushiBalanceDiff);
        
        return (sushiBalanceDiff);
    }

}