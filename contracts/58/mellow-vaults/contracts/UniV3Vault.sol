// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.9;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./interfaces/external/univ3/INonfungiblePositionManager.sol";
import "./interfaces/external/univ3/IUniswapV3Pool.sol";
import "./interfaces/external/univ3/IUniswapV3Factory.sol";
import "./interfaces/IUniV3VaultGovernance.sol";
import "./libraries/external/TickMath.sol";
import "./libraries/external/LiquidityAmounts.sol";
import "./Vault.sol";
import "./libraries/ExceptionsLibrary.sol";

/// @notice Vault that interfaces UniswapV3 protocol in the integration layer.
contract UniV3Vault is IERC721Receiver, Vault {
    struct Options {
        uint256 amount0Min;
        uint256 amount1Min;
        uint256 deadline;
    }

    struct Pair {
        uint256 a0;
        uint256 a1;
    }

    IUniswapV3Pool public immutable pool;

    uint256 public uniV3Nft;

    /// @notice Creates a new contract.
    /// @param vaultGovernance_ Reference to VaultGovernance for this vault
    /// @param vaultTokens_ ERC20 tokens under Vault management
    /// @param fee Fee of the underlying UniV3 pool
    constructor(
        IVaultGovernance vaultGovernance_,
        address[] memory vaultTokens_,
        uint24 fee
    ) Vault(vaultGovernance_, vaultTokens_) {
        require(_vaultTokens.length == 2, ExceptionsLibrary.TOKEN_LENGTH);
        pool = IUniswapV3Pool(
            IUniswapV3Factory(_positionManager().factory()).getPool(_vaultTokens[0], _vaultTokens[1], fee)
        );
    }

    function onERC721Received(address operator, address from, uint256 tokenId, bytes memory) external returns (bytes4) {
        require(msg.sender == address(_positionManager()), "SNFT");
        require(_isStrategy(operator), "STR");
        (
            , ,
            address token0,
            address token1,
            , , , , , , ,
        ) = _positionManager().positions(tokenId);
        // new position should have vault tokens
        require(
            token0 == _vaultTokens[0] && token1 == _vaultTokens[1],
            "VT"
        );

        if (uniV3Nft != 0) {
            (
                , , , , , , ,
                uint128 liquidity,
                , ,
                uint128 tokensOwed0,
                uint128 tokensOwed1
            ) = _positionManager().positions(uniV3Nft);
            require(liquidity == 0 && tokensOwed0 == 0 && tokensOwed1 == 0, "TVL");
            // return previous uni v3 position nft
            _positionManager().transferFrom(address(this), from, uniV3Nft);
        }

        uniV3Nft = tokenId;
        return this.onERC721Received.selector;
    }

    function collectEarnings(address to) external nonReentrant returns (uint256[] memory collectedEarnings) {
        require(_isApprovedOrOwner(msg.sender), ExceptionsLibrary.APPROVED_OR_OWNER);
        IVaultRegistry registry = _vaultGovernance.internalParams().registry;
        address owner = registry.ownerOf(_nft);
        require(owner == msg.sender || _isValidPullDestination(to), ExceptionsLibrary.VALID_PULL_DESTINATION);
        collectedEarnings = new uint256[](2);
        (uint256 collectedEarnings0, uint256 collectedEarnings1) = _positionManager().collect(
            INonfungiblePositionManager.CollectParams({
                tokenId: uniV3Nft,
                recipient: to,
                amount0Max: type(uint128).max,
                amount1Max: type(uint128).max
            })
        );
        collectedEarnings[0] = collectedEarnings0;
        collectedEarnings[1] = collectedEarnings1;
        emit CollectedEarnings(tx.origin, to, collectedEarnings0, collectedEarnings1);
    }

    /// @inheritdoc Vault
    function tvl() public view override returns (uint256[] memory tokenAmounts) {
        tokenAmounts = new uint256[](_vaultTokens.length);
        if (uniV3Nft == 0)
            return tokenAmounts;
        (
            , , , , , 
            int24 tickLower, 
            int24 tickUpper, 
            uint128 liquidity,
            , , ,
        ) = _positionManager().positions(uniV3Nft);
        (uint160 sqrtPriceX96, , , , , , ) = pool.slot0();
        uint160 sqrtPriceAX96 = TickMath.getSqrtRatioAtTick(tickLower);
        uint160 sqrtPriceBX96 = TickMath.getSqrtRatioAtTick(tickUpper);
        (uint256 amount0, uint256 amount1) = LiquidityAmounts.getAmountsForLiquidity(
            sqrtPriceX96,
            sqrtPriceAX96,
            sqrtPriceBX96,
            liquidity
        );
        tokenAmounts[0] = amount0;
        tokenAmounts[1] = amount1;
    }

    function _push(uint256[] memory tokenAmounts, bytes memory options)
        internal
        override
        returns (uint256[] memory actualTokenAmounts)
    {
        address[] memory tokens = _vaultTokens;
        for (uint256 i = 0; i < tokens.length; i++)
            _allowTokenIfNecessary(tokens[i]);

        actualTokenAmounts = new uint256[](2);
        if (uniV3Nft == 0)
            return actualTokenAmounts;

        Options memory opts = _parseOptions(options);
        Pair memory amounts = Pair({
            a0: tokenAmounts[0],
            a1: tokenAmounts[1]
        });
        Pair memory minAmounts = Pair({
            a0: opts.amount0Min,
            a1: opts.amount1Min
        });
        (, uint256 amount0, uint256 amount1) = _positionManager().increaseLiquidity(
            INonfungiblePositionManager.IncreaseLiquidityParams({
                tokenId: uniV3Nft,
                amount0Desired: amounts.a0,
                amount1Desired: amounts.a1,
                amount0Min: minAmounts.a0,
                amount1Min: minAmounts.a1,
                deadline: opts.deadline
            })
        );
        actualTokenAmounts[0] = amount0;
        actualTokenAmounts[1] = amount1;
    }

    function _pull(
        address to,
        uint256[] memory tokenAmounts,
        bytes memory options
    ) internal override returns (uint256[] memory actualTokenAmounts) {
        actualTokenAmounts = new uint256[](2);
        if (uniV3Nft == 0)
            return actualTokenAmounts;

        Options memory opts = _parseOptions(options);
        Pair memory amounts = _pullUniV3Nft(tokenAmounts, to, opts);
        actualTokenAmounts[0] = amounts.a0;
        actualTokenAmounts[1] = amounts.a1;
    }

    function _pullUniV3Nft(
        uint256[] memory tokenAmounts,
        address to,
        Options memory opts
    ) internal returns (Pair memory) {
        uint128 liquidityToPull;
        // scope the code below to avoid stack-too-deep exception
        {
            (, , , , , int24 tickLower, int24 tickUpper, uint128 liquidity, , , , ) = _positionManager().positions(uniV3Nft);
            (uint160 sqrtPriceX96, , , , , , ) = pool.slot0();
            uint160 sqrtPriceAX96 = TickMath.getSqrtRatioAtTick(tickLower);
            uint160 sqrtPriceBX96 = TickMath.getSqrtRatioAtTick(tickUpper);
            liquidityToPull = LiquidityAmounts.getLiquidityForAmounts(
                sqrtPriceX96, sqrtPriceAX96, sqrtPriceBX96, tokenAmounts[0], tokenAmounts[1]
            );
            liquidityToPull = liquidity < liquidityToPull ? liquidity : liquidityToPull;
            if (liquidityToPull == 0) {
                return Pair({a0: 0, a1: 0});
            }
        }
        Pair memory minAmounts = Pair({
            a0: opts.amount0Min,
            a1: opts.amount1Min
        });
        (uint256 amount0, uint256 amount1) = _positionManager().decreaseLiquidity(
            INonfungiblePositionManager.DecreaseLiquidityParams({
                tokenId: uniV3Nft,
                liquidity: liquidityToPull,
                amount0Min: minAmounts.a0,
                amount1Min: minAmounts.a1,
                deadline: opts.deadline
            })
        );
        (uint256 amount0Collected, uint256 amount1Collected) = _positionManager().collect(
            INonfungiblePositionManager.CollectParams({
                tokenId: uniV3Nft,
                recipient: to,
                amount0Max: uint128(amount0),
                amount1Max: uint128(amount1)
            })
        );
        return Pair({a0: amount0Collected, a1: amount1Collected});
    }

    function _postReclaimTokens(address, address[] memory tokens) internal view override {}

    /// TODO: make a virtual function here? Or other better approach
    function _positionManager() internal view returns (INonfungiblePositionManager) {
        return IUniV3VaultGovernance(address(_vaultGovernance)).delayedProtocolParams().positionManager;
    }

    function _allowTokenIfNecessary(address token) internal {
        if (IERC20(token).allowance(address(_positionManager()), address(this)) < type(uint256).max / 2)
            IERC20(token).approve(address(_positionManager()), type(uint256).max);
    }

    function _parseOptions(bytes memory options) internal view returns (Options memory) {
        if (options.length == 0)
            return Options({amount0Min: 0, amount1Min: 0, deadline: block.timestamp + 600});

        require(options.length == 32 * 3, ExceptionsLibrary.IO_LENGTH);
        return abi.decode(options, (Options));
    }

    function _isStrategy(address addr) internal view returns (bool) {
        return _vaultGovernance.internalParams().registry.getApproved(_nft) == addr;
    }

    event CollectedEarnings(address indexed origin, address indexed to, uint256 amount0, uint256 amount1);
}
