// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.7.6 <0.9.0;
pragma abicoder v2;

import "./token/IPoolShare.sol";

interface ITempusFees {
    // The fees are in terms of yield bearing token (YBT).
    struct FeesConfig {
        uint256 depositPercent;
        uint256 earlyRedeemPercent;
        uint256 matureRedeemPercent;
    }

    /// Returns the current fee configuration.
    function getFeesConfig() external view returns (FeesConfig memory);

    /// Replace the current fee configuration with a new one.
    /// By default all the fees are expected to be set to zero.
    function setFeesConfig(FeesConfig calldata newFeesConfig) external;

    /// @return Maximum possible fee percentage that can be set for deposit
    function maxDepositFee() external view returns (uint256);

    /// @return Maximum possible fee percentage that can be set for early redeem
    function maxEarlyRedeemFee() external view returns (uint256);

    /// @return Maximum possible fee percentage that can be set for mature redeem
    function maxMatureRedeemFee() external view returns (uint256);

    /// Accumulated fees available for withdrawal.
    function totalFees() external view returns (uint256);

    /// Transfers accumulated Yield Bearing Token (YBT) fees
    /// from this pool contract to `recipient`.
    /// @param authorizer Authorizer of the transfer
    /// @param recipient Address which will receive the specified amount of YBT
    function transferFees(address authorizer, address recipient) external;
}

interface ITempusPool is ITempusFees {
    /// @return The version of the pool.
    function version() external view returns (uint);

    /// @return The name of underlying protocol, for example "Aave" for Aave protocol
    function protocolName() external view returns (bytes32);

    /// This token will be used as a token that user can deposit to mint same amounts
    /// of principal and interest shares.
    /// @return The underlying yield bearing token.
    function yieldBearingToken() external view returns (address);

    /// This is the address of the actual backing asset token
    /// in the case of ETH, this address will be 0
    /// @return Address of the Backing Token
    function backingToken() external view returns (address);

    /// @return uint256 value of one backing token, in case of 18 decimals 1e18
    function backingTokenONE() external view returns (uint256);

    /// @return This TempusPool's Tempus Principal Share (TPS)
    function principalShare() external view returns (IPoolShare);

    /// @return This TempusPool's Tempus Yield Share (TYS)
    function yieldShare() external view returns (IPoolShare);

    /// @return The TempusController address that is authorized to perform restricted actions
    function controller() external view returns (address);

    /// @return Start time of the pool.
    function startTime() external view returns (uint256);

    /// @return Maturity time of the pool.
    function maturityTime() external view returns (uint256);

    /// @return True if maturity has been reached and the pool was finalized.
    function matured() external view returns (bool);

    /// Finalize the pool. This can only happen on or after `maturityTime`.
    /// Once finalized depositing is not possible anymore, and the behaviour
    /// redemption will change.
    ///
    /// Can be called by anyone and can be called multiple times.
    function finalize() external;

    /// Deposits yield bearing tokens (such as cDAI) into TempusPool
    ///      msg.sender must approve @param yieldTokenAmount to this TempusPool
    ///      NOTE #1 Deposit will fail if maturity has been reached.
    ///      NOTE #2 This function can only be called by TempusController
    /// @param yieldTokenAmount Amount of yield bearing tokens to deposit in YieldToken decimal precision
    /// @param recipient Address which will receive Tempus Principal Shares (TPS) and Tempus Yield Shares (TYS)
    /// @return mintedShares Amount of TPS and TYS minted to `recipient`
    /// @return depositedBT The YBT value deposited, denominated as Backing Tokens
    /// @return fee The fee which was deducted (in terms of YBT)
    /// @return rate The interest rate at the time of the deposit
    function deposit(uint256 yieldTokenAmount, address recipient)
        external
        returns (
            uint256 mintedShares,
            uint256 depositedBT,
            uint256 fee,
            uint256 rate
        );

    /// Deposits backing token to the underlying protocol, and then to Tempus Pool.
    ///      NOTE #1 Deposit will fail if maturity has been reached.
    ///      NOTE #2 This function can only be called by TempusController
    /// @param backingTokenAmount amount of Backing Tokens to be deposited to underlying protocol in BackingToken decimal precision
    /// @param recipient Address which will receive Tempus Principal Shares (TPS) and Tempus Yield Shares (TYS)
    /// @return mintedShares Amount of TPS and TYS minted to `recipient`
    /// @return depositedYBT The BT value deposited, denominated as Yield Bearing Tokens
    /// @return fee The fee which was deducted (in terms of YBT)
    /// @return rate The interest rate at the time of the deposit
    function depositBacking(uint256 backingTokenAmount, address recipient)
        external
        payable
        returns (
            uint256 mintedShares,
            uint256 depositedYBT,
            uint256 fee,
            uint256 rate
        );

    /// Redeem yield bearing tokens from this TempusPool
    ///      msg.sender will receive the YBT
    ///      NOTE #1 Before maturity, principalAmount must equal to yieldAmount.
    ///      NOTE #2 This function can only be called by TempusController
    /// @param from Address to redeem its Tempus Shares
    /// @param principalAmount Amount of Tempus Principal Shares (TPS) to redeem for YBT in PrincipalShare decimal precision
    /// @param yieldAmount Amount of Tempus Yield Shares (TYS) to redeem for YBT in YieldShare decimal precision
    /// @param recipient Address to which redeemed YBT will be sent
    /// @return redeemableYieldTokens Amount of Yield Bearing Tokens redeemed to `recipient`
    /// @return fee The fee which was deducted (in terms of YBT)
    /// @return rate The interest rate at the time of the redemption
    function redeem(
        address from,
        uint256 principalAmount,
        uint256 yieldAmount,
        address recipient
    )
        external
        returns (
            uint256 redeemableYieldTokens,
            uint256 fee,
            uint256 rate
        );

    /// Redeem TPS+TYS held by msg.sender into backing tokens
    ///      `msg.sender` must approve TPS and TYS amounts to this TempusPool.
    ///      `msg.sender` will receive the backing tokens
    ///      NOTE #1 Before maturity, principalAmount must equal to yieldAmount.
    ///      NOTE #2 This function can only be called by TempusController
    /// @param from Address to redeem its Tempus Shares
    /// @param principalAmount Amount of Tempus Principal Shares (TPS) to redeem in PrincipalShare decimal precision
    /// @param yieldAmount Amount of Tempus Yield Shares (TYS) to redeem in YieldShare decimal precision
    /// @param recipient Address to which redeemed BT will be sent
    /// @return redeemableYieldTokens Amount of Backing Tokens redeemed to `recipient`, denominated in YBT
    /// @return redeemableBackingTokens Amount of Backing Tokens redeemed to `recipient`
    /// @return fee The fee which was deducted (in terms of YBT)
    /// @return rate The interest rate at the time of the redemption
    function redeemToBacking(
        address from,
        uint256 principalAmount,
        uint256 yieldAmount,
        address recipient
    )
        external
        payable
        returns (
            uint256 redeemableYieldTokens,
            uint256 redeemableBackingTokens,
            uint256 fee,
            uint256 rate
        );

    /// Gets the estimated amount of Principals and Yields after a successful deposit
    /// @param amount Amount of BackingTokens or YieldBearingTokens that would be deposited
    /// @param isBackingToken If true, @param amount is in BackingTokens, otherwise YieldBearingTokens
    /// @return Amount of Principals (TPS) and Yields (TYS) in Principal/YieldShare decimal precision
    ///         TPS and TYS are minted in 1:1 ratio, hence a single return value.
    function estimatedMintedShares(uint256 amount, bool isBackingToken) external view returns (uint256);

    /// Gets the estimated amount of YieldBearingTokens or BackingTokens received when calling `redeemXXX()` functions
    /// @param principals Amount of Principals (TPS) in PrincipalShare decimal precision
    /// @param yields Amount of Yields (TYS) in YieldShare decimal precision
    /// @param toBackingToken If true, redeem amount is estimated in BackingTokens instead of YieldBearingTokens
    /// @return Amount of YieldBearingTokens or BackingTokens in YBT/BT decimal precision
    function estimatedRedeem(
        uint256 principals,
        uint256 yields,
        bool toBackingToken
    ) external view returns (uint256);

    /// @dev This returns the stored Interest Rate of the YBT (Yield Bearing Token) pool
    ///      it is safe to call this after updateInterestRate() was called
    /// @return Stored Interest Rate, decimal precision depends on specific TempusPool implementation
    function currentInterestRate() external view returns (uint256);

    /// @return Initial interest rate of the underlying pool,
    ///         decimal precision depends on specific TempusPool implementation
    function initialInterestRate() external view returns (uint256);

    /// @return Interest rate at maturity of the underlying pool (or 0 if maturity not reached yet)
    ///         decimal precision depends on specific TempusPool implementation
    function maturityInterestRate() external view returns (uint256);

    /// @return Rate of one Tempus Yield Share expressed in Asset Tokens
    function pricePerYieldShare() external returns (uint256);

    /// @return Rate of one Tempus Principal Share expressed in Asset Tokens
    function pricePerPrincipalShare() external returns (uint256);

    /// Calculated with stored interest rates
    /// @return Rate of one Tempus Yield Share expressed in Asset Tokens,
    function pricePerYieldShareStored() external view returns (uint256);

    /// Calculated with stored interest rates
    /// @return Rate of one Tempus Principal Share expressed in Asset Tokens
    function pricePerPrincipalShareStored() external view returns (uint256);

    /// @dev This returns actual Backing Token amount for amount of YBT (Yield Bearing Tokens)
    ///      For example, in case of Aave and Lido the result is 1:1,
    ///      and for compound is `yieldTokens * currentInterestRate`
    /// @param yieldTokens Amount of YBT in YBT decimal precision
    /// @param interestRate The current interest rate
    /// @return Amount of Backing Tokens for specified @param yieldTokens
    function numAssetsPerYieldToken(uint yieldTokens, uint interestRate) external pure returns (uint);

    /// @dev This returns amount of YBT (Yield Bearing Tokens) that can be converted
    ///      from @param backingTokens Backing Tokens
    /// @param backingTokens Amount of Backing Tokens in BT decimal precision
    /// @param interestRate The current interest rate
    /// @return Amount of YBT for specified @param backingTokens
    function numYieldTokensPerAsset(uint backingTokens, uint interestRate) external pure returns (uint);
}
