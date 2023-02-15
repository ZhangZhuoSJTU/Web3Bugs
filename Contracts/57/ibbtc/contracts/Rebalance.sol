// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;
pragma experimental ABIEncoderV2;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20, SafeMath} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import {ISett} from "./interfaces/ISett.sol";
import {IBadgerSettPeak, IByvWbtcPeak} from "./interfaces/IPeak.sol";

import {ICurveFi, Zap} from "./Zap.sol";

import "hardhat/console.sol";

contract Rebalance {
    using SafeERC20 for IERC20;
    using SafeMath for uint;

    IBadgerSettPeak public constant settPeak = IBadgerSettPeak(0x41671BA1abcbA387b9b2B752c205e22e916BE6e3);
    IByvWbtcPeak public constant byvWbtcPeak = IByvWbtcPeak(0x825218beD8BE0B30be39475755AceE0250C50627);
    IERC20 public constant ibbtc = IERC20(0xc4E15973E6fF2A35cC804c2CF9D2a1b817a8b40F);
    IERC20 public constant wbtc = IERC20(0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599);

    IZap public constant zap = IZap(0x4459A591c61CABd905EAb8486Bf628432b15C8b1);

    function cycleWithSett(uint poolId, uint amount) external {
        Zap.Pool memory pool = zap.pools(poolId);
        pool.lpToken.safeTransferFrom(msg.sender, address(this), amount);
        pool.lpToken.safeApprove(address(pool.sett), amount);
        pool.sett.deposit(amount);

        amount = pool.sett.balanceOf(address(this));
        IERC20(address(pool.sett)).safeApprove(address(settPeak), amount);
        uint _ibbtc = settPeak.mint(poolId, amount, new bytes32[](0));
        _redeem(_ibbtc, msg.sender);
    }

    function cycleWithWbtc(uint poolId, uint idx, uint amount) external {
        wbtc.safeTransferFrom(msg.sender, address(this), amount);
        wbtc.approve(address(zap), amount);
        uint _ibbtc = zap.mint(wbtc, amount, poolId, idx, 0);
        _redeem(_ibbtc, msg.sender);
    }

    function _redeem(uint _ibbtc, address user) internal {
        ibbtc.safeApprove(address(zap), _ibbtc);
        uint _wbtc = zap.redeem(wbtc, _ibbtc, 3, 0, 0); // redeem from byvwbtc
        wbtc.safeTransfer(user, _wbtc);
    }
}

interface IZap {
    function pools(uint idx) external returns(Zap.Pool memory);

    function mint(IERC20 token, uint amount, uint poolId, uint idx, uint minOut)
        external
        returns(uint _ibbtc);

    function redeem(IERC20 token, uint amount, uint poolId, int128 idx, uint minOut)
        external
        returns(uint out);
}
