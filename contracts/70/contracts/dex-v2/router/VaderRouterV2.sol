// SPDX-License-Identifier: MIT AND AGPL-3.0-or-later
pragma solidity =0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../../shared/ProtocolConstants.sol";

import "../../dex/math/VaderMath.sol";

import "../../interfaces/reserve/IVaderReserve.sol";
import "../../interfaces/dex-v2/router/IVaderRouterV2.sol";
import "../../interfaces/dex-v2/pool/IVaderPoolV2.sol";

/*
 @dev Implementation of {VaderRouterV2} contract.
 *
 * The contract VaderRouter inherits from {Ownable} and {ProtocolConstants} contracts.
 *
 * It allows adding of liquidity to Vader pairs.
 *
 * Allows removing of liquidity by the users and claiming the underlying assets from
 * the Vader pairs/pools.
 *
 * Allows swapping between native and foreign assets within a single Vader pair.
 *
 * Allows swapping of foreign assets across two different Vader pairs.
 **/
contract VaderRouterV2 is IVaderRouterV2, ProtocolConstants, Ownable {
    /* ========== LIBRARIES ========== */

    // Used for safe token transfers
    using SafeERC20 for IERC20;

    /* ========== STATE VARIABLES ========== */

    // Address of the Vader pool contract.
    IVaderPoolV2 public immutable pool;

    // Address of native asset (USDV or Vader).
    IERC20 public immutable nativeAsset;

    // Address of reserve contract.
    IVaderReserve public reserve;

    /* ========== CONSTRUCTOR ========== */

    /*
     * @dev Initialises contract by setting pool and native asset addresses.
     *
     * Native assets address is taken from param {_pool} and native asset's address
     * is retrieved from {VaderPoolV2} contract.
     **/
    constructor(IVaderPoolV2 _pool) {
        require(
            _pool != IVaderPoolV2(_ZERO_ADDRESS),
            "VaderRouterV2::constructor: Incorrect Arguments"
        );

        pool = _pool;
        nativeAsset = pool.nativeAsset();
    }

    /* ========== VIEWS ========== */

    /* ========== MUTATIVE FUNCTIONS ========== */

    /*
     * @dev Allows adding of liquidity to the Vader pool.
     *
     * Internally calls {addLiquidity} function.
     *
     * Returns the amount of liquidity minted.
     **/
    // NOTE: For Uniswap V2 compliancy, necessary due to stack too deep
    function addLiquidity(
        IERC20 tokenA,
        IERC20 tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256, // amountAMin = unused
        uint256, // amountBMin = unused
        address to,
        uint256 deadline
    ) external override returns (uint256 liquidity) {
        return
            addLiquidity(
                tokenA,
                tokenB,
                amountADesired,
                amountBDesired,
                to,
                deadline
            );
    }

    /*
     * @dev Allows adding of liquidity to the Vader pool.
     *
     * Calls `mint` function on the {BasePoolV2} contract.
     *
     * Pair is determined based {tokenA} and {tokenB} where one of them represents
     * native asset and the other one represents foreign asset.
     *
     * Returns the amount of liquidity units minted against a pair.
     *
     * Requirements:
     * - The current timestamp has not exceeded the param {deadline}.
     * - Amongst {tokenA} and {tokenB}, one should be the native asset and the other
     *   one must be the foreign asset.
     * - The foreign asset among {tokenA} and {tokenB} must be a supported token.
     **/
    function addLiquidity(
        IERC20 tokenA,
        IERC20 tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        address to,
        uint256 deadline
    ) public override ensure(deadline) returns (uint256 liquidity) {
        IERC20 foreignAsset;
        uint256 nativeDeposit;
        uint256 foreignDeposit;

        if (tokenA == nativeAsset) {
            require(
                pool.supported(tokenB),
                "VaderRouterV2::addLiquidity: Unsupported Assets Specified"
            );
            foreignAsset = tokenB;
            foreignDeposit = amountBDesired;
            nativeDeposit = amountADesired;
        } else {
            require(
                tokenB == nativeAsset && pool.supported(tokenA),
                "VaderRouterV2::addLiquidity: Unsupported Assets Specified"
            );
            foreignAsset = tokenA;
            foreignDeposit = amountADesired;
            nativeDeposit = amountBDesired;
        }

        liquidity = pool.mint(
            foreignAsset,
            nativeDeposit,
            foreignDeposit,
            msg.sender,
            to
        );
    }

    /*
     * @dev Allows removing of liquidity by {msg.sender} and transfers the
     * underlying assets to {to} address.
     *
     * The liquidity is removed from a pair represented by {tokenA} and {tokenB}.
     *
     * Transfers the NFT with Id {id} representing user's position, to the pool address,
     * so the pool is able to burn it in the `burn` function call.
     *
     * Calls the `burn` function on the pool contract.
     *
     * Calls the `reimburseImpermanentLoss` on reserve contract to cover impermanent loss
     * for the liquidity being removed.
     *
     * Requirements:
     * - The underlying assets amounts of {amountA} and {amountB} must
     *   be greater than or equal to {amountAMin} and {amountBMin}, respectively.
     * - The current timestamp has not exceeded the param {deadline}.
     * - Either of {tokenA} or {tokenB} should be a native asset and the other one
     *   must be the foreign asset associated with the NFT representing liquidity.
     **/
    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint256 id,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    )
        public
        override
        ensure(deadline)
        returns (uint256 amountA, uint256 amountB)
    {
        IERC20 _foreignAsset = pool.positionForeignAsset(id);
        IERC20 _nativeAsset = nativeAsset;

        bool isNativeA = _nativeAsset == IERC20(tokenA);

        if (isNativeA) {
            require(
                IERC20(tokenB) == _foreignAsset,
                "VaderRouterV2::removeLiquidity: Incorrect Addresses Specified"
            );
        } else {
            require(
                IERC20(tokenA) == _foreignAsset &&
                    IERC20(tokenB) == _nativeAsset,
                "VaderRouterV2::removeLiquidity: Incorrect Addresses Specified"
            );
        }

        pool.transferFrom(msg.sender, address(pool), id);

        (
            uint256 amountNative,
            uint256 amountForeign,
            uint256 coveredLoss
        ) = pool.burn(id, to);

        (amountA, amountB) = isNativeA
            ? (amountNative, amountForeign)
            : (amountForeign, amountNative);

        require(amountA >= amountAMin, "VaderRouterV2: INSUFFICIENT_A_AMOUNT");
        require(amountB >= amountBMin, "VaderRouterV2: INSUFFICIENT_B_AMOUNT");

        reserve.reimburseImpermanentLoss(msg.sender, coveredLoss);
    }

    /*
     * @dev Allows swapping of exact source token amount to destination
     * token amount.
     *
     * Internally calls {_swap} function.
     *
     * Requirements:
     * - The destination amount {amountOut} must greater than or equal to param {amountOutMin}.
     * - The current timestamp has not exceeded the param {deadline}.
     **/
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        IERC20[] calldata path,
        address to,
        uint256 deadline
    ) external virtual override ensure(deadline) returns (uint256 amountOut) {
        amountOut = _swap(amountIn, path, to);

        require(
            amountOut >= amountOutMin,
            "VaderRouterV2::swapExactTokensForTokens: Insufficient Trade Output"
        );
    }

    /* ========== RESTRICTED FUNCTIONS ========== */

    /*
     * @dev Sets the reserve address and renounces contract's ownership.
     *
     * Requirements:
     * - Only existing owner can call this function.
     * - Param {_reserve} cannot be a zero address.
     **/
    function initialize(IVaderReserve _reserve) external onlyOwner {
        require(
            _reserve != IVaderReserve(_ZERO_ADDRESS),
            "VaderRouterV2::initialize: Incorrect Reserve Specified"
        );

        reserve = _reserve;

        renounceOwnership();
    }

    /* ========== INTERNAL FUNCTIONS ========== */

    /* ========== PRIVATE FUNCTIONS ========== */

    /*
     * @dev Allows swapping of assets from within a single Vader pool pair or
     * across two different Vader pairs.
     *
     * In case of a single Vader pair, the native asset can be swapped for foreign
     * asset and vice versa.
     *
     * In case of two Vader pairs, the foreign asset is swapped for native asset from
     * the first Vader pool and the native asset retrieved from the first Vader pair is swapped
     * for foreign asset from the second Vader pair.
     *
     * Requirements:
     * - Param {path} length can be either 2 or 3.
     * - If the {path} length is 3 the index 0 and 1 must contain foreign assets' addresses
     *   and index 1 must contain native asset's address.
     * - If the {path} length is 2 then either of indexes must contain foreign asset's address
     *   and the other one must contain native asset's address.
     **/
    function _swap(
        uint256 amountIn,
        IERC20[] calldata path,
        address to
    ) private returns (uint256 amountOut) {
        if (path.length == 3) {
            require(
                path[0] != path[1] &&
                    path[1] == pool.nativeAsset() &&
                    path[2] != path[1],
                "VaderRouterV2::_swap: Incorrect Path"
            );

            path[0].safeTransferFrom(msg.sender, address(pool), amountIn);

            return pool.doubleSwap(path[0], path[2], amountIn, to);
        } else {
            require(
                path.length == 2,
                "VaderRouterV2::_swap: Incorrect Path Length"
            );
            IERC20 _nativeAsset = nativeAsset;
            require(path[0] != path[1], "VaderRouterV2::_swap: Incorrect Path");

            path[0].safeTransferFrom(msg.sender, address(pool), amountIn);
            if (path[0] == _nativeAsset) {
                return pool.swap(path[1], amountIn, 0, to);
            } else {
                require(
                    path[1] == _nativeAsset,
                    "VaderRouterV2::_swap: Incorrect Path"
                );
                return pool.swap(path[0], 0, amountIn, to);
            }
        }
    }

    /* ========== MODIFIERS ========== */

    // Guard ensuring that the current timestamp has not exceeded the param {deadline}.
    modifier ensure(uint256 deadline) {
        require(deadline >= block.timestamp, "VaderRouterV2::ensure: Expired");
        _;
    }
}
