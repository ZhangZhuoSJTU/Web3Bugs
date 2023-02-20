// SPDX-License-Identifier: Unlicense

pragma solidity =0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../../shared/ProtocolConstants.sol";

import "../math/VaderMath.sol";

import "../../interfaces/reserve/IVaderReserve.sol";
import "../../interfaces/dex/router/IVaderRouter.sol";
import "../../interfaces/dex/pool/IVaderPoolFactory.sol";

/*
 @dev Implementation of {VaderRouter} contract.
 *
 * The contract VaderRouter inherits from {Ownable} and {ProtocolConstants} contracts.
 *
 * It allows adding of liquidity to Vader pools and facilitate creation of Vader pools if
 * it does not already exist when depositing liquidity.
 *
 * Allows removing of liquidity by the users and claiming the underlying assets from
 * the Vader pools.
 *
 * Allows swapping between native and foreign assets within a single Vader pool.
 *
 * Allows swapping of foreign assets across two different Vader pools.
 *
 * Contains helper functions to compute the destination asset amount given the exact source
 * asset amount and vice versa.
 **/
contract VaderRouter is IVaderRouter, ProtocolConstants, Ownable {
    /* ========== LIBRARIES ========== */

    // Used for safe token transfers
    using SafeERC20 for IERC20;

    /* ========== STATE VARIABLES ========== */

    // The address of Vader pool factory contract.
    IVaderPoolFactory public immutable factory;

    // The address of Reserve contract.
    IVaderReserve public reserve;

    /* ========== CONSTRUCTOR ========== */

    /*
     * @dev Initializes contract's state by setting the vader pool factory address.
     *
     * Requirements:
     * - Vader pool factory address must not be zero.
     **/
    constructor(IVaderPoolFactory _factory) {
        require(
            _factory != IVaderPoolFactory(_ZERO_ADDRESS),
            "VaderRouter::constructor: Incorrect Arguments"
        );

        factory = _factory;
    }

    /* ========== VIEWS ========== */

    /* ========== MUTATIVE FUNCTIONS ========== */

    /*
     * @dev Allows adding of liquidity to the Vader pools.
     *
     * Internally calls {addLiquidity} function.
     *
     * Returns the amounts of assetA and assetB used in liquidity and
     * the amount of liquidity units minted.
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
    )
        external
        override
        returns (
            uint256 amountA,
            uint256 amountB,
            uint256 liquidity
        )
    {
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
     * @dev Allows adding of liquidity to the Vader pools.
     *
     * Internally calls {_addLiquidity} function.
     *
     * Transfers the amounts of tokenA and tokenB from {msg.sender} to the pool.
     *
     * Calls the {mint} function on the pool to deposit liquidity on the behalf of
     * {to} address.
     *
     * Returns the amounts of assetA and assetB used in liquidity and
     * the amount of liquidity units minted.
     *
     * Requirements:
     * - The current timestamp has not exceeded the param {deadline}.
     **/
    function addLiquidity(
        IERC20 tokenA,
        IERC20 tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        address to,
        uint256 deadline
    )
        public
        override
        ensure(deadline)
        returns (
            uint256 amountA,
            uint256 amountB,
            uint256 liquidity
        )
    {
        IVaderPool pool;
        (pool, amountA, amountB) = _addLiquidity(
            address(tokenA),
            address(tokenB),
            amountADesired,
            amountBDesired
        );
        tokenA.safeTransferFrom(msg.sender, address(pool), amountA);
        tokenB.safeTransferFrom(msg.sender, address(pool), amountB);
        liquidity = pool.mint(to);
    }

    /*
     * @dev Allows removing of liquidity by {msg.sender} and transfers the
     * underlying assets to {to} address.
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
        IVaderPool pool = factory.getPool(tokenA, tokenB);

        pool.transferFrom(msg.sender, address(pool), id);

        (
            uint256 amountNative,
            uint256 amountForeign,
            uint256 coveredLoss
        ) = pool.burn(id, to);

        (amountA, amountB) = tokenA == factory.nativeAsset()
            ? (amountNative, amountForeign)
            : (amountForeign, amountNative);

        require(
            amountA >= amountAMin,
            "UniswapV2Router: INSUFFICIENT_A_AMOUNT"
        );
        require(
            amountB >= amountBMin,
            "UniswapV2Router: INSUFFICIENT_B_AMOUNT"
        );

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
        address[] calldata path,
        address to,
        uint256 deadline
    ) external virtual override ensure(deadline) returns (uint256 amountOut) {
        amountOut = _swap(amountIn, path, to);

        require(
            amountOut >= amountOutMin,
            "VaderRouter::swapExactTokensForTokens: Insufficient Trade Output"
        );
    }

    /*
     * @dev Allows swapping of source token amount to exact destination token
     * amount.
     *
     * Internally calls {calculateInGivenOut} and {_swap} functions.
     *
     * Requirements:
     * - Param {amountInMax} must be greater than or equal to the source amount computed {amountIn}.
     * - The current timestamp has not exceeded the param {deadline}.
     **/
    function swapTokensForExactTokens(
        uint256 amountOut,
        uint256 amountInMax,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external virtual ensure(deadline) returns (uint256 amountIn) {
        amountIn = calculateInGivenOut(amountOut, path);

        require(
            amountInMax >= amountIn,
            "VaderRouter::swapTokensForExactTokens: Large Trade Input"
        );

        _swap(amountIn, path, to);
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
            "VaderRouter::initialize: Incorrect Reserve Specified"
        );

        reserve = _reserve;

        renounceOwnership();
    }

    /* ========== INTERNAL FUNCTIONS ========== */

    /* ========== PRIVATE FUNCTIONS ========== */

    /*
     * @dev Allows swapping of assets from within a single Vader pool or
     * across two different Vader pools.
     *
     * In case of a single Vader pool, the native asset can be swapped for foreign
     * asset and vice versa.
     *
     * In case of two Vader pools, the foreign asset is swapped for native asset from
     * the first Vader pool and the native asset retrieved from the first Vader pool is swapped
     * for foreign asset from the second Vader pool.
     *
     * Requirements:
     * - Param {path} length can be either 2 or 3.
     * - If the {path} length is 3 the index 0 and 1 must contain foreign assets' addresses
     *   and index 1 must contain native asset's address.
     * - If the {path} length is 2 then either of indexes must contain foreign asset's address
     *   and the other one must contain native asset's address.
     **/
    // TODO: Refactor with central pool, perhaps diminishes security? would need directSwap & bridgeSwap
    function _swap(
        uint256 amountIn,
        address[] calldata path,
        address to
    ) private returns (uint256 amountOut) {
        if (path.length == 3) {
            require(
                path[0] != path[1] &&
                    path[1] == factory.nativeAsset() &&
                    path[2] != path[1],
                "VaderRouter::_swap: Incorrect Path"
            );

            IVaderPool pool0 = factory.getPool(path[0], path[1]);
            IVaderPool pool1 = factory.getPool(path[1], path[2]);

            IERC20(path[0]).safeTransferFrom(
                msg.sender,
                address(pool0),
                amountIn
            );

            return pool1.swap(0, pool0.swap(amountIn, 0, address(pool1)), to);
        } else {
            require(
                path.length == 2,
                "VaderRouter::_swap: Incorrect Path Length"
            );
            address nativeAsset = factory.nativeAsset();
            require(path[0] != path[1], "VaderRouter::_swap: Incorrect Path");

            IVaderPool pool = factory.getPool(path[0], path[1]);
            IERC20(path[0]).safeTransferFrom(
                msg.sender,
                address(pool),
                amountIn
            );
            if (path[0] == nativeAsset) {
                return pool.swap(amountIn, 0, to);
            } else {
                require(
                    path[1] == nativeAsset,
                    "VaderRouter::_swap: Incorrect Path"
                );
                return pool.swap(0, amountIn, to);
            }
        }
    }

    /*
     * @dev An internal function that returns Vader pool's address against
     * the provided assets of {tokenA} and {tokenB} if it exists, otherwise
     * a new Vader pool created against the provided assets.
     **/
    // NOTE: DEX allows asymmetric deposits
    function _addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired
    )
        private
        returns (
            IVaderPool pool,
            uint256 amountA,
            uint256 amountB
        )
    {
        // create the pair if it doesn't exist yet
        pool = factory.getPool(tokenA, tokenB);
        if (pool == IVaderPool(_ZERO_ADDRESS)) {
            pool = factory.createPool(tokenA, tokenB);
        }

        (amountA, amountB) = (amountADesired, amountBDesired);
    }

    /*
     * @dev Returns the amount of source asset given the amount of destination asset.
     *
     * Calls the {calculateSwapReverse} on VaderMath library to compute the source
     * token amount.
     *
     * Requirements:
     * - Param {path} length can be either 2 or 3.
     * - If the {path} length is 3 the index 0 and 1 must contain foreign assets' addresses
     *   and index 1 must contain native asset's address.
     * - If the {path} length is 2 then either of indexes must contain foreign asset's address
     *   and the other one must contain native asset's address.
     **/
    function calculateInGivenOut(uint256 amountOut, address[] calldata path)
        public
        view
        returns (uint256 amountIn)
    {
        if (path.length == 2) {
            address nativeAsset = factory.nativeAsset();
            IVaderPool pool = factory.getPool(path[0], path[1]);
            (uint256 nativeReserve, uint256 foreignReserve, ) = pool
                .getReserves();
            if (path[0] == nativeAsset) {
                return
                    VaderMath.calculateSwapReverse(
                        amountOut,
                        nativeReserve,
                        foreignReserve
                    );
            } else {
                return
                    VaderMath.calculateSwapReverse(
                        amountOut,
                        foreignReserve,
                        nativeReserve
                    );
            }
        } else {
            IVaderPool pool0 = factory.getPool(path[0], path[1]);
            IVaderPool pool1 = factory.getPool(path[1], path[2]);
            (uint256 nativeReserve0, uint256 foreignReserve0, ) = pool0
                .getReserves();
            (uint256 nativeReserve1, uint256 foreignReserve1, ) = pool1
                .getReserves();

            return
                VaderMath.calculateSwapReverse(
                    VaderMath.calculateSwapReverse(
                        amountOut,
                        nativeReserve1,
                        foreignReserve1
                    ),
                    foreignReserve0,
                    nativeReserve0
                );
        }
    }

    /*
     * @dev Returns the amount of destination asset given the amount of source asset.
     *
     * Calls the {calculateSwap} on VaderMath library to compute the destination
     * token amount.
     *
     * Requirements:
     * - Param {path} length can be either 2 or 3.
     * - If the {path} length is 3 the index 0 and 1 must contain foreign assets' addresses
     *   and index 1 must contain native asset's address.
     * - If the {path} length is 2 then either of indexes must contain foreign asset's address
     *   and the other one must contain native asset's address.
     **/
    function calculateOutGivenIn(uint256 amountIn, address[] calldata path)
        external
        view
        returns (uint256 amountOut)
    {
        if (path.length == 2) {
            address nativeAsset = factory.nativeAsset();
            IVaderPool pool = factory.getPool(path[0], path[1]);
            (uint256 nativeReserve, uint256 foreignReserve, ) = pool
                .getReserves();
            if (path[0] == nativeAsset) {
                return
                    VaderMath.calculateSwap(
                        amountIn,
                        nativeReserve,
                        foreignReserve
                    );
            } else {
                return
                    VaderMath.calculateSwap(
                        amountIn,
                        foreignReserve,
                        nativeReserve
                    );
            }
        } else {
            IVaderPool pool0 = factory.getPool(path[0], path[1]);
            IVaderPool pool1 = factory.getPool(path[1], path[2]);
            (uint256 nativeReserve0, uint256 foreignReserve0, ) = pool0
                .getReserves();
            (uint256 nativeReserve1, uint256 foreignReserve1, ) = pool1
                .getReserves();

            return
                VaderMath.calculateSwap(
                    VaderMath.calculateSwap(
                        amountIn,
                        nativeReserve1,
                        foreignReserve1
                    ),
                    foreignReserve0,
                    nativeReserve0
                );
        }
    }

    /* ========== MODIFIERS ========== */

    // Guard ensuring that the current timestamp has not exceeded the param {deadline}.
    modifier ensure(uint256 deadline) {
        require(deadline >= block.timestamp, "VaderRouter::ensure: Expired");
        _;
    }
}
