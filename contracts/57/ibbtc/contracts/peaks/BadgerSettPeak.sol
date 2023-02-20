// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;
pragma experimental ABIEncoderV2;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20, SafeMath} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/math/Math.sol";

import {AccessControlDefended} from "../common/AccessControlDefended.sol";

import {ISwap} from "../interfaces/ISwap.sol";
import {ICore} from "../interfaces/ICore.sol";
import {ISett} from "../interfaces/ISett.sol";
import {IBadgerSettPeak} from "../interfaces/IPeak.sol";

contract BadgerSettPeak is AccessControlDefended, IBadgerSettPeak {
    using SafeERC20 for IERC20;
    using SafeERC20 for ISett;
    using SafeMath for uint;
    using Math for uint;

    ICore public immutable core;

    struct CurvePool {
        ISwap swap;
        ISett sett;
    }
    mapping(uint => CurvePool) public pools;
    uint public numPools;

    // END OF STORAGE VARIABLES

    event Mint(address account, uint ibBTC, uint sett);
    event Redeem(address account, uint ibBTC, uint sett);

    /**
    * @param _core Address of the the Core contract
    */
    constructor(address _core) public {
        core = ICore(_core);
    }

    /**
    * @notice Mint bBTC with Sett LP token
    * @dev Invoking pool.sett.safeTransferFrom() before core.mint(), will mess up core.totalSystemAssets() calculation
    * @param poolId System internal ID of the whitelisted curve pool
    * @param inAmount Amount of Sett LP token to mint bBTC with
    * @return outAmount Amount of bBTC minted to user's account
    */
    function mint(uint poolId, uint inAmount, bytes32[] calldata merkleProof)
        override
        external
        defend
        blockLocked
        returns(uint outAmount)
    {
        _lockForBlock(msg.sender);
        CurvePool memory pool = pools[poolId];
        outAmount = core.mint(_settToBtc(pool, inAmount), msg.sender, merkleProof);
        // will revert if user passed an unsupported poolId
        pool.sett.safeTransferFrom(msg.sender, address(this), inAmount);
        emit Mint(msg.sender, outAmount, inAmount);
    }

    /**
    * @notice Redeem bBTC in Sett LP tokens
    * @dev There might not be enough Sett LP to fulfill the request, in which case the transaction will revert
    *      Invoking pool.sett.safeTransfer() before core.redeem(), will mess up core.totalSystemAssets() calculation
    * @param poolId System internal ID of the whitelisted curve pool
    * @param inAmount Amount of bBTC to redeem
    * @return outAmount Amount of Sett LP token
    */
    function redeem(uint poolId, uint inAmount)
        override
        external
        defend
        blockLocked
        returns (uint outAmount)
    {
        _lockForBlock(msg.sender);
        CurvePool memory pool = pools[poolId];
        outAmount = _btcToSett(pool, core.redeem(inAmount, msg.sender));
        // will revert if the contract has insufficient funds.
        pool.sett.safeTransfer(msg.sender, outAmount);
        emit Redeem(msg.sender, inAmount, outAmount);
    }

    /* ##### View ##### */

    function calcMint(uint poolId, uint inAmount)
        override
        external
        view
        returns(uint bBTC, uint fee)
    {
        (bBTC, fee) = core.btcToBbtc(_settToBtc(pools[poolId], inAmount));
    }

    /**
    * @notice Determines the Sett tokens that will be received when redeeming bBTC
    * @return sett Number of sett tokens
    * @return fee Fee charges
    * @return max Max amount of bBTC redeemable for chosen sett
    */
    function calcRedeem(uint poolId, uint bBtc)
        override
        external
        view
        returns(uint sett, uint fee, uint max)
    {
        CurvePool memory pool = pools[poolId];
        uint btc;
        (btc, fee) = core.bBtcToBtc(bBtc);
        sett = _btcToSett(pool, btc);
        max = pool.sett.balanceOf(address(this))
            .mul(pool.sett.getPricePerFullShare())
            .mul(pool.swap.get_virtual_price())
            .div(core.pricePerShare())
            .div(1e18);
    }

    function portfolioValue()
        override
        external
        view
        returns (uint assets)
    {
        CurvePool memory pool;
        uint _numPools = numPools;
        // We do not expect to have more than 3-4 pools, so this loop should be fine
        for (uint i = 0; i < _numPools; i++) {
            pool = pools[i];
            assets = assets.add(
                _settToBtc(
                    pool,
                    pool.sett.balanceOf(address(this))
                )
            );
        }
    }

    /**
    * @dev Determine sett amount given btc
    * @param btc BTC amount, scaled by 1e36
    *        Will revert for > 1e41.
    *        It's not possible to supply that amount because btc supply is capped at 21e24
    */
    function _btcToSett(CurvePool memory pool, uint btc)
        internal
        view
        returns(uint)
    {
        return btc // is already scaled by 1e36
            .mul(1e18)
            .div(pool.swap.get_virtual_price())
            .div(pool.sett.getPricePerFullShare());
    }

    /**
    * @dev Determine btc amount given sett amount
    * @param amount Sett LP token amount
    *        Will revert for amount > 1e41.
    *        It's not possible to supply that amount because btc supply is capped at 21e24
    */
    function _settToBtc(CurvePool memory pool, uint amount)
        internal
        view
        returns(uint)
    {
        return amount
            .mul(pool.sett.getPricePerFullShare())
            .mul(pool.swap.get_virtual_price())
            .div(1e36);
    }

    /* ##### Governance ##### */

    /**
    * @notice Manage whitelisted curve pools and their respective sett vaults
    */
    function modifyWhitelistedCurvePools(
        CurvePool[] calldata _pools
    )
        external
        onlyGovernance
    {
        CurvePool memory pool;
        for (uint i = 0; i < _pools.length; i++) {
            pool = _pools[i];
            require(
                address(pool.swap) != address(0)
                && address(pool.sett) != address(0),
                "NULL_ADDRESS"
            );
            pools[i] = pool;
        }

        // clear older pools
        if (numPools > _pools.length) {
            for (uint i = _pools.length; i < numPools; i++) {
                delete pools[i];
            }
        }
        numPools = _pools.length;
    }
}
