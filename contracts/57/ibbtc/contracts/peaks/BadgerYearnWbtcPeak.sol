// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;
pragma experimental ABIEncoderV2;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20, SafeMath} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/math/Math.sol";

import {AccessControlDefended} from "../common/AccessControlDefended.sol";
import {ICore} from "../interfaces/ICore.sol";
import {IbyvWbtc} from "../interfaces/IbyvWbtc.sol";
import {IByvWbtcPeak} from "../interfaces/IPeak.sol";

contract BadgerYearnWbtcPeak is AccessControlDefended, IByvWbtcPeak {
    using SafeERC20 for IERC20;
    using SafeERC20 for IbyvWbtc;

    using SafeMath for uint;
    using Math for uint;

    ICore public immutable core;
    IbyvWbtc public immutable byvWBTC;

    // END OF STORAGE VARIABLES

    event Mint(address account, uint ibBTC, uint byvWBTC);
    event Redeem(address account, uint ibBTC, uint byvWBTC);

    /**
    * @param _core Address of the the Core contract
    */
    constructor(address _core, address _byvWBTC) public {
        core = ICore(_core);
        byvWBTC = IbyvWbtc(_byvWBTC);
    }

    /**
    * @notice Mint bBTC with byvWBTC token
    * @dev Invoking byvWBTC.safeTransferFrom() before core.mint(), will mess up core.totalSystemAssets() calculation
    * @param inAmount Amount of byvWBTC token to mint bBTC with
    * @return outAmount Amount of bBTC minted to user's account
    */
    function mint(uint inAmount, bytes32[] calldata merkleProof)
        override
        external
        defend
        blockLocked
        returns(uint outAmount)
    {
        _lockForBlock(msg.sender);
        outAmount = core.mint(_byvWbtcToBtc(inAmount), msg.sender, merkleProof);
        byvWBTC.safeTransferFrom(msg.sender, address(this), inAmount);
        emit Mint(msg.sender, outAmount, inAmount);
    }

    /**
    * @notice Redeem bBTC in byvWBTC tokens
    * @dev There might not be enough byvWBTC to fulfill the request, in which case the transaction will revert
    *      Invoking byvWBTC.safeTransfer() before core.redeem(), will mess up core.totalSystemAssets() calculation
    * @param inAmount Amount of bBTC to redeem
    * @return outAmount Amount of byvWBTC token
    */
    function redeem(uint inAmount)
        override
        external
        defend
        blockLocked
        returns (uint outAmount)
    {
        _lockForBlock(msg.sender);
        outAmount = _btcTobyvWBTC(core.redeem(inAmount, msg.sender));
        byvWBTC.safeTransfer(msg.sender, outAmount);
        emit Redeem(msg.sender, inAmount, outAmount);
    }

    /* ##### View ##### */

    function calcMint(uint inAmount)
        override
        external
        view
        returns(uint bBTC, uint fee)
    {
        (bBTC, fee) = core.btcToBbtc(_byvWbtcToBtc(inAmount));
    }

    /**
    * @notice Determines the Sett tokens that will be received when redeeming bBTC
    * @return sett Number of sett tokens
    * @return fee Fee charges
    * @return max Max amount of bBTC redeemable for byvWBTC
    */
    function calcRedeem(uint bBtc)
        override
        external
        view
        returns(uint sett, uint fee, uint max)
    {
        uint btc;
        (btc, fee) = core.bBtcToBtc(bBtc);
        sett = _btcTobyvWBTC(btc);
        max = portfolioValue()
            .mul(1e18)
            .div(core.pricePerShare());
    }

    function portfolioValue()
        override
        public
        view
        returns (uint)
    {
        return _byvWbtcToBtc(
            byvWBTC.balanceOf(address(this))
        );
    }

    /**
    * @dev Determine sett amount given btc
    * @param btc BTC amount, scaled by 1e36
    */
    function _btcTobyvWBTC(uint btc)
        internal
        view
        returns(uint)
    {
        return btc // this value is scaled by 1e36
            .div(byvWBTC.pricePerShare())
            .div(1e20);
    }

    /**
    * @dev Determine btc amount given byvWBTC amount
    * @param amount byvWBTC amount
    * @return btc value, scaled by 1e18
    */
    function _byvWbtcToBtc(uint amount)
        internal
        view
        returns(uint)
    {
        // wBTC and byvWBTC are scaled by 8 decimals.
        // Multiply by 100 to return a value scaled by 1e18.
        return amount
            .mul(byvWBTC.pricePerShare())
            .mul(100);
    }
}
