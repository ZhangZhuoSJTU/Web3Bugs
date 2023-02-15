// SPDX-License-Identifier: Unlicense

pragma solidity =0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "../math/VaderMath.sol";
// import "../queue/SwapQueue.sol";
import "../utils/GasThrottle.sol";

import "../../external/libraries/UQ112x112.sol";

import "../../interfaces/dex/pool/IBasePool.sol";
import "../../interfaces/shared/IERC20Extended.sol";

/*
 * @dev Implementation of {BasePool} contract.
 *
 * The BasePool contract represents pool of two assets termed as native and
 * foreign assets. The functionality in this contract allows depositing of both
 * of these assets to mint liquidity. Minted liquidity is associated with a
 * position which is represented by an NFT token.
 *
 * The contract allows burning of NFT and in turn redeems the associated liquidity,
 * transferring out underlying assets to the LP.
 *
 * The contract allows swapping of both native and foreign assets among themselves.
 *
 * Keeps track of the cumulative prices for both native and foreign assets and updates
 * them after minting and burning of liquidity, and swapping of assets.
 **/
contract BasePool is IBasePool, GasThrottle, ERC721, Ownable, ReentrancyGuard {
    /* ========== LIBRARIES ========== */

    // Used for safe token transfers
    using SafeERC20 for IERC20;

    // Used by Uniswap-like TWAP mechanism
    using UQ112x112 for uint224;

    /* ========== STATE VARIABLES ========== */

    // Address of native asset (Vader or USDV).
    IERC20 public immutable nativeAsset;

    // Address of foreign asset with which the native asset is paired in the pool.
    IERC20 public immutable foreignAsset;

    // Cumulative price of native asset.
    uint256 public priceNativeCumulativeLast;

    // Cumulative price of foreign asset.
    uint256 public priceForeignCumulativeLast;

    /*
     * @dev A mapping representing positions of liquidity providers. Each position
     * is an Non-fungible token that is mapped against amounts of native and foreign assets
     * deposited, the timestamp at which the position is created and the amount of
     * liquidity assigned to the LP.
     *
     * Each position in the mapping is mapped against {positionId}.
     **/
    mapping(uint256 => Position) public positions;

    // A unique id the of the position created when liquidity is added to the pool.
    uint256 public positionId;

    // Total amount of liquidity units minted.
    uint256 public totalSupply;

    // Name of the contract.
    string private _name;

    // Total amount of the native asset realised by the contract.
    uint112 private _reserveNative; // uses single storage slot, accessible via getReserves

    // Total amount of the foreign asset realised by the contract.
    uint112 private _reserveForeign; // uses single storage slot, accessible via getReserves

    // Last timestamp at which the cumulative prices for native and foreign assets were updated.
    uint32 private _blockTimestampLast; // uses single storage slot, accessible via getReserves

    /* ========== CONSTRUCTOR ========== */

    /*
     * @dev Initialized the contract state setting the addresses for native and foreign assets.
     *
     * Also computes the name of the contract and stores it in the contract's state.
     **/
    constructor(IERC20Extended _nativeAsset, IERC20Extended _foreignAsset)
        ERC721("Vader LP", "VLP")
    {
        nativeAsset = IERC20(_nativeAsset);
        foreignAsset = IERC20(_foreignAsset);

        string memory calculatedName = string(
            abi.encodePacked("Vader USDV /", _foreignAsset.symbol(), " LP")
        );
        _name = calculatedName;
    }

    /* ========== VIEWS ========== */

    /*
     * @dev Returns the realised amount of native and foreign assets, and the last timestamp
     * at which the cumulative prices for native and foreign assets were updated.
     **/
    function getReserves()
        public
        view
        returns (
            uint112 reserveNative,
            uint112 reserveForeign,
            uint32 blockTimestampLast
        )
    {
        reserveNative = _reserveNative;
        reserveForeign = _reserveForeign;
        blockTimestampLast = _blockTimestampLast;
    }

    // Returns the name of the contract.
    function name() public view override returns (string memory) {
        return _name;
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    /*
     * @dev Allows depositing of liquidity to the pool by accepting native and foreign assets
     * and mints an NFT to the {to} address which records the amounts of the native and foreign
     * assets deposited and the liquidity units minted against it in {positions} mapping.
     *
     * Updates the total supply of liquidity units by adding currently minted liquidity units
     * to {totalSupply}.
     *
     * Updates the cumulative prices of native and foreign assets after minting the appropriate
     * liquidity units.
     *
     * Requirements:
     * - Amounts of native and foreign must be sent to the pool prior to calling `mint` such that
     *   balance of pool for both assets must be greater than their corresponding reserves.
     * - The amount of {liquidity} to be minted must be greater than 0.
     **/
    function mint(address to)
        external
        override
        nonReentrant
        returns (uint256 liquidity)
    {
        (uint112 reserveNative, uint112 reserveForeign, ) = getReserves(); // gas savings
        uint256 balanceNative = nativeAsset.balanceOf(address(this));
        uint256 balanceForeign = foreignAsset.balanceOf(address(this));
        uint256 nativeDeposit = balanceNative - reserveNative;
        uint256 foreignDeposit = balanceForeign - reserveForeign;

        uint256 totalLiquidityUnits = totalSupply;
        if (totalLiquidityUnits == 0)
            liquidity = nativeDeposit; // TODO: Contact ThorChain on proper approach
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
            "BasePool::mint: Insufficient Liquidity Provided"
        );

        uint256 id = positionId++;

        totalSupply += liquidity;
        _mint(to, id);

        positions[id] = Position(
            block.timestamp,
            liquidity,
            nativeDeposit,
            foreignDeposit
        );

        _update(balanceNative, balanceForeign, reserveNative, reserveForeign);

        emit Mint(msg.sender, to, nativeDeposit, foreignDeposit);
        emit PositionOpened(msg.sender, id, liquidity);
    }

    /*
     * @dev Allows redeeming of liquidity units by burning the NFT associated with the liquidity
     * position.
     *
     * Computes the amounts of native and foreign assets depending upon current reserves of assets and
     * the liquidity associated with the position, and transfers them to the {to} address.
     *
     * Burns the redeemed NFT token and decreases {totalSupply} by the {liquidity}
     * associated with that NFT token.
     *
     * Updates the cumulative prices for native and foreign assets after transferring the assets
     * to the {to} address.
     *
     * Requirements:
     * - The NFT token being redeemed must be transferred to the pool prior to calling `_burn`.
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
            "BasePool::burn: Incorrect Ownership"
        );

        (uint112 reserveNative, uint112 reserveForeign, ) = getReserves(); // gas savings
        IERC20 _nativeAsset = nativeAsset; // gas savings
        IERC20 _foreignAsset = foreignAsset; // gas savings
        uint256 nativeBalance = IERC20(_nativeAsset).balanceOf(address(this));
        uint256 foreignBalance = IERC20(_foreignAsset).balanceOf(address(this));

        uint256 liquidity = positions[id].liquidity;

        uint256 _totalSupply = totalSupply; // gas savings, must be defined here since totalSupply can update in _mintFee
        amountNative = (liquidity * nativeBalance) / _totalSupply; // using balances ensures pro-rata distribution
        amountForeign = (liquidity * foreignBalance) / _totalSupply; // using balances ensures pro-rata distribution

        require(
            amountNative > 0 && amountForeign > 0,
            "BasePool::burn: Insufficient Liquidity Burned"
        );

        totalSupply -= liquidity;
        _burn(id);

        _nativeAsset.safeTransfer(to, amountNative);
        _foreignAsset.safeTransfer(to, amountForeign);

        nativeBalance = _nativeAsset.balanceOf(address(this));
        foreignBalance = _foreignAsset.balanceOf(address(this));

        _update(nativeBalance, foreignBalance, reserveNative, reserveForeign);

        emit Burn(msg.sender, amountNative, amountForeign, to);
    }

    /*
     * @dev  Allows swapping between native and foreign assets. It receives the source asset
     * and computes the destination asset and transfers it to the {to} address.
     *
     * Internally calls {swap} function.
     **/
    function swap(
        uint256 nativeAmountIn,
        uint256 foreignAmountIn,
        address to,
        bytes calldata
    ) external override returns (uint256) {
        return swap(nativeAmountIn, foreignAmountIn, to);
    }

    /*
     * @dev Allows swapping between native and foreign assets. It receives the source asset
     * and computes the destination asset and transfers it to the {to} address.
     *
     * Updates the cumulative prices for native and foreign assets after performing swap.
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
     **/
    function swap(
        uint256 nativeAmountIn,
        uint256 foreignAmountIn,
        address to
    ) public override nonReentrant validateGas returns (uint256) {
        require(
            (nativeAmountIn > 0 && foreignAmountIn == 0) ||
                (nativeAmountIn == 0 && foreignAmountIn > 0),
            "BasePool::swap: Only One-Sided Swaps Supported"
        );
        (uint112 nativeReserve, uint112 foreignReserve, ) = getReserves(); // gas savings

        uint256 nativeBalance;
        uint256 foreignBalance;
        uint256 nativeAmountOut;
        uint256 foreignAmountOut;
        {
            // scope for _token{0,1}, avoids stack too deep errors
            IERC20 _nativeAsset = nativeAsset;
            IERC20 _foreignAsset = foreignAsset;
            nativeBalance = _nativeAsset.balanceOf(address(this));
            foreignBalance = _foreignAsset.balanceOf(address(this));

            require(
                to != address(_nativeAsset) && to != address(_foreignAsset),
                "BasePool::swap: Invalid Receiver"
            );

            if (foreignAmountIn > 0) {
                require(
                    foreignAmountIn <= foreignBalance - foreignReserve,
                    "BasePool::swap: Insufficient Tokens Provided"
                );
                require(
                    foreignAmountIn <= foreignReserve,
                    "BasePool::swap: Unfavourable Trade"
                );

                nativeAmountOut = VaderMath.calculateSwap(
                    foreignAmountIn,
                    foreignReserve,
                    nativeReserve
                );

                require(
                    nativeAmountOut > 0 && nativeAmountOut <= nativeReserve,
                    "BasePool::swap: Swap Impossible"
                );

                _nativeAsset.safeTransfer(to, nativeAmountOut); // optimistically transfer tokens
            } else {
                require(
                    nativeAmountIn <= nativeBalance - nativeReserve,
                    "BasePool::swap: Insufficient Tokens Provided"
                );
                require(
                    nativeAmountIn <= nativeReserve,
                    "BasePool::swap: Unfavourable Trade"
                );

                foreignAmountOut = VaderMath.calculateSwap(
                    nativeAmountIn,
                    nativeReserve,
                    foreignReserve
                );

                require(
                    foreignAmountOut > 0 && foreignAmountOut <= foreignReserve,
                    "BasePool::swap: Swap Impossible"
                );

                _foreignAsset.safeTransfer(to, foreignAmountOut); // optimistically transfer tokens
            }

            nativeBalance = _nativeAsset.balanceOf(address(this));
            foreignBalance = _foreignAsset.balanceOf(address(this));
        }

        _update(nativeBalance, foreignBalance, nativeReserve, foreignReserve);

        emit Swap(
            msg.sender,
            nativeAmountIn,
            foreignAmountIn,
            nativeAmountOut,
            foreignAmountOut,
            to
        );

        return nativeAmountOut > 0 ? nativeAmountOut : foreignAmountOut;
    }

    /* ========== RESTRICTED FUNCTIONS ========== */

    /* ========== INTERNAL FUNCTIONS ========== */

    /*
     * @dev Internally called to update the cumulative prices for native and foreign assets depending
     * upon the last reserves and updates the reserves for both of the assets corresponding to their
     * current balances along with the {_blockTimestampLast}.
     *
     * Requirements:
     * - Params {balanceNative} and {balanceForeign} must not overflow type `uint112`.
     *
     **/
    function _update(
        uint256 balanceNative,
        uint256 balanceForeign,
        uint112 reserveNative,
        uint112 reserveForeign
    ) internal {
        require(
            balanceNative <= type(uint112).max &&
                balanceForeign <= type(uint112).max,
            "BasePool::_update: Balance Overflow"
        );
        uint32 blockTimestamp = uint32(block.timestamp % 2**32);
        unchecked {
            uint32 timeElapsed = blockTimestamp - _blockTimestampLast; // overflow is desired
            if (timeElapsed > 0 && reserveNative != 0 && reserveForeign != 0) {
                // * never overflows, and + overflow is desired
                priceNativeCumulativeLast +=
                    uint256(
                        UQ112x112.encode(reserveForeign).uqdiv(reserveNative)
                    ) *
                    timeElapsed;
                priceForeignCumulativeLast +=
                    uint256(
                        UQ112x112.encode(reserveNative).uqdiv(reserveForeign)
                    ) *
                    timeElapsed;
            }
        }
        _reserveNative = uint112(balanceNative);
        _reserveForeign = uint112(balanceForeign);
        _blockTimestampLast = blockTimestamp;
        emit Sync(balanceNative, balanceForeign);
    }

    /* ========== PRIVATE FUNCTIONS ========== */

    /* ========== MODIFIERS ========== */
}
