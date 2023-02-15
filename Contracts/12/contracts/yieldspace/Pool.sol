// SPDX-License-Identifier: BUSL-1.1
pragma solidity >= 0.8.0;

import "../utils/access/Ownable.sol";
import "../interfaces/external/IERC20.sol";
import "../interfaces/external/IERC20Metadata.sol";
import "../utils/token/ERC20Permit.sol";
import "../utils/token/SafeERC20Namer.sol";
import "../utils/token/MinimalTransferHelper.sol";
import "../interfaces/yieldspace/IPool.sol";
import "../interfaces/yieldspace/IPoolFactory.sol";
import "../interfaces/vault/IFYToken.sol";
import "./YieldMath.sol";


library SafeCast256 {
    /// @dev Safely cast an uint256 to an uint112
    function u112(uint256 x) internal pure returns (uint112 y) {
        require (x <= type(uint112).max, "Cast overflow");
        y = uint112(x);
    }

    /// @dev Safely cast an uint256 to an uint128
    function u128(uint256 x) internal pure returns (uint128 y) {
        require (x <= type(uint128).max, "Cast overflow");
        y = uint128(x);
    }

    /// @dev Safe casting from uint256 to int256
    function i256(uint256 x) internal pure returns(int256) {
        require(x <= uint256(type(int256).max), "Cast overflow");
        return int256(x);
    }
}

library SafeCast128 {
    /// @dev Safely cast an uint128 to an int128
    function i128(uint128 x) internal pure returns (int128 y) {
        require (x <= uint128(type(int128).max), "Cast overflow");
        y = int128(x);
    }

    /// @dev Safely cast an uint128 to an uint112
    function u112(uint128 x) internal pure returns (uint112 y) {
        require (x <= uint128(type(uint112).max), "Cast overflow");
        y = uint112(x);
    }
}


/// @dev The Pool contract exchanges base for fyToken at a price defined by a specific formula.
contract Pool is IPool, ERC20Permit, Ownable {
    using SafeCast256 for uint256;
    using SafeCast128 for uint128;
    using MinimalTransferHelper for IERC20;

    event Trade(uint32 maturity, address indexed from, address indexed to, int256 bases, int256 fyTokens);
    event Liquidity(uint32 maturity, address indexed from, address indexed to, int256 bases, int256 fyTokens, int256 poolTokens);
    event Sync(uint112 baseCached, uint112 fyTokenCached, uint256 cumulativeBalancesRatio);
    event ParameterSet(bytes32 parameter, int128 k);

    int128 private k1 = int128(uint128(uint256((1 << 64))) / 315576000); // 1 / Seconds in 10 years, in 64.64
    int128 private g1 = int128(uint128(uint256((950 << 64))) / 1000); // To be used when selling base to the pool. All constants are `ufixed`, to divide them they must be converted to uint256
    int128 private k2 = int128(uint128(uint256((1 << 64))) / 315576000); // k is stored twice to be able to recover with 1 SLOAD alongside both g1 and g2
    int128 private g2 = int128(uint128(uint256((1000 << 64))) / 950); // To be used when selling fyToken to the pool. All constants are `ufixed`, to divide them they must be converted to uint256
    uint32 public immutable override maturity;

    IERC20 public immutable override base;
    IFYToken public immutable override fyToken;

    uint112 private baseCached;              // uses single storage slot, accessible via getCache
    uint112 private fyTokenCached;           // uses single storage slot, accessible via getCache
    uint32  private blockTimestampLast;             // uses single storage slot, accessible via getCache

    uint256 public cumulativeBalancesRatio;

    constructor()
        ERC20Permit(
            string(abi.encodePacked("Yield ", SafeERC20Namer.tokenName(IPoolFactory(msg.sender).nextFYToken()), " LP Token")),
            string(abi.encodePacked(SafeERC20Namer.tokenSymbol(IPoolFactory(msg.sender).nextFYToken()), "LP")),
            SafeERC20Namer.tokenDecimals(IPoolFactory(msg.sender).nextBase())
        )
    {
        IFYToken _fyToken = IFYToken(IPoolFactory(msg.sender).nextFYToken());
        fyToken = _fyToken;
        base = IERC20(IPoolFactory(msg.sender).nextBase());

        uint256 _maturity = _fyToken.maturity();
        require (_maturity <= type(uint32).max, "Pool: Maturity too far in the future");
        maturity = uint32(_maturity);
    }

    /// @dev Trading can only be done before maturity
    modifier beforeMaturity() {
        require(
            block.timestamp < maturity,
            "Pool: Too late"
        );
        _;
    }

    // ---- Administration ----

    /// @dev Set the k, g1 or g2 parameters
    function setParameter(bytes32 parameter, int128 value) public onlyOwner {
        if (parameter == "k") k1 = k2 = value;
        else if (parameter == "g1") g1 = value;
        else if (parameter == "g2") g2 = value;
        else revert("Pool: Unrecognized parameter");
        emit ParameterSet(parameter, value);
    }

    /// @dev Get k
    function getK() public view returns (int128) {
        assert(k1 == k2);
        return k1;
    }

    /// @dev Get g1
    function getG1() public view returns (int128) {
        return g1;
    }

    /// @dev Get g2
    function getG2() public view returns (int128) {
        return g2;
    }

    // ---- Balances management ----

    /// @dev Updates the cache to match the actual balances.
    function sync() external {
        _update(getBaseBalance(), getFYTokenBalance(), baseCached, fyTokenCached);
    }

    /// @dev Returns the cached balances & last updated timestamp.
    /// @return Cached base token balance.
    /// @return Cached virtual FY token balance.
    /// @return Timestamp that balances were last cached.
    function getCache() public view returns (uint112, uint112, uint32) {
        return (baseCached, fyTokenCached, blockTimestampLast);
    }

    /// @dev Returns the "virtual" fyToken balance, which is the real balance plus the pool token supply.
    function getFYTokenBalance()
        public view override
        returns(uint112)
    {
        return (fyToken.balanceOf(address(this)) + _totalSupply).u112();
    }

    /// @dev Returns the base balance
    function getBaseBalance()
        public view override
        returns(uint112)
    {
        return base.balanceOf(address(this)).u112();
    }

    /// @dev Retrieve any base tokens not accounted for in the cache
    function retrieveBase(address to)
        external override
        returns(uint128 retrieved)
    {
        retrieved = getBaseBalance() - baseCached; // Cache can never be above balances
        base.safeTransfer(to, retrieved);
        // Now the current balances match the cache, so no need to update the TWAR
    }

    /// @dev Retrieve any fyTokens not accounted for in the cache
    function retrieveFYToken(address to)
        external override
        returns(uint128 retrieved)
    {
        retrieved = getFYTokenBalance() - fyTokenCached; // Cache can never be above balances
        IERC20(address(fyToken)).safeTransfer(to, retrieved);
        // Now the balances match the cache, so no need to update the TWAR
    }

    /// @dev Update cache and, on the first call per block, ratio accumulators
    function _update(uint128 baseBalance, uint128 fyBalance, uint112 _baseCached, uint112 _fyTokenCached) private {
        uint32 blockTimestamp = uint32(block.timestamp);
        uint32 timeElapsed = blockTimestamp - blockTimestampLast; // overflow is desired
        if (timeElapsed > 0 && _baseCached != 0 && _fyTokenCached != 0) {
            uint256 scaledFYTokenCached = uint256(_fyTokenCached) * 1e27;
            cumulativeBalancesRatio += scaledFYTokenCached / _baseCached * timeElapsed;
        }
        baseCached = baseBalance.u112();
        fyTokenCached = fyBalance.u112();
        blockTimestampLast = blockTimestamp;
        emit Sync(baseCached, fyTokenCached, cumulativeBalancesRatio);
    }

    // ---- Liquidity ----

    /// @dev Mint liquidity tokens in exchange for adding base and fyToken
    /// The amount of liquidity tokens to mint is calculated from the amount of unaccounted for base tokens in this contract.
    /// A proportional amount of fyTokens needs to be present in this contract, also unaccounted for.
    /// @param to Wallet receiving the minted liquidity tokens.
    /// @param calculateFromBase Calculate the amount of tokens to mint from the base tokens available, leaving a fyToken surplus.
    /// @param minTokensMinted Minimum amount of liquidity tokens received.
    /// @return The amount of liquidity tokens minted.
    function mint(address to, bool calculateFromBase, uint256 minTokensMinted)
        external override
        returns (uint256, uint256, uint256)
    {
        return _mintInternal(to, calculateFromBase, 0, minTokensMinted);
    }

    /// @dev Mint liquidity tokens in exchange for adding only base
    /// The amount of liquidity tokens is calculated from the amount of fyToken to buy from the pool.
    /// The base tokens need to be present in this contract, unaccounted for.
    /// @param to Wallet receiving the minted liquidity tokens.
    /// @param fyTokenToBuy Amount of `fyToken` being bought in the Pool, from this we calculate how much base it will be taken in.
    /// @param minTokensMinted Minimum amount of liquidity tokens received.
    /// @return The amount of liquidity tokens minted.
    function mintWithBase(address to, uint256 fyTokenToBuy, uint256 minTokensMinted)
        external override
        returns (uint256, uint256, uint256)
    {
        return _mintInternal(to, false, fyTokenToBuy, minTokensMinted);
    }

    /// @dev Mint liquidity tokens in exchange for adding only base, if fyTokenToBuy > 0.
    /// If fyTokenToBuy == 0, mint liquidity tokens for both basea and fyToken.
    /// @param to Wallet receiving the minted liquidity tokens.
    /// @param calculateFromBase Calculate the amount of tokens to mint from the base tokens available, leaving a fyToken surplus.
    /// @param fyTokenToBuy Amount of `fyToken` being bought in the Pool, from this we calculate how much base it will be taken in.
    /// @param minTokensMinted Minimum amount of liquidity tokens received.
    /// @return The amount of liquidity tokens minted.
    function _mintInternal(address to, bool calculateFromBase, uint256 fyTokenToBuy, uint256 minTokensMinted)
        internal
        returns (uint256, uint256, uint256)
    {
        // Gather data
        uint256 supply = _totalSupply;
        (uint112 _baseCached, uint112 _fyTokenCached) =
            (baseCached, fyTokenCached);
        uint256 _realFYTokenCached = _fyTokenCached - supply;    // The fyToken cache includes the virtual fyToken, equal to the supply

        // Calculate trade
        uint256 tokensMinted;
        uint256 baseIn;
        uint256 baseReturned;
        uint256 fyTokenIn;

        if (supply == 0) {
            require (calculateFromBase && fyTokenToBuy == 0, "Pool: Initialize only from base");
            baseIn = base.balanceOf(address(this)) - _baseCached;
            tokensMinted = baseIn;   // If supply == 0 we are initializing the pool and tokensMinted == baseIn; fyTokenIn == 0
        } else {
            // There is an optional virtual trade before the mint
            uint256 baseToSell;
            if (fyTokenToBuy > 0) {     // calculateFromBase == true and fyTokenToBuy > 0 can't happen in this implementation. To implement a virtual trade and calculateFromBase the trade would need to be a BaseToBuy parameter.
                baseToSell = _buyFYTokenPreview(
                    fyTokenToBuy.u128(),
                    _baseCached,
                    _fyTokenCached
                ); 
            }

            if (calculateFromBase) {   // We use all the available base tokens, surplus is in fyTokens
                baseIn = base.balanceOf(address(this)) - _baseCached;
                tokensMinted = (supply * baseIn) / _baseCached;
                fyTokenIn = (_realFYTokenCached * tokensMinted) / supply;
                require(_realFYTokenCached + fyTokenIn <= fyToken.balanceOf(address(this)), "Pool: Not enough fyToken in");
            } else {                   // We use all the available fyTokens, plus a virtual trade if it happened, surplus is in base tokens
                fyTokenIn = fyToken.balanceOf(address(this)) - _realFYTokenCached;
                tokensMinted = (supply * (fyTokenToBuy + fyTokenIn)) / (_realFYTokenCached - fyTokenToBuy);
                baseIn = baseToSell + ((_baseCached + baseToSell) * tokensMinted) / supply;
                uint256 _baseBalance = base.balanceOf(address(this));
                require(_baseBalance - _baseCached >= baseIn, "Pool: Not enough base token in");
                
                // If we did a trade means we came in through `mintWithBase`, and want to return the base token surplus
                if (fyTokenToBuy > 0) baseReturned = (_baseBalance - _baseCached) - baseIn;
            }
        }

        // Slippage
        require (tokensMinted >= minTokensMinted, "Pool: Not enough tokens minted");

        // Update TWAR
        _update(
            (_baseCached + baseIn).u128(),
            (_fyTokenCached + fyTokenIn + tokensMinted).u128(), // Account for the "virtual" fyToken from the new minted LP tokens
            _baseCached,
            _fyTokenCached
        );

        // Execute mint
        _mint(to, tokensMinted);

        // Return any unused base if we did a trade, meaning slippage was involved.
        if (supply > 0 && fyTokenToBuy > 0) base.safeTransfer(to, baseReturned);

        emit Liquidity(maturity, msg.sender, to, -(baseIn.i256()), -(fyTokenIn.i256()), tokensMinted.i256());
        return (baseIn, fyTokenIn, tokensMinted);
    }

    /// @dev Burn liquidity tokens in exchange for base and fyToken.
    /// The liquidity tokens need to be in this contract.
    /// @param to Wallet receiving the base and fyToken.
    /// @return The amount of tokens burned and returned (tokensBurned, bases, fyTokens).
    function burn(address to, uint256 minBaseOut, uint256 minFYTokenOut)
        external override
        returns (uint256, uint256, uint256)
    {
        return _burnInternal(to, false, minBaseOut, minFYTokenOut);
    }

    /// @dev Burn liquidity tokens in exchange for base.
    /// The liquidity provider needs to have called `pool.approve`.
    /// @param to Wallet receiving the base and fyToken.
    /// @return tokensBurned The amount of lp tokens burned.
    /// @return baseOut The amount of base tokens returned.
    function burnForBase(address to, uint256 minBaseOut)
        external override
        returns (uint256 tokensBurned, uint256 baseOut)
    {
        (tokensBurned, baseOut, ) = _burnInternal(to, true, minBaseOut, 0);
    }


    /// @dev Burn liquidity tokens in exchange for base.
    /// The liquidity provider needs to have called `pool.approve`.
    /// @param to Wallet receiving the base and fyToken.
    /// @param tradeToBase Whether the resulting fyToken should be traded for base tokens.
    /// @return The amount of base tokens returned.
    function _burnInternal(address to, bool tradeToBase, uint256 minBaseOut, uint256 minFYTokenOut)
        internal
        returns (uint256, uint256, uint256)
    {
        
        uint256 tokensBurned = _balanceOf[address(this)];
        uint256 supply = _totalSupply;
        uint256 fyTokenBalance = fyToken.balanceOf(address(this));          // use the real balance rather than the virtual one
        uint256 baseBalance = base.balanceOf(address(this));
        (uint112 _baseCached, uint112 _fyTokenCached) =
            (baseCached, fyTokenCached);

        // Calculate trade
        uint256 tokenOut = (tokensBurned * baseBalance) / supply;
        uint256 fyTokenOut = (tokensBurned * fyTokenBalance) / supply;

        if (tradeToBase) {
            (int128 _k, int128 _g2) = (k2, g2);
            tokenOut += YieldMath.baseOutForFYTokenIn(                      // This is a virtual sell
                _baseCached - tokenOut.u128(),                              // Cache, minus virtual burn
                _fyTokenCached - fyTokenOut.u128(),                         // Cache, minus virtual burn
                fyTokenOut.u128(),                                          // Sell the virtual fyToken obtained
                maturity - uint32(block.timestamp),                         // This can't be called after maturity
                _k,
                _g2
            );
            fyTokenOut = 0;
        }

        // Slippage
        require (tokenOut >= minBaseOut, "Pool: Not enough base tokens obtained");
        require (fyTokenOut >= minFYTokenOut, "Pool: Not enough fyToken obtained");

        // Update TWAR
        _update(
            (baseBalance - tokenOut).u128(),
            (fyTokenBalance - fyTokenOut + supply - tokensBurned).u128(),
            _baseCached,
            _fyTokenCached
        );

        // Transfer assets
        _burn(address(this), tokensBurned);
        base.safeTransfer(to, tokenOut);
        if (fyTokenOut > 0) IERC20(address(fyToken)).safeTransfer(to, fyTokenOut);

        emit Liquidity(maturity, msg.sender, to, tokenOut.i256(), fyTokenOut.i256(), -(tokensBurned.i256()));
        return (tokensBurned, tokenOut, 0);
    }

    // ---- Trading ----

    /// @dev Sell base for fyToken.
    /// The trader needs to have transferred the amount of base to sell to the pool before in the same transaction.
    /// @param to Wallet receiving the fyToken being bought
    /// @param min Minimm accepted amount of fyToken
    /// @return Amount of fyToken that will be deposited on `to` wallet
    function sellBase(address to, uint128 min)
        external override
        returns(uint128)
    {
        // Calculate trade
        (uint112 _baseCached, uint112 _fyTokenCached) =
            (baseCached, fyTokenCached);
        uint112 _baseBalance = getBaseBalance();
        uint112 _fyTokenBalance = getFYTokenBalance();
        uint128 baseIn = _baseBalance - _baseCached;
        uint128 fyTokenOut = _sellBasePreview(
            baseIn,
            _baseCached,
            _fyTokenBalance
        );

        // Slippage check
        require(
            fyTokenOut >= min,
            "Pool: Not enough fyToken obtained"
        );

        // Update TWAR
        _update(
            _baseBalance,
            _fyTokenBalance - fyTokenOut,
            _baseCached,
            _fyTokenCached
        );

        // Transfer assets
        IERC20(address(fyToken)).safeTransfer(to, fyTokenOut);

        emit Trade(maturity, msg.sender, to, -(baseIn.i128()), fyTokenOut.i128());
        return fyTokenOut;
    }

    /// @dev Returns how much fyToken would be obtained by selling `baseIn` base
    /// @param baseIn Amount of base hypothetically sold.
    /// @return Amount of fyToken hypothetically bought.
    function sellBasePreview(uint128 baseIn)
        external view override
        returns(uint128)
    {
        (uint112 _baseCached, uint112 _fyTokenCached) =
            (baseCached, fyTokenCached);
        return _sellBasePreview(baseIn, _baseCached, _fyTokenCached);
    }

    /// @dev Returns how much fyToken would be obtained by selling `baseIn` base
    function _sellBasePreview(
        uint128 baseIn,
        uint112 baseBalance,
        uint112 fyTokenBalance
    )
        private view
        beforeMaturity
        returns(uint128)
    {
        (int128 _k, int128 _g1) = (k1, g1);
        uint128 fyTokenOut = YieldMath.fyTokenOutForBaseIn(
            baseBalance,
            fyTokenBalance,
            baseIn,
            maturity - uint32(block.timestamp),             // This can't be called after maturity
            _k,
            _g1
        );

        require(
            fyTokenBalance - fyTokenOut >= baseBalance + baseIn,
            "Pool: fyToken balance too low"
        );

        return fyTokenOut;
    }

    /// @dev Buy base for fyToken
    /// The trader needs to have called `fyToken.approve`
    /// @param to Wallet receiving the base being bought
    /// @param tokenOut Amount of base being bought that will be deposited in `to` wallet
    /// @param max Maximum amount of fyToken that will be paid for the trade
    /// @return Amount of fyToken that will be taken from caller
    function buyBase(address to, uint128 tokenOut, uint128 max)
        external override
        returns(uint128)
    {
        // Calculate trade
        uint128 fyTokenBalance = getFYTokenBalance();
        (uint112 _baseCached, uint112 _fyTokenCached) =
            (baseCached, fyTokenCached);
        uint128 fyTokenIn = _buyBasePreview(
            tokenOut,
            _baseCached,
            _fyTokenCached
        );
        require(
            fyTokenBalance - _fyTokenCached >= fyTokenIn,
            "Pool: Not enough fyToken in"
        );

        // Slippage check
        require(
            fyTokenIn <= max,
            "Pool: Too much fyToken in"
        );

        // Update TWAR
        _update(
            _baseCached - tokenOut,
            _fyTokenCached + fyTokenIn,
            _baseCached,
            _fyTokenCached
        );

        // Transfer assets
        base.safeTransfer(to, tokenOut);

        emit Trade(maturity, msg.sender, to, tokenOut.i128(), -(fyTokenIn.i128()));
        return fyTokenIn;
    }

    /// @dev Returns how much fyToken would be required to buy `tokenOut` base.
    /// @param tokenOut Amount of base hypothetically desired.
    /// @return Amount of fyToken hypothetically required.
    function buyBasePreview(uint128 tokenOut)
        external view override
        returns(uint128)
    {
        (uint112 _baseCached, uint112 _fyTokenCached) =
            (baseCached, fyTokenCached);
        return _buyBasePreview(tokenOut, _baseCached, _fyTokenCached);
    }

    /// @dev Returns how much fyToken would be required to buy `tokenOut` base.
    function _buyBasePreview(
        uint128 tokenOut,
        uint112 baseBalance,
        uint112 fyTokenBalance
    )
        private view
        beforeMaturity
        returns(uint128)
    {
        (int128 _k, int128 _g2) = (k2, g2);
        return YieldMath.fyTokenInForBaseOut(
            baseBalance,
            fyTokenBalance,
            tokenOut,
            maturity - uint32(block.timestamp),             // This can't be called after maturity
            _k,
            _g2
        );
    }

    /// @dev Sell fyToken for base
    /// The trader needs to have transferred the amount of fyToken to sell to the pool before in the same transaction.
    /// @param to Wallet receiving the base being bought
    /// @param min Minimm accepted amount of base
    /// @return Amount of base that will be deposited on `to` wallet
    function sellFYToken(address to, uint128 min)
        external override
        returns(uint128)
    {
        // Calculate trade
        (uint112 _baseCached, uint112 _fyTokenCached) =
            (baseCached, fyTokenCached);
        uint112 _fyTokenBalance = getFYTokenBalance();
        uint112 _baseBalance = getBaseBalance();
        uint128 fyTokenIn = _fyTokenBalance - _fyTokenCached;
        uint128 baseOut = _sellFYTokenPreview(
            fyTokenIn,
            _baseCached,
            _fyTokenCached
        );

        // Slippage check
        require(
            baseOut >= min,
            "Pool: Not enough base obtained"
        );

        // Update TWAR
        _update(
            _baseBalance - baseOut,
            _fyTokenBalance,
            _baseCached,
            _fyTokenCached
        );

        // Transfer assets
        base.safeTransfer(to, baseOut);

        emit Trade(maturity, msg.sender, to, baseOut.i128(), -(fyTokenIn.i128()));
        return baseOut;
    }

    /// @dev Returns how much base would be obtained by selling `fyTokenIn` fyToken.
    /// @param fyTokenIn Amount of fyToken hypothetically sold.
    /// @return Amount of base hypothetically bought.
    function sellFYTokenPreview(uint128 fyTokenIn)
        external view override
        returns(uint128)
    {
        (uint112 _baseCached, uint112 _fyTokenCached) =
            (baseCached, fyTokenCached);
        return _sellFYTokenPreview(fyTokenIn, _baseCached, _fyTokenCached);
    }

    /// @dev Returns how much base would be obtained by selling `fyTokenIn` fyToken.
    function _sellFYTokenPreview(
        uint128 fyTokenIn,
        uint112 baseBalance,
        uint112 fyTokenBalance
    )
        private view
        beforeMaturity
        returns(uint128)
    {
        (int128 _k, int128 _g2) = (k2, g2);
        return YieldMath.baseOutForFYTokenIn(
            baseBalance,
            fyTokenBalance,
            fyTokenIn,
            maturity - uint32(block.timestamp),             // This can't be called after maturity
            _k,
            _g2
        );
    }

    /// @dev Buy fyToken for base
    /// The trader needs to have called `base.approve`
    /// @param to Wallet receiving the fyToken being bought
    /// @param fyTokenOut Amount of fyToken being bought that will be deposited in `to` wallet
    /// @param max Maximum amount of base token that will be paid for the trade
    /// @return Amount of base that will be taken from caller's wallet
    function buyFYToken(address to, uint128 fyTokenOut, uint128 max)
        external override
        returns(uint128)
    {
        // Calculate trade
        uint128 baseBalance = getBaseBalance();
        (uint112 _baseCached, uint112 _fyTokenCached) =
            (baseCached, fyTokenCached);
        uint128 baseIn = _buyFYTokenPreview(
            fyTokenOut,
            _baseCached,
            _fyTokenCached
        );
        require(
            baseBalance - _baseCached >= baseIn,
            "Pool: Not enough base token in"
        );

        // Slippage check
        require(
            baseIn <= max,
            "Pool: Too much base token in"
        );

        // Update TWAR
        _update(
            _baseCached + baseIn,
            _fyTokenCached - fyTokenOut,
            _baseCached,
            _fyTokenCached
        );

        // Transfer assets
        IERC20(address(fyToken)).safeTransfer(to, fyTokenOut);

        emit Trade(maturity, msg.sender, to, -(baseIn.i128()), fyTokenOut.i128());
        return baseIn;
    }

    /// @dev Returns how much base would be required to buy `fyTokenOut` fyToken.
    /// @param fyTokenOut Amount of fyToken hypothetically desired.
    /// @return Amount of base hypothetically required.
    function buyFYTokenPreview(uint128 fyTokenOut)
        external view override
        returns(uint128)
    {
        (uint112 _baseCached, uint112 _fyTokenCached) =
            (baseCached, fyTokenCached);
        return _buyFYTokenPreview(fyTokenOut, _baseCached, _fyTokenCached);
    }

    /// @dev Returns how much base would be required to buy `fyTokenOut` fyToken.
    function _buyFYTokenPreview(
        uint128 fyTokenOut,
        uint128 baseBalance,
        uint128 fyTokenBalance
    )
        private view
        beforeMaturity
        returns(uint128)
    {
        (int128 _k, int128 _g1) = (k1, g1);
        uint128 baseIn = YieldMath.baseInForFYTokenOut(
            baseBalance,
            fyTokenBalance,
            fyTokenOut,
            maturity - uint32(block.timestamp),             // This can't be called after maturity
            _k,
            _g1
        );

        require(
            fyTokenBalance - fyTokenOut >= baseBalance + baseIn,
            "Pool: fyToken balance too low"
        );

        return baseIn;
    }
}
