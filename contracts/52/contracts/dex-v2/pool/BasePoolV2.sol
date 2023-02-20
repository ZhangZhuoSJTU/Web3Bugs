// SPDX-License-Identifier: Unlicense

pragma solidity =0.8.9;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "../../shared/ProtocolConstants.sol";

import "../../dex/math/VaderMath.sol";
import "../../dex/utils/GasThrottle.sol";

import "../../external/libraries/UQ112x112.sol";

import "../../interfaces/dex-v2/pool/IBasePoolV2.sol";

/*
 * @dev Implementation of {BasePoolV2} contract.
 *
 * The BasePoolV2 contract keeps track of all the Vader pools in the form of
 * pairs. Each pair tracked through {pairInfo} mapping and is mapped against the
 * foreign asset for which the pair is created.
 *
 * Has function to deposited liquidity to any of pair by specifying the mapped
 * foreign asset against the pair.
 *
 * The minted liquidity is associated with a position, that is tracked by a minted NFT.
 * The NFT has information about the pair for which it represents the liquidity.
 *
 * The contract allows redeeming of liquidity against a particular pool by burning the
 * associated position representing NFT.
 *
 * The contract allows swapping of native to foreign assets and vice versa within a pair and
 * allows foreign to foreign asset swap across two different pairs.
 *
 * Keeps track of the cumulative prices for both native and foreign assets for
 * pairs and updates them after minting and burning of liquidity, and swapping of assets.
 **/
contract BasePoolV2 is
    IBasePoolV2,
    ProtocolConstants,
    GasThrottle,
    ERC721,
    ReentrancyGuard
{
    /* ========== LIBRARIES ========== */

    // Used for safe token transfers
    using SafeERC20 for IERC20;

    // Used by Uniswap-like TWAP mechanism
    using UQ112x112 for uint224;

    /* ========== STATE VARIABLES ========== */

    // Address of native asset (Vader or USDV).
    IERC20 public immutable override nativeAsset;

    // Denotes what tokens are actively supported by the system
    mapping(IERC20 => bool) public override supported;

    /*
     * @dev A mapping of foreign asset to the pool's pair.
     * Each pair is represents a pool of native and foreign assets and
     * contains data such as the reserves of native and foreign assets and
     * the liquidity units issues against the deposits of these assets.
     **/
    mapping(IERC20 => PairInfo) public pairInfo;

    /*
     * @dev A mapping representing positions of liquidity providers. Each position
     * is an Non-fungible token that is mapped against amounts of native and foreign assets
     * deposited across different pools of pairs the timestamp at which the position
     * is created and the amount of liquidity of a particular pool assigned to the LP.
     *
     * Each position in the mapping is mapped against {positionId}.
     **/
    mapping(uint256 => Position) public positions;

    // A unique id the of the position created when liquidity is added to a pool.
    uint256 public positionId;

    // Address of the router contract (used for restriction)
    address public router;

    /* ========== CONSTRUCTOR ========== */

    /*
     * @dev Initializes the contract by setting address of native asset.
     **/
    constructor(IERC20 _nativeAsset) ERC721("Vader LP", "VLP") {
        require(
            _nativeAsset != IERC20(_ZERO_ADDRESS),
            "BasePoolV2::constructor: Incorrect Arguments"
        );
        nativeAsset = IERC20(_nativeAsset);
    }

    /* ========== VIEWS ========== */

    /*
     * @dev Accepts address of foreign asset {foreignAsset} to determine the pair (pool)
     * and returns reserves amounts of native and foreign assets, and the last timestamp
     * when cumulative prices for these assets were updated.
     **/
    function getReserves(IERC20 foreignAsset)
        public
        view
        returns (
            uint112 reserveNative,
            uint112 reserveForeign,
            uint32 blockTimestampLast
        )
    {
        PairInfo storage pair = pairInfo[foreignAsset];
        (reserveNative, reserveForeign, blockTimestampLast) = (
            pair.reserveNative,
            pair.reserveForeign,
            pair.blockTimestampLast
        );
    }

    /*
     * @dev Accepts {id} of a liquidity position and returns foreign asset's
     * address for that particular liquidity position.
     **/
    function positionForeignAsset(uint256 id)
        external
        view
        override
        returns (IERC20)
    {
        return positions[id].foreignAsset;
    }

    function pairSupply(IERC20 foreignAsset)
        external
        view
        override
        returns (uint256)
    {
        return pairInfo[foreignAsset].totalSupply;
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    /*
     * @dev Allows depositing of liquidity to a pool/pair by accepting native and foreign assets
     * and mints an NFT to the {to} address which records in {positions} mapping, the amounts
     * of the native and foreign assets deposited and the liquidity units minted against.
     *
     * The pool/pair to accept the native and foreign assets against is determined by {foreignAsset}.
     *
     * Updates the total supply of liquidity units by adding currently minted liquidity units
     * to {pair.totalSupply} of pair/pool.
     *
     * Updates the cumulative prices of native and foreign assets in pool/pair after minting the appropriate
     * liquidity units.
     *
     * Requirements:
     * - Amounts of native and foreign must be approved to the pool prior to calling the `mint` function.
     * - The amount of {liquidity} to be minted must be greater than 0.
     * - The param {foreignAsset} must be a supported token.
     * - Can only be called by Router.
     **/
    function mint(
        IERC20 foreignAsset,
        uint256 nativeDeposit,
        uint256 foreignDeposit,
        address from,
        address to
    )
        external
        override
        nonReentrant
        onlyRouter
        supportedToken(foreignAsset)
        returns (uint256 liquidity)
    {
        (uint112 reserveNative, uint112 reserveForeign, ) = getReserves(
            foreignAsset
        ); // gas savings

        nativeAsset.safeTransferFrom(from, address(this), nativeDeposit);
        foreignAsset.safeTransferFrom(from, address(this), foreignDeposit);

        PairInfo storage pair = pairInfo[foreignAsset];
        uint256 totalLiquidityUnits = pair.totalSupply;
        if (totalLiquidityUnits == 0) liquidity = nativeDeposit;
        else
            liquidity = VaderMath.calculateLiquidityUnits(
                nativeDeposit,
                reserveNative,
                foreignDeposit,
                reserveForeign,
                totalLiquidityUnits
            );

        require(
            liquidity > 0,
            "BasePoolV2::mint: Insufficient Liquidity Provided"
        );

        uint256 id = positionId++;

        pair.totalSupply = totalLiquidityUnits + liquidity;
        _mint(to, id);

        positions[id] = Position(
            foreignAsset,
            block.timestamp,
            liquidity,
            nativeDeposit,
            foreignDeposit
        );

        _update(
            foreignAsset,
            reserveNative + nativeDeposit,
            reserveForeign + foreignDeposit,
            reserveNative,
            reserveForeign
        );

        emit Mint(from, to, nativeDeposit, foreignDeposit);
        emit PositionOpened(from, to, id, liquidity);
    }

    /*
     * @dev Allows redeeming of liquidity units by burning the NFT with {id} associated with the liquidity
     * position.
     *
     * Computes the amounts of native and foreign assets from pool/pair against which the NFT with Id {id}
     * was minted. The computed assets' amounts depends upon current reserves of assets and
     * the liquidity associated with the position, and is transferred to the {to} address.
     *
     * Burns the redeemed NFT token and decreases {pair.totalSupply} by the {liquidity}
     * associated with that NFT token.
     *
     * Updates the cumulative prices for native and foreign assets in pool/pair after transferring the assets
     * to the {to} address.
     *
     * Requirements:
     * - The NFT token being redeemed must be transferred to the contract prior to calling `_burn`.
     * - The amount of native and foreign assets computed for transfer to {to} address must be greater
     *   than 0.
     **/
    function _burn(uint256 id, address to)
        internal
        nonReentrant
        returns (uint256 amountNative, uint256 amountForeign)
    {
        require(
            ownerOf(id) == address(this),
            "BasePoolV2::burn: Incorrect Ownership"
        );

        IERC20 foreignAsset = positions[id].foreignAsset;

        (uint112 reserveNative, uint112 reserveForeign, ) = getReserves(
            foreignAsset
        ); // gas savings

        uint256 liquidity = positions[id].liquidity;

        PairInfo storage pair = pairInfo[foreignAsset];
        uint256 _totalSupply = pair.totalSupply;
        amountNative = (liquidity * reserveNative) / _totalSupply;
        amountForeign = (liquidity * reserveForeign) / _totalSupply;

        require(
            amountNative > 0 && amountForeign > 0,
            "BasePoolV2::burn: Insufficient Liquidity Burned"
        );

        pair.totalSupply = _totalSupply - liquidity;
        _burn(id);

        nativeAsset.safeTransfer(to, amountNative);
        foreignAsset.safeTransfer(to, amountForeign);

        _update(
            foreignAsset,
            reserveNative - amountNative,
            reserveForeign - amountForeign,
            reserveNative,
            reserveForeign
        );

        emit Burn(msg.sender, amountNative, amountForeign, to);
    }

    /*
     * @dev Allows swapping between two foreign assets from two different pools/pairs.
     *
     * It receives amount {foreignAmountIn} in {foreignAssetA} and returns the swapped amount in {foreignAssetB}.
     *
     * The amount {foreignAmountIn} is swapped to the native asset from the pair against {foreignAssetA} and the
     * received native asset is swapped to foreign asset from the pair against {foreignAssetB}.
     *
     * Updates the cumulative prices for native and foreign assets across pools against assets {foreignAssetA} and
     * {foreignAssetB}.
     *
     * Requirements:
     * - The amount {foreignAmountIn} in {foreignAssetA} must be transferred to the contract prior to calling
     *   the function `doubleSwap`.
     * - The intermediary native asset retrieved from first swap must be greater than 0 and the reserve for native asset.
     * - The foreign amount received from second swap must be greater than 0 and the reserve for foreign asset in the pair/pool
     *   against that particular foreign asset.
     * - The params {foreignAssetA} and {foreignAssetB} must be the supported tokens.
     * - Can only be called by Router.
     **/
    function doubleSwap(
        IERC20 foreignAssetA,
        IERC20 foreignAssetB,
        uint256 foreignAmountIn,
        address to
    )
        external
        override
        onlyRouter
        supportedToken(foreignAssetA)
        supportedToken(foreignAssetB)
        nonReentrant
        validateGas
        returns (uint256 foreignAmountOut)
    {
        (uint112 nativeReserve, uint112 foreignReserve, ) = getReserves(
            foreignAssetA
        ); // gas savings

        require(
            foreignReserve + foreignAmountIn <=
                foreignAssetA.balanceOf(address(this)),
            "BasePoolV2::doubleSwap: Insufficient Tokens Provided"
        );

        uint256 nativeAmountOut = VaderMath.calculateSwap(
            foreignAmountIn,
            foreignReserve,
            nativeReserve
        );

        require(
            nativeAmountOut > 0 && nativeAmountOut <= nativeReserve,
            "BasePoolV2::doubleSwap: Swap Impossible"
        );

        _update(
            foreignAssetA,
            nativeReserve - nativeAmountOut,
            foreignReserve + foreignAmountIn,
            nativeReserve,
            foreignReserve
        );

        emit Swap(
            foreignAssetA,
            msg.sender,
            0,
            foreignAmountIn,
            nativeAmountOut,
            0,
            address(this)
        );

        (nativeReserve, foreignReserve, ) = getReserves(foreignAssetB); // gas savings

        foreignAmountOut = VaderMath.calculateSwap(
            nativeAmountOut,
            nativeReserve,
            foreignReserve
        );

        require(
            foreignAmountOut > 0 && foreignAmountOut <= foreignReserve,
            "BasePoolV2::doubleSwap: Swap Impossible"
        );

        _update(
            foreignAssetB,
            nativeReserve + nativeAmountOut,
            foreignReserve - foreignAmountOut,
            nativeReserve,
            foreignReserve
        );

        emit Swap(
            foreignAssetB,
            msg.sender,
            nativeAmountOut,
            0,
            0,
            foreignAmountOut,
            to
        );

        foreignAssetB.safeTransfer(to, foreignAmountOut);
    }

    /*
     * @dev Allows swapping between native and foreign assets from within a single pair/pool determined
     * by {foreignAsset}.
     *
     * It receives the source asset and computes the destination asset and transfers it to the {to} address.
     *
     * Updates the cumulative prices for native and foreign assets for the pair involved after performing swap.
     *
     * Returns the amount of destination tokens resulting from the swap.
     *
     * Requirements:
     * - Param {nativeAmountIn} must be zero and {foreignAmountIn} must be non-zero
     *   if the destination asset in swap is native asset.
     * - Param {foreignAmountIn} must be zero and {nativeAmountIn} must be non zero
     *   if the destination asset in swap is foreign asset.
     * - Param {to} cannot be the addresses of native or foreign assets.
     * - The source asset amount in the swap must be transferred to the pool prior to calling `swap`.
     * - The source asset amount in the swap cannot exceed the source asset's reserve.
     * - The destination asset's amount in the swap must be greater than 0 and not exceed destination
     *   asset's reserve.
     * - The param {foreignAsset} must be a supported token.
     * - Can only be called by Router.
     **/
    function swap(
        IERC20 foreignAsset,
        uint256 nativeAmountIn,
        uint256 foreignAmountIn,
        address to
    )
        external
        override
        onlyRouter
        supportedToken(foreignAsset)
        nonReentrant
        validateGas
        returns (uint256)
    {
        require(
            (nativeAmountIn > 0 && foreignAmountIn == 0) ||
                (nativeAmountIn == 0 && foreignAmountIn > 0),
            "BasePoolV2::swap: Only One-Sided Swaps Supported"
        );
        (uint112 nativeReserve, uint112 foreignReserve, ) = getReserves(
            foreignAsset
        ); // gas savings

        uint256 nativeAmountOut;
        uint256 foreignAmountOut;
        {
            // scope for _token{0,1}, avoids stack too deep errors
            IERC20 _nativeAsset = nativeAsset;
            require(
                to != address(_nativeAsset) && to != address(foreignAsset),
                "BasePoolV2::swap: Invalid Receiver"
            );

            if (foreignAmountIn > 0) {
                nativeAmountOut = VaderMath.calculateSwap(
                    foreignAmountIn,
                    foreignReserve,
                    nativeReserve
                );
                require(
                    nativeAmountOut > 0 && nativeAmountOut <= nativeReserve,
                    "BasePoolV2::swap: Swap Impossible"
                );
                _nativeAsset.safeTransfer(to, nativeAmountOut); // optimistically transfer tokens
            } else {
                foreignAmountOut = VaderMath.calculateSwap(
                    nativeAmountIn,
                    nativeReserve,
                    foreignReserve
                );
                require(
                    foreignAmountOut > 0 && foreignAmountOut <= foreignReserve,
                    "BasePoolV2::swap: Swap Impossible"
                );
                foreignAsset.safeTransfer(to, foreignAmountOut); // optimistically transfer tokens
            }
        }

        _update(
            foreignAsset,
            nativeReserve - nativeAmountOut + nativeAmountIn,
            foreignReserve - foreignAmountOut + foreignAmountIn,
            nativeReserve,
            foreignReserve
        );

        emit Swap(
            foreignAsset,
            msg.sender,
            nativeAmountIn,
            foreignAmountIn,
            nativeAmountOut,
            foreignAmountOut,
            to
        );

        return nativeAmountOut > 0 ? nativeAmountOut : foreignAmountOut;
    }

    /*
     * @dev Allows withdrawing of unaccounted/unrealised foreign asset from the contract.
     *
     * Determines the realised amount of foreign asset from the pair against {foreignAsset}.
     **/
    function rescue(IERC20 foreignAsset) external {
        uint256 foreignBalance = foreignAsset.balanceOf(address(this));
        uint256 reserveForeign = pairInfo[foreignAsset].reserveForeign;

        uint256 unaccounted = foreignBalance - reserveForeign;

        foreignAsset.safeTransfer(msg.sender, unaccounted);
    }

    /* ========== RESTRICTED FUNCTIONS ========== */

    /* ========== INTERNAL FUNCTIONS ========== */

    /*
     * @dev Internally called to update the cumulative prices for native and foreign assets for
     * the pair against {foreignAsset}. The updated prices depend upon the last reserves and
     * updates the reserves for both of the assets corresponding to their
     * current balances along with the timestamp.
     *
     * Requirements:
     * - Params {balanceNative} and {balanceForeign} must not overflow type `uint112`.
     *
     **/
    function _update(
        IERC20 foreignAsset,
        uint256 balanceNative,
        uint256 balanceForeign,
        uint112 reserveNative,
        uint112 reserveForeign
    ) internal {
        require(
            balanceNative <= type(uint112).max &&
                balanceForeign <= type(uint112).max,
            "BasePoolV2::_update: Balance Overflow"
        );
        uint32 blockTimestamp = uint32(block.timestamp % 2**32);
        PairInfo storage pair = pairInfo[foreignAsset];
        unchecked {
            uint32 timeElapsed = blockTimestamp - pair.blockTimestampLast; // overflow is desired
            if (timeElapsed > 0 && reserveNative != 0 && reserveForeign != 0) {
                // * never overflows, and + overflow is desired
                pair.priceCumulative.nativeLast +=
                    uint256(
                        UQ112x112.encode(reserveForeign).uqdiv(reserveNative)
                    ) *
                    timeElapsed;
                pair.priceCumulative.foreignLast +=
                    uint256(
                        UQ112x112.encode(reserveNative).uqdiv(reserveForeign)
                    ) *
                    timeElapsed;
            }
        }
        pair.reserveNative = uint112(balanceNative);
        pair.reserveForeign = uint112(balanceForeign);
        pair.blockTimestampLast = blockTimestamp;
        emit Sync(foreignAsset, balanceNative, balanceForeign);
    }

    /* ========== PRIVATE FUNCTIONS ========== */

    /*
     * @dev Private function that returns if the param {token} is a supported token
     * or not.
     **/
    function _supportedToken(IERC20 token) private view {
        require(
            supported[token],
            "BasePoolV2::_supportedToken: Unsupported Token"
        );
    }

    /*
     * @dev Private function that returns if {msg.sender} is a Router or not.
     **/
    function _onlyRouter() private view {
        require(
            msg.sender == router,
            "BasePoolV2::_onlyRouter: Only Router is allowed to call"
        );
    }

    /* ========== MODIFIERS ========== */

    /*
     * @dev Modifier that only allows continuation of execution
     * if {msg.sender} is Router.
     **/
    modifier onlyRouter() {
        _onlyRouter();
        _;
    }

    /*
     * @dev Modifier that only allows continuation of exectuion if the param
     * {token} is a supported token.
     **/
    modifier supportedToken(IERC20 token) {
        _supportedToken(token);
        _;
    }
}
