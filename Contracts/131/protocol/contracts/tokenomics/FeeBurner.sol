// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../../libraries/AddressProviderHelpers.sol";
import "../../libraries/Errors.sol";
import "../../libraries/UncheckedMath.sol";
import "../../interfaces/pool/ILiquidityPool.sol";
import "../../interfaces/IFeeBurner.sol";
import "../../interfaces/ISwapperRouter.sol";
import "../../interfaces/IAddressProvider.sol";

/**
 * The Fee Burner converts all of the callers Backd LP Tokens to a single target Backd LP Token.
 * It first burns the Pool LP Tokens for the Pool underlying.
 * Then it swaps all the underlyings for the target Pool underlying.
 * Finally it deposits the Pool underlying into the target Pool to get the target LP Token.
 */
contract FeeBurner is IFeeBurner {
    using SafeERC20 for IERC20;
    using UncheckedMath for uint256;
    using AddressProviderHelpers for IAddressProvider;

    address private constant _WETH = address(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2); // WETH

    IAddressProvider private immutable _addressProvider; // Address Provider, used for getting pools and swapper router

    event Burned(address targetLpToken, uint256 amountBurned); // Emmited after a successfull burn to target lp token

    constructor(address addressProvider_) {
        _addressProvider = IAddressProvider(addressProvider_);
    }

    receive() external payable {} // Recieve function for withdrawing from Backd ETH Pool

    /**
     * @notice Converts callers Tokens to target Backd LP Token for the given tokens_.
     * @param tokens_ The Tokens to convert to the targetLpToken_.
     * @param targetLpToken_ The LP Token that should be received.
     * @return received The amount of the target LP Token received.
     */
    function burnToTarget(address[] memory tokens_, address targetLpToken_)
        public
        payable
        override
        returns (uint256 received)
    {
        require(tokens_.length != 0, "No tokens to burn");

        // Swapping tokens for WETH
        ILiquidityPool targetPool_ = _addressProvider.getPoolForToken(targetLpToken_);
        address targetUnderlying_ = targetPool_.getUnderlying();
        ISwapperRouter swapperRouter_ = _swapperRouter();
        bool burningEth_;
        for (uint256 i; i < tokens_.length; i = i.uncheckedInc()) {
            IERC20 token_ = IERC20(tokens_[i]);

            // Handling ETH
            if (address(token_) == address(0)) {
                if (msg.value == 0) continue;
                burningEth_ = true;
                swapperRouter_.swapAll{value: msg.value}(address(token_), _WETH);
                continue;
            }

            // Handling ERC20
            uint256 tokenBalance_ = token_.balanceOf(msg.sender);
            if (tokenBalance_ == 0) continue;
            token_.safeTransferFrom(msg.sender, address(this), tokenBalance_);
            if (address(token_) == targetUnderlying_) continue;
            _approve(address(token_), address(swapperRouter_));
            swapperRouter_.swap(address(token_), _WETH, tokenBalance_);
        }
        require(burningEth_ || msg.value == 0, Error.INVALID_VALUE);

        // Swapping WETH for target underlying
        _approve(_WETH, address(swapperRouter_));
        swapperRouter_.swapAll(_WETH, targetUnderlying_);

        // Depositing target underlying into target pool
        uint256 targetLpTokenBalance_ = _depositInPool(targetUnderlying_, targetPool_);

        // Transfering LP tokens back to sender
        IERC20(targetLpToken_).safeTransfer(msg.sender, targetLpTokenBalance_);
        emit Burned(targetLpToken_, targetLpTokenBalance_);
        return targetLpTokenBalance_;
    }

    /**
     * @dev Deposits underlying into pool to receive LP Tokens.
     * @param underlying_ The underlying of the pool.
     * @param pool_ The pool to deposit into.
     * @return received The amount of LP Tokens received.
     */
    function _depositInPool(address underlying_, ILiquidityPool pool_)
        internal
        returns (uint256 received)
    {
        // Handling ETH deposits
        if (underlying_ == address(0)) {
            uint256 ethBalance_ = address(this).balance;
            return pool_.deposit{value: ethBalance_}(ethBalance_);
        }

        // Handling ERC20 deposits
        _approve(underlying_, address(pool_));
        return pool_.deposit(IERC20(underlying_).balanceOf(address(this)));
    }

    /**
     * @dev Approves infinite spending for the given spender.
     * @param token_ The token to approve for.
     * @param spender_ The spender to approve.
     */
    function _approve(address token_, address spender_) internal {
        if (IERC20(token_).allowance(address(this), spender_) > 0) return;
        IERC20(token_).safeApprove(spender_, type(uint256).max);
    }

    /**
     * @dev Gets the swapper router.
     * @return The swapper router.
     */
    function _swapperRouter() internal view returns (ISwapperRouter) {
        return _addressProvider.getSwapperRouter();
    }
}
