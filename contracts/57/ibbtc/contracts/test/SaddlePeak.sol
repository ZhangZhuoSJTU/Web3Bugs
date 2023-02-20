// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;
pragma experimental ABIEncoderV2;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20, SafeMath} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/math/Math.sol";

import {ISaddleSwap} from "../interfaces/ISwap.sol";
import {ICore} from "../interfaces/ICore.sol";
import {ISett} from "../interfaces/ISett.sol";
import {IPeak} from "../interfaces/IPeak.sol";
import {AccessControlDefended} from "../common/AccessControlDefended.sol";

contract SaddlePeak is AccessControlDefended, IPeak {
    using SafeERC20 for IERC20;
    using SafeERC20 for ISett;
    using SafeMath for uint;
    using Math for uint;

    ICore public immutable core;

    struct CurvePool {
        IERC20 lpToken;
        ISaddleSwap swap;
    }
    mapping(uint => CurvePool) public pools;
    uint public numPools;

    // END OF STORAGE VARIABLES

    event Mint(address account, uint amount);
    event Redeem(address account, uint amount);

    /**
    * @param _core Address of the the Core contract
    */
    constructor(address _core) public {
        core = ICore(_core);
    }

    /**
    * @notice Mint bBTC with Sett LP token
    * @dev Invoking pool.lpToken.safeTransferFrom() before core.mint(), will mess up core.totalSystemAssets() calculation
    * @param poolId System internal ID of the whitelisted curve pool
    * @param inAmount Amount of Sett LP token to mint bBTC with
    * @return outAmount Amount of bBTC minted to user's account
    */
    function mint(uint poolId, uint inAmount, bytes32[] calldata merkleProof)
        external
        defend
        blockLocked
        returns(uint outAmount)
    {
        _lockForBlock(msg.sender);
        CurvePool memory pool = pools[poolId];
        outAmount = core.mint(_settToBtc(pool, inAmount), msg.sender, merkleProof);
        // will revert if user passed an unsupported poolId
        pool.lpToken.safeTransferFrom(msg.sender, address(this), inAmount);
        emit Mint(msg.sender, outAmount);
    }

    /**
    * @notice Redeem bBTC in Sett LP tokens
    * @dev There might not be enough Sett LP to fulfill the request, in which case the transaction will revert
    *      Invoking pool.lpToken.safeTransfer() before core.redeem(), will mess up core.totalSystemAssets() calculation
    * @param poolId System internal ID of the whitelisted curve pool
    * @param inAmount Amount of bBTC to redeem
    * @return outAmount Amount of Sett LP token
    */
    function redeem(uint poolId, uint inAmount)
        external
        defend
        blockLocked
        returns (uint outAmount)
    {
        _lockForBlock(msg.sender);
        CurvePool memory pool = pools[poolId];
        outAmount = _btcToSett(pool, core.redeem(inAmount, msg.sender));
        // will revert if the contract has insufficient funds.
        pool.lpToken.safeTransfer(msg.sender, outAmount);
        emit Redeem(msg.sender, inAmount);
    }

    /* ##### View ##### */

    function calcMint(uint poolId, uint inAmount) external view returns(uint, uint) {}

    function calcRedeem(uint poolId, uint bBtc) external view returns(uint,uint,uint) {}

    function portfolioValue()
        override
        external
        view
        returns (uint assets)
    {
        CurvePool memory pool;
        // We do not expect to have more than 3-4 pools, so this loop should be fine
        for (uint i = 0; i < numPools; i++) {
            pool = pools[i];
            assets = assets
                .add(
                    _settToBtc(
                        pool,
                        pool.lpToken.balanceOf(address(this))
                    )
                );
        }
    }

    /**
    * @param btc BTC amount scaled by 1e18
    */
    function _btcToSett(CurvePool memory pool, uint btc)
        internal
        view
        returns(uint)
    {
        return btc
            .div(pool.swap.getVirtualPrice());
    }

    function _settToBtc(CurvePool memory pool, uint amount)
        internal
        view
        returns(uint)
    {
        return amount
            .mul(pool.swap.getVirtualPrice())
            .div(1e18);
    }

    /* ##### Admin ##### */

    /**
    * @notice Manage whitelisted curve pools and their respective sett vaults
    */
    function modifyWhitelistedCurvePools(
        CurvePool[] calldata _pools
    )
        external
        onlyGovernance
    {
        numPools = _pools.length;
        CurvePool memory pool;
        for (uint i = 0; i < numPools; i++) {
            pool = _pools[i];
            require(
                address(pool.lpToken) != address(0)
                && address(pool.swap) != address(0),
                "NULL_ADDRESS"
            );
            pools[i] = CurvePool(pool.lpToken, pool.swap);
        }
    }
}
