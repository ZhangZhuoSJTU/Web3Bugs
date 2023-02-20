// SPDX-License-Identifier: Unlicense

pragma solidity =0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";

import "./BasePoolV2.sol";

import "../../interfaces/shared/IERC20Extended.sol";
import "../../interfaces/dex-v2/pool/IVaderPoolV2.sol";
import "../../interfaces/dex-v2/wrapper/ILPWrapper.sol";
import "../../interfaces/dex-v2/synth/ISynthFactory.sol";

/*
 * @dev Implementation of {VaderPoolV2} contract.
 *
 * The contract VaderPool inherits from {BasePoolV2} contract and implements
 * queue system.
 *
 * Extends on the liquidity redeeming function by introducing the `burn` function
 * that internally calls the namesake on `BasePoolV2` contract and computes the
 * loss covered by the position being redeemed and returns it along with amounts
 * of native and foreign assets sent.
 **/
contract VaderPoolV2 is IVaderPoolV2, BasePoolV2, Ownable {
    /* ========== LIBRARIES ========== */

    // Used for safe token transfers
    using SafeERC20 for IERC20;

    /* ========== STATE VARIABLES ========== */

    // The LP wrapper contract
    ILPWrapper public wrapper;

    // The Synth Factory
    ISynthFactory public synthFactory;

    // Denotes whether the queue system is active
    bool public queueActive;

    /* ========== CONSTRUCTOR ========== */

    /*
     * @dev Initialised the contract state by passing the native asset's address
     * to the inherited {BasePoolV2} contract's constructor and setting queue status
     * to the {queueActive} state variable.
     **/
    constructor(bool _queueActive, IERC20 _nativeAsset)
        BasePoolV2(_nativeAsset)
    {
        queueActive = _queueActive;
    }

    /* ========== VIEWS ========== */

    /*
     * @dev Returns cumulative prices and the timestamp the were last updated
     * for both native and foreign assets against the pair specified by
     * parameter {foreignAsset}.
     **/
    function cumulativePrices(IERC20 foreignAsset)
        public
        view
        returns (
            uint256 price0CumulativeLast,
            uint256 price1CumulativeLast,
            uint32 blockTimestampLast
        )
    {
        PriceCumulative memory priceCumulative = pairInfo[foreignAsset]
            .priceCumulative;
        price0CumulativeLast = priceCumulative.nativeLast;
        price1CumulativeLast = priceCumulative.foreignLast;
        blockTimestampLast = pairInfo[foreignAsset].blockTimestampLast;
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    /*
     * @dev Initializes contract's state with LP wrapper, synth factory
     * and router addresses.
     *
     * Requirements:
     * - None of the parameters are zero addresses.
     * - The parameters are not already set.
     * - Only callable by contract owner.
     **/
    function initialize(
        ILPWrapper _wrapper,
        ISynthFactory _synthFactory,
        address _router
    ) external onlyOwner {
        require(
            wrapper == ILPWrapper(_ZERO_ADDRESS),
            "VaderPoolV2::initialize: Already initialized"
        );
        require(
            _wrapper != ILPWrapper(_ZERO_ADDRESS),
            "VaderPoolV2::initialize: Incorrect Wrapper Specified"
        );
        require(
            _synthFactory != ISynthFactory(_ZERO_ADDRESS),
            "VaderPoolV2::initialize: Incorrect SynthFactory Specified"
        );
        require(
            _router != _ZERO_ADDRESS,
            "VaderPoolV2::initialize: Incorrect Router Specified"
        );
        wrapper = _wrapper;
        synthFactory = _synthFactory;
        router = _router;
    }

    /*
     * @dev Allows minting of synthetic assets corresponding to the {foreignAsset} based
     * on the native asset amount deposited and returns the minted synth asset amount.
     *
     * Creates the synthetic asset against {foreignAsset} if it does not already exist.
     *
     * Updates the cumulative prices for native and foreign assets.
     *
     * Requirements:
     * - {foreignAsset} must be a supported token.
     **/
    function mintSynth(
        IERC20 foreignAsset,
        uint256 nativeDeposit,
        address from,
        address to
    )
        external
        override
        nonReentrant
        supportedToken(foreignAsset)
        returns (uint256 amountSynth)
    {
        nativeAsset.safeTransferFrom(from, address(this), nativeDeposit);

        ISynth synth = synthFactory.synths(foreignAsset);

        if (synth == ISynth(_ZERO_ADDRESS))
            synth = synthFactory.createSynth(
                IERC20Extended(address(foreignAsset))
            );

        (uint112 reserveNative, uint112 reserveForeign, ) = getReserves(
            foreignAsset
        ); // gas savings

        amountSynth = VaderMath.calculateSwap(
            nativeDeposit,
            reserveNative,
            reserveForeign
        );

        // TODO: Clarify
        _update(
            foreignAsset,
            reserveNative + nativeDeposit,
            reserveForeign,
            reserveNative,
            reserveForeign
        );

        synth.mint(to, amountSynth);
    }

    /*
     * @dev Allows burning of synthetic assets corresponding to the {foreignAsset}
     * and returns the redeemed amount of native asset.
     *
     * Updates the cumulative prices for native and foreign assets.
     *
     * Requirements:
     * - {foreignAsset} must have a valid synthetic asset against it.
     * - {synthAmount} must be greater than zero.
     **/
    function burnSynth(
        IERC20 foreignAsset,
        uint256 synthAmount,
        address to
    ) external override nonReentrant returns (uint256 amountNative) {
        ISynth synth = synthFactory.synths(foreignAsset);

        require(
            synth != ISynth(_ZERO_ADDRESS),
            "VaderPoolV2::burnSynth: Inexistent Synth"
        );

        require(
            synthAmount > 0,
            "VaderPoolV2::burnSynth: Insufficient Synth Amount"
        );

        IERC20(synth).safeTransferFrom(msg.sender, address(this), synthAmount);
        synth.burn(synthAmount);

        (uint112 reserveNative, uint112 reserveForeign, ) = getReserves(
            foreignAsset
        ); // gas savings

        amountNative = VaderMath.calculateSwap(
            synthAmount,
            reserveForeign,
            reserveNative
        );

        // TODO: Clarify
        _update(
            foreignAsset,
            reserveNative - amountNative,
            reserveForeign,
            reserveNative,
            reserveForeign
        );

        nativeAsset.safeTransfer(to, amountNative);
    }

    /*
     * @dev Allows burning of NFT represented by param {id} for liquidity redeeming.
     *
     * Deletes the position in {positions} mapping against the burned NFT token.
     *
     * Internally calls `_burn` function on {BasePoolV2} contract.
     *
     * Calculates the impermanent loss incurred by the position.
     *
     * Returns the amounts for native and foreign assets sent to the {to} address
     * along with the covered loss.
     *
     * Requirements:
     * - Can only be called by the Router.
     **/
    // NOTE: IL is only covered via router!
    function burn(uint256 id, address to)
        external
        override
        onlyRouter
        returns (
            uint256 amountNative,
            uint256 amountForeign,
            uint256 coveredLoss
        )
    {
        (amountNative, amountForeign) = _burn(id, to);

        Position storage position = positions[id];

        uint256 creation = position.creation;
        uint256 originalNative = position.originalNative;
        uint256 originalForeign = position.originalForeign;

        delete positions[id];

        // NOTE: Validate it behaves as expected for non-18 decimal tokens
        uint256 loss = VaderMath.calculateLoss(
            originalNative,
            originalForeign,
            amountNative,
            amountForeign
        );

        // TODO: Original Implementation Applied 100 Days
        coveredLoss =
            (loss * _min(block.timestamp - creation, _ONE_YEAR)) /
            _ONE_YEAR;
    }

    /*
     * @dev Allows minting of liquidity in fungible tokens. The fungible token
     * is a wrapped LP token against a particular pair. The liquidity issued is also
     * tracked within this contract along with liquidity issued against non-fungible
     * token.
     *
     * Updates the cumulative prices for native and foreign assets.
     *
     * Calls 'mint' on the LP wrapper token contract.
     *
     * Requirements:
     * - LP wrapper token must exist against {foreignAsset}.
     **/
    function mintFungible(
        IERC20 foreignAsset,
        uint256 nativeDeposit,
        uint256 foreignDeposit,
        address from,
        address to
    ) external override nonReentrant returns (uint256 liquidity) {
        IERC20Extended lp = wrapper.tokens(foreignAsset);

        require(
            lp != IERC20Extended(_ZERO_ADDRESS),
            "VaderPoolV2::mintFungible: Unsupported Token"
        );

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
            "VaderPoolV2::mintFungible: Insufficient Liquidity Provided"
        );

        pair.totalSupply = totalLiquidityUnits + liquidity;

        _update(
            foreignAsset,
            reserveNative + nativeDeposit,
            reserveForeign + foreignDeposit,
            reserveNative,
            reserveForeign
        );

        lp.mint(to, liquidity);

        emit Mint(from, to, nativeDeposit, foreignDeposit);
    }

    /*
     * @dev Allows burning of liquidity issued in fungible tokens.
     *
     * Updates the cumulative prices for native and foreign assets.
     *
     * Calls 'burn' on the LP wrapper token contract.
     *
     * Requirements:
     * - LP wrapper token must exist against {foreignAsset}.
     * - {amountNative} and {amountForeign} redeemed, both must be greater than zero.,
     **/
    function burnFungible(
        IERC20 foreignAsset,
        uint256 liquidity,
        address to
    )
        external
        override
        nonReentrant
        returns (uint256 amountNative, uint256 amountForeign)
    {
        IERC20Extended lp = wrapper.tokens(foreignAsset);

        require(
            lp != IERC20Extended(_ZERO_ADDRESS),
            "VaderPoolV2::burnFungible: Unsupported Token"
        );

        IERC20(lp).safeTransferFrom(msg.sender, address(this), liquidity);
        lp.burn(liquidity);

        (uint112 reserveNative, uint112 reserveForeign, ) = getReserves(
            foreignAsset
        ); // gas savings

        PairInfo storage pair = pairInfo[foreignAsset];
        uint256 _totalSupply = pair.totalSupply;
        amountNative = (liquidity * reserveNative) / _totalSupply;
        amountForeign = (liquidity * reserveForeign) / _totalSupply;

        require(
            amountNative > 0 && amountForeign > 0,
            "VaderPoolV2::burnFungible: Insufficient Liquidity Burned"
        );

        pair.totalSupply = _totalSupply - liquidity;

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

    /* ========== RESTRICTED FUNCTIONS ========== */

    // TODO: Investigate Necessity
    function toggleQueue() external override onlyOwner {
        bool _queueActive = !queueActive;
        queueActive = _queueActive;
        emit QueueActive(_queueActive);
    }

    /*
     * @dev Sets the supported state of the token represented by param {foreignAsset}.
     *
     * Requirements:
     * - The param {foreignAsset} is not already a supported token.
     **/
    function setTokenSupport(IERC20 foreignAsset, bool support)
        external
        override
        onlyOwner
    {
        require(
            supported[foreignAsset] != support,
            "VaderPoolV2::supportToken: Already At Desired State"
        );
        supported[foreignAsset] = support;
    }

    /*
     * @dev Sets the supported state of the token represented by param {foreignAsset}.
     *
     * Requirements:
     * - The param {foreignAsset} is not already a supported token.
     **/
    function setFungibleTokenSupport(IERC20 foreignAsset)
        external
        override
        onlyOwner
    {
        wrapper.createWrapper(foreignAsset);
    }

    /* ========== INTERNAL FUNCTIONS ========== */

    /* ========== PRIVATE FUNCTIONS ========== */

    /**
     * @dev Calculates the minimum of the two values
     */
    function _min(uint256 a, uint256 b) private pure returns (uint256) {
        return a < b ? a : b;
    }
}
