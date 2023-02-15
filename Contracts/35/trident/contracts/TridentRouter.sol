// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity >=0.8.0;

import "./interfaces/IBentoBoxMinimal.sol";
import "./interfaces/IPool.sol";
import "./interfaces/ITridentRouter.sol";
import "./utils/TridentHelper.sol";
import "./deployer/MasterDeployer.sol";
import "hardhat/console.sol";

/// @notice Router contract that helps in swapping across Trident pools.
contract TridentRouter is ITridentRouter, TridentHelper {
    /// @notice BentoBox token vault.
    IBentoBoxMinimal public immutable bento;
    MasterDeployer public immutable masterDeployer;

    /// @dev Used to ensure that `tridentSwapCallback` is called only by the authorized address.
    /// These are set when someone calls a flash swap and reset afterwards.
    address internal cachedMsgSender;
    address internal cachedPool;

    mapping(address => bool) internal whitelistedPools;

    constructor(
        IBentoBoxMinimal _bento,
        MasterDeployer _masterDeployer,
        address _wETH
    ) TridentHelper(_wETH) {
        _bento.registerProtocol();
        bento = _bento;
        masterDeployer = _masterDeployer;
    }

    receive() external payable {
        require(msg.sender == wETH);
    }

    /// @notice Swaps token A to token B directly. Swaps are done on `bento` tokens.
    /// @param params This includes the address of token A, pool, amount of token A to swap,
    /// minimum amount of token B after the swap and data required by the pool for the swap.
    /// @dev Ensure that the pool is trusted before calling this function. The pool can steal users' tokens.
    function exactInputSingle(ExactInputSingleParams calldata params) public payable returns (uint256 amountOut) {
        // @dev Prefund the pool with token A.
        bento.transfer(params.tokenIn, msg.sender, params.pool, params.amountIn);
        // @dev Trigger the swap in the pool.
        amountOut = IPool(params.pool).swap(params.data);
        // @dev Ensure that the slippage wasn't too much. This assumes that the pool is honest.
        require(amountOut >= params.amountOutMinimum, "TOO_LITTLE_RECEIVED");
    }

    /// @notice Swaps token A to token B indirectly by using multiple hops.
    /// @param params This includes the addresses of the tokens, pools, amount of token A to swap,
    /// minimum amount of token B after the swap and data required by the pools for the swaps.
    /// @dev Ensure that the pools are trusted before calling this function. The pools can steal users' tokens.
    function exactInput(ExactInputParams calldata params) public payable returns (uint256 amountOut) {
        // @dev Pay the first pool directly.
        bento.transfer(params.tokenIn, msg.sender, params.path[0].pool, params.amountIn);
        // @dev Call every pool in the path.
        // Pool `N` should transfer its output tokens to pool `N+1` directly.
        // The last pool should transfer its output tokens to the user.
        // If the user wants to unwrap `wETH`, the final destination should be this contract and
        // a batch call should be made to `unwrapWETH`.
        for (uint256 i; i < params.path.length; i++) {
            // We don't necessarily need this check but saving users from themseleves.
            isWhiteListed(params.path[i].pool);
            amountOut = IPool(params.path[i].pool).swap(params.path[i].data);
        }
        // @dev Ensure that the slippage wasn't too much. This assumes that the pool is honest.
        require(amountOut >= params.amountOutMinimum, "TOO_LITTLE_RECEIVED");
    }

    /// @notice Swaps token A to token B by using callbacks.
    /// @param path Addresses of the pools and data required by the pools for the swaps.
    /// @param amountOutMinimum Minimum amount of token B after the swap.
    /// @dev Ensure that the pools are trusted before calling this function. The pools can steal users' tokens.
    /// This function will unlikely be used in production but it shows how to use callbacks. One use case will be arbitrage.
    function exactInputLazy(uint256 amountOutMinimum, Path[] calldata path) public payable returns (uint256 amountOut) {
        // @dev Call every pool in the path.
        // Pool `N` should transfer its output tokens to pool `N+1` directly.
        // The last pool should transfer its output tokens to the user.
        for (uint256 i; i < path.length; i++) {
            isWhiteListed(path[i].pool);
            // @dev The cached `msg.sender` is used as the funder when the callback happens.
            cachedMsgSender = msg.sender;
            // @dev The cached pool must be the address that calls the callback.
            cachedPool = path[i].pool;
            amountOut = IPool(path[i].pool).flashSwap(path[i].data);
        }
        // @dev Resets the `cachedPool` to get a refund.
        // `1` is used as the default value to avoid the storage slot being released.
        cachedMsgSender = address(1);
        cachedPool = address(1);
        require(amountOut >= amountOutMinimum, "TOO_LITTLE_RECEIVED");
    }

    /// @notice Swaps token A to token B directly. It's the same as `exactInputSingle` except
    /// it takes raw ERC-20 tokens from the users and deposits them into `bento`.
    /// @param params This includes the address of token A, pool, amount of token A to swap,
    /// minimum amount of token B after the swap and data required by the pool for the swap.
    /// @dev Ensure that the pool is trusted before calling this function. The pool can steal users' tokens.
    function exactInputSingleWithNativeToken(ExactInputSingleParams calldata params) public payable returns (uint256 amountOut) {
        // @dev Deposits the native ERC-20 token from the user into the pool's `bento`.
        _depositToBentoBox(params.tokenIn, params.pool, params.amountIn);
        // @dev Trigger the swap in the pool.
        amountOut = IPool(params.pool).swap(params.data);
        // @dev Ensure that the slippage wasn't too much. This assumes that the pool is honest.
        require(amountOut >= params.amountOutMinimum, "TOO_LITTLE_RECEIVED");
    }

    /// @notice Swaps token A to token B indirectly by using multiple hops. It's the same as `exactInput` except
    /// it takes raw ERC-20 tokens from the users and deposits them into `bento`.
    /// @param params This includes the addresses of the tokens, pools, amount of token A to swap,
    /// minimum amount of token B after the swap and data required by the pools for the swaps.
    /// @dev Ensure that the pools are trusted before calling this function. The pools can steal users' tokens.
    function exactInputWithNativeToken(ExactInputParams calldata params) public payable returns (uint256 amountOut) {
        // @dev Deposits the native ERC-20 token from the user into the pool's `bento`.
        _depositToBentoBox(params.tokenIn, params.path[0].pool, params.amountIn);
        // @dev Call every pool in the path.
        // Pool `N` should transfer its output tokens to pool `N+1` directly.
        // The last pool should transfer its output tokens to the user.
        for (uint256 i; i < params.path.length; i++) {
            isWhiteListed(params.path[i].pool);
            amountOut = IPool(params.path[i].pool).swap(params.path[i].data);
        }
        // @dev Ensure that the slippage wasn't too much. This assumes that the pool is honest.
        require(amountOut >= params.amountOutMinimum, "TOO_LITTLE_RECEIVED");
    }

    /// @notice Swaps multiple input tokens to multiple output tokens using multiple paths, in different percentages.
    /// For example, you can swap 50 DAI + 100 USDC into 60% ETH and 40% BTC.
    /// @param params This includes everything needed for the swap. Look at the `ComplexPathParams` struct for more details.
    /// @dev This function is not optimized for single swaps and should only be used in complex cases where
    /// the amounts are large enough that minimizing slippage by using multiple paths is worth the extra gas.
    function complexPath(ComplexPathParams calldata params) public payable {
        // @dev Deposit all initial tokens to respective pools and initiate the swaps.
        // Input tokens come from the user - output goes to following pools.
        for (uint256 i; i < params.initialPath.length; i++) {
            if (params.initialPath[i].native) {
                _depositToBentoBox(params.initialPath[i].tokenIn, params.initialPath[i].pool, params.initialPath[i].amount);
            } else {
                bento.transfer(params.initialPath[i].tokenIn, msg.sender, params.initialPath[i].pool, params.initialPath[i].amount);
            }
            isWhiteListed(params.initialPath[i].pool);
            IPool(params.initialPath[i].pool).swap(params.initialPath[i].data);
        }
        // @dev Do all the middle swaps. Input comes from previous pools - output goes to following pools.
        for (uint256 i; i < params.percentagePath.length; i++) {
            uint256 balanceShares = bento.balanceOf(params.percentagePath[i].tokenIn, address(this));
            uint256 transferShares = (balanceShares * params.percentagePath[i].balancePercentage) / uint256(10)**8;
            bento.transfer(params.percentagePath[i].tokenIn, address(this), params.percentagePath[i].pool, transferShares);
            isWhiteListed(params.percentagePath[i].pool);
            IPool(params.percentagePath[i].pool).swap(params.percentagePath[i].data);
        }
        // @dev Do all the final swaps. Input comes from previous pools - output goes to the user.
        for (uint256 i; i < params.output.length; i++) {
            uint256 balanceShares = bento.balanceOf(params.output[i].token, address(this));
            require(balanceShares >= params.output[i].minAmount, "TOO_LITTLE_RECEIVED");
            if (params.output[i].unwrapBento) {
                bento.withdraw(params.output[i].token, address(this), params.output[i].to, 0, balanceShares);
            } else {
                bento.transfer(params.output[i].token, address(this), params.output[i].to, balanceShares);
            }
        }
    }

    /// @notice Add liquidity to a pool.
    /// @param tokenInput Token address and amount to add as liquidity.
    /// @param pool Pool address to add liquidity to.
    /// @param minLiquidity Minimum output liquidity - caps slippage.
    /// @param data Data required by the pool to add liquidity.
    function addLiquidity(
        TokenInput[] memory tokenInput,
        address pool,
        uint256 minLiquidity,
        bytes calldata data
    ) public payable returns (uint256 liquidity) {
        isWhiteListed(pool);
        // @dev Send all input tokens to the pool.
        for (uint256 i; i < tokenInput.length; i++) {
            if (tokenInput[i].native) {
                _depositToBentoBox(tokenInput[i].token, pool, tokenInput[i].amount);
            } else {
                bento.transfer(tokenInput[i].token, msg.sender, pool, tokenInput[i].amount);
            }
        }
        liquidity = IPool(pool).mint(data);
        require(liquidity >= minLiquidity, "NOT_ENOUGH_LIQUIDITY_MINTED");
    }

    /// @notice Add liquidity to a pool using callbacks - same as `addLiquidity`, but now with callbacks.
    /// @dev The input tokens are sent to the pool during the callback.
    function addLiquidityLazy(
        address pool,
        uint256 minLiquidity,
        bytes calldata data
    ) public payable returns (uint256 liquidity) {
        isWhiteListed(pool);
        cachedMsgSender = msg.sender;
        cachedPool = pool;
        // @dev The pool must ensure that there's not too much slippage.
        liquidity = IPool(pool).mint(data);
        cachedMsgSender = address(1);
        cachedPool = address(1);
        require(liquidity >= minLiquidity, "NOT_ENOUGH_LIQUIDITY_MINTED");
    }

    /// @notice Burn liquidity tokens to get back `bento` tokens.
    /// @param pool Pool address.
    /// @param liquidity Amount of liquidity tokens to burn.
    /// @param data Data required by the pool to burn liquidity.
    /// @param minWithdrawals Minimum amount of `bento` tokens to be returned.
    function burnLiquidity(
        address pool,
        uint256 liquidity,
        bytes calldata data,
        IPool.TokenAmount[] memory minWithdrawals
    ) public {
        isWhiteListed(pool);
        safeTransferFrom(pool, msg.sender, pool, liquidity);
        IPool.TokenAmount[] memory withdrawnLiquidity = IPool(pool).burn(data);
        for (uint256 i; i < minWithdrawals.length; i++) {
            uint256 j;
            for (; j < withdrawnLiquidity.length; j++) {
                if (withdrawnLiquidity[j].token == minWithdrawals[i].token) {
                    require(withdrawnLiquidity[j].amount >= minWithdrawals[i].amount, "TOO_LITTLE_RECEIVED");
                    break;
                }
            }
            // @dev A token that is present in `minWithdrawals` is missing from `withdrawnLiquidity`.
            require(j < withdrawnLiquidity.length, "INCORRECT_TOKEN_WITHDRAWN");
        }
    }

    /// @notice Burn liquidity tokens to get back `bento` tokens.
    /// @dev The tokens are swapped automatically and the output is in a single token.
    /// @param pool Pool address.
    /// @param liquidity Amount of liquidity tokens to burn.
    /// @param data Data required by the pool to burn liquidity.
    /// @param minWithdrawal Minimum amount of tokens to be returned.
    function burnLiquiditySingle(
        address pool,
        uint256 liquidity,
        bytes calldata data,
        uint256 minWithdrawal
    ) public {
        isWhiteListed(pool);
        // @dev Use 'liquidity = 0' for prefunding.
        safeTransferFrom(pool, msg.sender, pool, liquidity);
        uint256 withdrawn = IPool(pool).burnSingle(data);
        require(withdrawn >= minWithdrawal, "TOO_LITTLE_RECEIVED");
    }

    /// @notice Used by the pool 'flashSwap' functionality to take input tokens from the user.
    function tridentSwapCallback(bytes calldata data) external {
        require(msg.sender == cachedPool, "UNAUTHORIZED_CALLBACK");
        TokenInput memory tokenInput = abi.decode(data, (TokenInput));
        // @dev Transfer the requested tokens to the pool.
        if (tokenInput.native) {
            _depositFromUserToBentoBox(tokenInput.token, cachedMsgSender, msg.sender, tokenInput.amount);
        } else {
            bento.transfer(tokenInput.token, cachedMsgSender, msg.sender, tokenInput.amount);
        }
        // @dev Resets the `msg.sender`'s authorization.
        cachedMsgSender = address(1);
    }

    /// @notice Can be used by the pool 'mint' functionality to take tokens from the user.
    function tridentMintCallback(bytes calldata data) external {
        require(msg.sender == cachedPool, "UNAUTHORIZED_CALLBACK");
        TokenInput[] memory tokenInput = abi.decode(data, (TokenInput[]));
        // @dev Transfer the requested tokens to the pool.
        for (uint256 i; i < tokenInput.length; i++) {
            if (tokenInput[i].native) {
                _depositFromUserToBentoBox(tokenInput[i].token, cachedMsgSender, msg.sender, tokenInput[i].amount);
            } else {
                bento.transfer(tokenInput[i].token, cachedMsgSender, msg.sender, tokenInput[i].amount);
            }
        }
        // @dev Resets the `msg.sender`'s authorization.
        cachedMsgSender = address(1);
    }

    /// @notice Recover mistakenly sent `bento` tokens.
    function sweepBentoBoxToken(
        address token,
        uint256 amount,
        address recipient
    ) external {
        bento.transfer(token, address(this), recipient, amount);
    }

    /// @notice Recover mistakenly sent ERC-20 tokens.
    function sweepNativeToken(
        address token,
        uint256 amount,
        address recipient
    ) external {
        safeTransfer(token, recipient, amount);
    }

    /// @notice Recover mistakenly sent ETH.
    function refundETH() external payable {
        if (address(this).balance != 0) safeTransferETH(msg.sender, address(this).balance);
    }

    /// @notice Unwrap this contract's `wETH` into ETH
    function unwrapWETH(uint256 amountMinimum, address recipient) external {
        uint256 balanceWETH = balanceOfThis(wETH);
        require(balanceWETH >= amountMinimum, "INSUFFICIENT_WETH");
        if (balanceWETH != 0) {
            withdrawFromWETH(balanceWETH);
            safeTransferETH(recipient, balanceWETH);
        }
    }

    function deployPool(address _factory, bytes calldata _deployData) external returns (address) {
        return masterDeployer.deployPool(_factory, _deployData);
    }

    function _depositToBentoBox(
        address token,
        address recipient,
        uint256 amount
    ) internal {
        if (token == wETH && address(this).balance != 0) {
            uint256 underlyingAmount = bento.toAmount(wETH, amount, true);
            if (address(this).balance >= underlyingAmount) {
                // @dev Deposit ETH into `recipient` `bento` account.
                bento.deposit{value: underlyingAmount}(address(0), address(this), recipient, 0, amount);
                return;
            }
        }
        // @dev Deposit ERC-20 token into `recipient` `bento` account.
        bento.deposit(token, msg.sender, recipient, 0, amount);
    }

    function _depositFromUserToBentoBox(
        address token,
        address sender,
        address recipient,
        uint256 amount
    ) internal {
        if (token == wETH && address(this).balance != 0) {
            uint256 underlyingAmount = bento.toAmount(wETH, amount, true);
            if (address(this).balance >= underlyingAmount) {
                // @dev Deposit ETH into `recipient` `bento` account.
                bento.deposit{value: underlyingAmount}(address(0), address(this), recipient, 0, amount);
                return;
            }
        }
        // @dev Deposit ERC-20 token into `recipient` `bento` account.
        bento.deposit(token, sender, recipient, 0, amount);
    }

    function isWhiteListed(address pool) internal {
        if (!whitelistedPools[pool]) {
            require(masterDeployer.pools(pool), "INVALID POOL");
            whitelistedPools[pool] = true;
        }
    }
}
