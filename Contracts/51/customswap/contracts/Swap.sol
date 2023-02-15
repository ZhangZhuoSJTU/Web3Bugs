// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./OwnerPausable.sol";
import "./SwapUtils.sol";
import "./MathUtils.sol";
import "./hardhat/console.sol";

/**
 * @title Swap - A StableSwap implementation in solidity.
 * @notice This contract is responsible for custody of closely pegged assets (eg. group of stablecoins)
 * and automatic market making system. Users become an LP (Liquidity Provider) by depositing their tokens
 * in desired ratios for an exchange of the pool token that represents their share of the pool.
 * Users can burn pool tokens and withdraw their share of token(s).
 *
 * Each time a swap between the pooled tokens happens, a set fee incurs which effectively gets
 * distributed to the LPs.
 *
 * In case of emergencies, admin can pause additional deposits, swaps, or single-asset withdraws - which
 * stops the ratio of the tokens in the pool from changing.
 * Users can always withdraw their tokens via multi-asset withdraws.
 *
 * @dev Most of the logic is stored as a library `SwapUtils` for the sake of reducing contract's
 * deployment size.
 */
contract Swap is OwnerPausable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;
    using MathUtils for uint256;
    using SwapUtils for SwapUtils.Swap;
    using SwapUtils for SwapUtils.TargetPrice;

    // Structs storing data responsible for automatic market maker functionalities. In order to
    // access this data, this contract uses SwapUtils library. For more details, see SwapUtils.sol
    SwapUtils.Swap public swapStorage;
    SwapUtils.TargetPrice public targetPriceStorage;

    // Address to allowlist contract that holds information about maximum totaly supply of lp tokens
    // and maximum mintable amount per user address. As this is immutable, this will become a constant
    // after initialization.
    // IAllowlist private immutable allowlist;

    // Boolean value that notates whether this pool is guarded or not. When isGuarded is true,
    // addLiquidity function will be restricted by limits defined in allowlist contract.
    // bool private guarded = true;

    // Maps token address to an index in the pool. Used to prevent duplicate tokens in the pool.
    // getTokenIndex function also relies on this mapping to retrieve token index.
    mapping(address => uint8) private tokenIndexes;

    // uint256[2] originalPrecisionMultipliers;
    // uint256[2] customPrecisionMultipliers;

    /*** EVENTS ***/

    // events replicated from SwapUtils to make the ABI easier for dumb
    // clients
    event TokenSwap(
        address indexed buyer,
        uint256 tokensSold,
        uint256 tokensBought,
        uint128 soldId,
        uint128 boughtId
    );
    event AddLiquidity(
        address indexed provider,
        uint256[] tokenAmounts,
        uint256[] fees,
        uint256 invariant,
        uint256 lpTokenSupply
    );
    event RemoveLiquidity(
        address indexed provider,
        uint256[] tokenAmounts,
        uint256 lpTokenSupply
    );
    event RemoveLiquidityOne(
        address indexed provider,
        uint256 lpTokenAmount,
        uint256 lpTokenSupply,
        uint256 boughtId,
        uint256 tokensBought
    );
    event RemoveLiquidityImbalance(
        address indexed provider,
        uint256[] tokenAmounts,
        uint256[] fees,
        uint256 invariant,
        uint256 lpTokenSupply
    );
    event NewAdminFee(uint256 newAdminFee);
    event NewSwapFee(uint256 newSwapFee);
    event NewWithdrawFee(uint256 newWithdrawFee);
    event RampA(
        uint256 oldA,
        uint256 newA,
        uint256 initialTime,
        uint256 futureTime
    );
    event RampA2(
        uint256 oldA2,
        uint256 newA2,
        uint256 initialA2Time,
        uint256 futureA2Time
    );
    event StopRampA(uint256 currentA, uint256 time);
    event StopRampA2(uint256 currentA2, uint256 time);

    /**
     * @notice Deploys this Swap contract with given parameters as default
     * values. This will also deploy a LPToken that represents users
     * LP position. The owner of LPToken will be this contract - which means
     * only this contract is allowed to mint new tokens.
     *
     * @param _pooledTokens an array of ERC20s this pool will accept
     * @param decimals the decimals to use for each pooled token,
     * eg 8 for WBTC. Cannot be larger than POOL_PRECISION_DECIMALS
     * @param lpTokenName the long-form name of the token to be deployed
     * @param lpTokenSymbol the short symbol for the token to be deployed
     * @param _a the amplification coefficient * n * (n - 1). See the
     * StableSwap paper for details
     * @param _a2 the amplification coefficient * n * (n - 1). See the
     * StableSwap paper for details
     * @param _fee default swap fee to be initialized with
     * @param _adminFee default adminFee to be initialized with
     * @param _withdrawFee default withdrawFee to be initialized with
     * @param _targetPrice default targetPrice to be initialized with
     */

    //   * @param _allowlist address of allowlist contract for guarded launch
    constructor(
        IERC20[] memory _pooledTokens,
        uint8[] memory decimals,
        string memory lpTokenName,
        string memory lpTokenSymbol,
        uint256 _a,
        uint256 _a2,
        uint256 _fee,
        uint256 _adminFee,
        uint256 _withdrawFee,
        uint256 _targetPrice
        // IAllowlist _allowlist
    ) public OwnerPausable() ReentrancyGuard() {
        // Check _pooledTokens and precisions parameter
        require(_pooledTokens.length == 2, "_pooledTokens.length must be 2 in length");
        require(decimals.length == 2, "decimals.length must be 2 in length");
        require(
            _pooledTokens.length == decimals.length,
            "_pooledTokens decimals mismatch"
        );

        // uint256[] memory originalPrecisionMultipliers = new uint256[](decimals.length);

        for (uint8 i = 0; i < _pooledTokens.length; i++) {
            if (i > 0) {
                // Check if index is already used. Check if 0th element is a duplicate.
                require(
                    tokenIndexes[address(_pooledTokens[i])] == 0 &&
                        _pooledTokens[0] != _pooledTokens[i],
                    "Duplicate tokens"
                );
            }
            require(
                address(_pooledTokens[i]) != address(0),
                "The 0 address isn't an ERC-20"
            );
            require(
                decimals[i] <= SwapUtils.POOL_PRECISION_DECIMALS,
                "Token decimals exceeds max"
            );
            targetPriceStorage.originalPrecisionMultipliers[i] =
                10 **
                    uint256(SwapUtils.POOL_PRECISION_DECIMALS).sub(
                        uint256(decimals[i])
                    );

            tokenIndexes[address(_pooledTokens[i])] = i;
        }

        uint256[2] memory customPrecisionMultipliers;
        customPrecisionMultipliers[0] = targetPriceStorage.originalPrecisionMultipliers[0].mul(_targetPrice).div(10 ** 18);
        customPrecisionMultipliers[1] = targetPriceStorage.originalPrecisionMultipliers[1];
        // console.log("customPrecisionMultipliers[0] %s", customPrecisionMultipliers[0]);

        // Check _a, _a2 _fee, _adminFee, _withdrawFee, _allowlist parameters
        require(_a >= 0 && _a <= SwapUtils.MAX_A, "_a not within the limits");
        require(_a2 >= 0 && _a2 <= SwapUtils.MAX_A, "_a2 not within the limits");
        require(_fee < SwapUtils.MAX_SWAP_FEE, "_fee exceeds maximum");
        require(
            _adminFee < SwapUtils.MAX_ADMIN_FEE,
            "_adminFee exceeds maximum"
        );
        require(
            _withdrawFee < SwapUtils.MAX_WITHDRAW_FEE,
            "_withdrawFee exceeds maximum"
        );
        // require(
        //     _allowlist.getPoolCap(address(0x0)) == uint256(0x54dd1e),
        //     "Allowlist check failed"
        // );

        // Initialize swapStorage struct
        swapStorage.lpToken = new LPToken(
            lpTokenName,
            lpTokenSymbol,
            SwapUtils.POOL_PRECISION_DECIMALS
        );
        swapStorage.pooledTokens = _pooledTokens;
        swapStorage.tokenPrecisionMultipliers = customPrecisionMultipliers;
        swapStorage.balances = new uint256[](_pooledTokens.length);
        
        targetPriceStorage.initialTargetPrice = _targetPrice/*.mul(SwapUtils.TARGET_PRICE_PRECISION)*/;
        targetPriceStorage.futureTargetPrice = _targetPrice/*.mul(SwapUtils.TARGET_PRICE_PRECISION)*/;
        targetPriceStorage.initialTargetPriceTime = 0;
        targetPriceStorage.futureTargetPriceTime = 0;

        swapStorage.initialA = _a.mul(SwapUtils.A_PRECISION);
        swapStorage.futureA = _a.mul(SwapUtils.A_PRECISION);
        swapStorage.initialATime = 0;
        swapStorage.futureATime = 0;
        
        swapStorage.initialA2 = _a2.mul(SwapUtils.A_PRECISION);
        swapStorage.futureA2 = _a2.mul(SwapUtils.A_PRECISION);
        swapStorage.initialA2Time = 0;
        swapStorage.futureA2Time = 0;
        
        swapStorage.swapFee = _fee;
        swapStorage.adminFee = _adminFee;
        swapStorage.defaultWithdrawFee = _withdrawFee;

        // Initialize variables related to guarding the initial deposits
        // allowlist = _allowlist;
        // guarded = true;
    }

    /*** MODIFIERS ***/

    /**
     * @notice Modifier to check deadline against current timestamp
     * @param deadline latest timestamp to accept this transaction
     */
    modifier deadlineCheck(uint256 deadline) {
        require(block.timestamp <= deadline, "Deadline not met");
        _;
    }

    /*** VIEW FUNCTIONS ***/

    /**
     * @notice Return A, the amplification coefficient * n * (n - 1)
     * @dev See the StableSwap paper for details
     * @return A parameter
     */
    function getA() external view returns (uint256) {
        return swapStorage.getA();
    }

    /**
     * @notice Return A2, the amplification coefficient * n * (n - 1)
     * @dev See the StableSwap paper for details
     * @return A2 parameter
     */
    function getA2() external view returns (uint256) {
        return swapStorage.getA2();
    }

    /**
     * @notice Return A in its raw precision form
     * @dev See the StableSwap paper for details
     * @return A parameter in its raw precision form
     */
    function getAPrecise() external view returns (uint256) {
        return swapStorage.getAPrecise();
    }

    /**
     * @notice Return A2 in its raw precision form
     * @dev See the StableSwap paper for details
     * @return A2 parameter in its raw precision form
     */
    function getA2Precise() external view returns (uint256) {
        return swapStorage.getA2Precise();
    }

    /**
     * @notice Return address of the pooled token at given index. Reverts if tokenIndex is out of range.
     * @param index the index of the token
     * @return address of the token at given index
     */
    function getToken(uint8 index) public view returns (IERC20) {
        require(index < swapStorage.pooledTokens.length, "Out of range");
        return swapStorage.pooledTokens[index];
    }

    /**
     * @notice Return the index of the given token address. Reverts if no matching
     * token is found.
     * @param tokenAddress address of the token
     * @return the index of the given token address
     */
    function getTokenIndex(address tokenAddress) external view returns (uint8) {
        uint8 index = tokenIndexes[tokenAddress];
        require(
            address(getToken(index)) == tokenAddress,
            "Token does not exist"
        );
        return index;
    }

    // /**
    //  * @notice Reads and returns the address of the allowlist that is set during deployment of this contract
    //  * @return the address of the allowlist contract casted to the IAllowlist interface
    //  */
    // function getAllowlist() external view returns (IAllowlist) {
    //     return allowlist;
    // }

    /**
     * @notice Return timestamp of last deposit of given address
     * @return timestamp of the last deposit made by the given address
     */
    function getDepositTimestamp(address user) external view returns (uint256) {
        return swapStorage.getDepositTimestamp(user);
    }

    /**
     * @notice Return current balance of the pooled token at given index
     * @param index the index of the token
     * @return current balance of the pooled token at given index with token's native precision
     */
    function getTokenBalance(uint8 index) external view returns (uint256) {
        require(index < swapStorage.pooledTokens.length, "Index out of range");
        return swapStorage.balances[index];
    }

    /**
     * @notice Get the virtual price, to help calculate profit
     * @return the virtual price, scaled to the POOL_PRECISION_DECIMALS
     */
    function getVirtualPrice() external view returns (uint256) {
        return swapStorage.getVirtualPrice();
    }

    /**
     * @notice Calculate amount of tokens you receive on swap
     * @param tokenIndexFrom the token the user wants to sell
     * @param tokenIndexTo the token the user wants to buy
     * @param dx the amount of tokens the user wants to sell. If the token charges
     * a fee on transfers, use the amount that gets transferred after the fee.
     * @return amount of tokens the user will receive
     */
    function calculateSwap(
        uint8 tokenIndexFrom,
        uint8 tokenIndexTo,
        uint256 dx
    ) external view returns (uint256) {
        return swapStorage.calculateSwap(tokenIndexFrom, tokenIndexTo, dx);
    }

    /**
     * @notice A simple method to calculate prices from deposits or
     * withdrawals, excluding fees but including slippage. This is
     * helpful as an input into the various "min" parameters on calls
     * to fight front-running
     *
     * @dev This shouldn't be used outside frontends for user estimates.
     *
     * @param account address that is depositing or withdrawing tokens
     * @param amounts an array of token amounts to deposit or withdrawal,
     * corresponding to pooledTokens. The amount should be in each
     * pooled token's native precision. If a token charges a fee on transfers,
     * use the amount that gets transferred after the fee.
     * @param deposit whether this is a deposit or a withdrawal
     * @return token amount the user will receive
     */
    function calculateTokenAmount(
        address account,
        uint256[] calldata amounts,
        bool deposit
    ) external view returns (uint256) {
        return swapStorage.calculateTokenAmount(account, amounts, deposit);
    }

    /**
     * @notice A simple method to calculate amount of each underlying
     * tokens that is returned upon burning given amount of LP tokens
     * @param account the address that is withdrawing tokens
     * @param amount the amount of LP tokens that would be burned on withdrawal
     * @return array of token balances that the user will receive
     */
    function calculateRemoveLiquidity(address account, uint256 amount)
        external
        view
        returns (uint256[] memory)
    {
        return swapStorage.calculateRemoveLiquidity(account, amount);
    }

    /**
     * @notice Calculate the amount of underlying token available to withdraw
     * when withdrawing via only single token
     * @param account the address that is withdrawing tokens
     * @param tokenAmount the amount of LP token to burn
     * @param tokenIndex index of which token will be withdrawn
     * @return availableTokenAmount calculated amount of underlying token
     * available to withdraw
     */
    function calculateRemoveLiquidityOneToken(
        address account,
        uint256 tokenAmount,
        uint8 tokenIndex
    ) external view returns (uint256 availableTokenAmount) {
        (availableTokenAmount, ) = swapStorage.calculateWithdrawOneToken(
            account,
            tokenAmount,
            tokenIndex
        );
    }

    /**
     * @notice Calculate the fee that is applied when the given user withdraws. The withdraw fee
     * decays linearly over period of 4 weeks. For example, depositing and withdrawing right away
     * will charge you the full amount of withdraw fee. But withdrawing after 4 weeks will charge you
     * no additional fees.
     * @dev returned value should be divided by FEE_DENOMINATOR to convert to correct decimals
     * @param user address you want to calculate withdraw fee of
     * @return current withdraw fee of the user
     */
    function calculateCurrentWithdrawFee(address user)
        external
        view
        returns (uint256)
    {
        return swapStorage.calculateCurrentWithdrawFee(user);
    }

    /**
     * @notice This function reads the accumulated amount of admin fees of the token with given index
     * @param index Index of the pooled token
     * @return admin's token balance in the token's precision
     */
    function getAdminBalance(uint256 index) external view returns (uint256) {
        return swapStorage.getAdminBalance(index);
    }

    /*** STATE MODIFYING FUNCTIONS ***/

    /**
     * @notice Swap two tokens using this pool
     * @param tokenIndexFrom the token the user wants to swap from
     * @param tokenIndexTo the token the user wants to swap to
     * @param dx the amount of tokens the user wants to swap from
     * @param minDy the min amount the user would like to receive, or revert.
     * @param deadline latest timestamp to accept this transaction
     * @return amount of token user received on swap
     */
    function swap(
        uint8 tokenIndexFrom,
        uint8 tokenIndexTo,
        uint256 dx,
        uint256 minDy,
        uint256 deadline
    )
        external
        nonReentrant
        whenNotPaused
        deadlineCheck(deadline)
        returns (uint256)
    {
        return swapStorage.swap(tokenIndexFrom, tokenIndexTo, dx, minDy);
    }

    /**
     * @notice Add liquidity to the pool with given amounts during guarded launch phase. Only users
     * with valid address and proof can successfully call this function. When this function is called
     * after the guarded release phase is over, the merkleProof is ignored.
     * @param amounts the amounts of each token to add, in their native precision
     * @param minToMint the minimum LP tokens adding this amount of liquidity
     * should mint, otherwise revert. Handy for front-running mitigation
     * @param deadline latest timestamp to accept this transaction
     * get this data off chain. Even if the address is in the allowlist, users must include
     * a valid proof for this call to succeed. If the pool is no longer in the guarded release phase,
     * this parameter is ignored.
     * @return amount of LP token user minted and received
     */
    function addLiquidity(
        uint256[] calldata amounts,
        uint256 minToMint,
        uint256 deadline
    )
        external
        nonReentrant
        whenNotPaused
        deadlineCheck(deadline)
        returns (uint256)
    {
        return swapStorage.addLiquidity(amounts, minToMint);
    }

    /**
     * @notice Burn LP tokens to remove liquidity from the pool. Withdraw fee that decays linearly
     * over period of 4 weeks since last deposit will apply.
     * @dev Liquidity can always be removed, even when the pool is paused.
     * @param amount the amount of LP tokens to burn
     * @param minAmounts the minimum amounts of each token in the pool
     *        acceptable for this burn. Useful as a front-running mitigation
     * @param deadline latest timestamp to accept this transaction
     * @return amounts of tokens user received
     */
    function removeLiquidity(
        uint256 amount,
        uint256[] calldata minAmounts,
        uint256 deadline
    ) external nonReentrant deadlineCheck(deadline) returns (uint256[] memory) {
        return swapStorage.removeLiquidity(amount, minAmounts);
    }

    /**
     * @notice Remove liquidity from the pool all in one token. Withdraw fee that decays linearly
     * over period of 4 weeks since last deposit will apply.
     * @param tokenAmount the amount of the token you want to receive
     * @param tokenIndex the index of the token you want to receive
     * @param minAmount the minimum amount to withdraw, otherwise revert
     * @param deadline latest timestamp to accept this transaction
     * @return amount of chosen token user received
     */
    function removeLiquidityOneToken(
        uint256 tokenAmount,
        uint8 tokenIndex,
        uint256 minAmount,
        uint256 deadline
    )
        external
        nonReentrant
        whenNotPaused
        deadlineCheck(deadline)
        returns (uint256)
    {
        return
            swapStorage.removeLiquidityOneToken(
                tokenAmount,
                tokenIndex,
                minAmount
            );
    }

    /**
     * @notice Remove liquidity from the pool, weighted differently than the
     * pool's current balances. Withdraw fee that decays linearly
     * over period of 4 weeks since last deposit will apply.
     * @param amounts how much of each token to withdraw
     * @param maxBurnAmount the max LP token provider is willing to pay to
     * remove liquidity. Useful as a front-running mitigation.
     * @param deadline latest timestamp to accept this transaction
     * @return amount of LP tokens burned
     */
    function removeLiquidityImbalance(
        uint256[] calldata amounts,
        uint256 maxBurnAmount,
        uint256 deadline
    )
        external
        nonReentrant
        whenNotPaused
        deadlineCheck(deadline)
        returns (uint256)
    {
        return swapStorage.removeLiquidityImbalance(amounts, maxBurnAmount);
    }

    /*** ADMIN FUNCTIONS ***/

    /**
     * @notice Updates the user withdraw fee. This function can only be called by
     * the pool token. Should be used to update the withdraw fee on transfer of pool tokens.
     * Transferring your pool token will reset the 4 weeks period. If the recipient is already
     * holding some pool tokens, the withdraw fee will be discounted in respective amounts.
     * @param recipient address of the recipient of pool token
     * @param transferAmount amount of pool token to transfer
     */
    function updateUserWithdrawFee(address recipient, uint256 transferAmount)
        external
    {
        require(
            msg.sender == address(swapStorage.lpToken),
            "Only callable by pool token"
        );
        swapStorage.updateUserWithdrawFee(recipient, transferAmount);
    }

    /**
     * @notice Withdraw all admin fees to the contract owner
     */
    function withdrawAdminFees() external onlyOwner {
        swapStorage.withdrawAdminFees(owner());
    }

    /**
     * @notice Update the admin fee. Admin fee takes portion of the swap fee.
     * @param newAdminFee new admin fee to be applied on future transactions
     */
    function setAdminFee(uint256 newAdminFee) external onlyOwner {
        swapStorage.setAdminFee(newAdminFee);
    }

    /**
     * @notice Update the swap fee to be applied on swaps
     * @param newSwapFee new swap fee to be applied on future transactions
     */
    function setSwapFee(uint256 newSwapFee) external onlyOwner {
        swapStorage.setSwapFee(newSwapFee);
    }

    /**
     * @notice Update the withdraw fee. This fee decays linearly over 4 weeks since
     * user's last deposit.
     * @param newWithdrawFee new withdraw fee to be applied on future deposits
     */
    function setDefaultWithdrawFee(uint256 newWithdrawFee) external onlyOwner {
        swapStorage.setDefaultWithdrawFee(newWithdrawFee);
    }

    /**
     * @notice Start ramping up or down Target price towards given futureTargetPrice and futureTime
     * Checks if the change is too rapid, and commits the new Target price value only when it falls under
     * the limit range.
     * @param futureTargetPrice the new target price to ramp towards
     * @param futureTime timestamp when the new target price should be reached
     */
    function rampTargetPrice(uint256 futureTargetPrice, uint256 futureTime) external onlyOwner {
        swapStorage.tokenPrecisionMultipliers[0] = targetPriceStorage.rampTargetPrice(futureTargetPrice, futureTime);
    }


    /**
     * @notice Start ramping up or down A parameter towards given futureA and futureTime
     * Checks if the change is too rapid, and commits the new A value only when it falls under
     * the limit range.
     * @param futureA the new A to ramp towards
     * @param futureTime timestamp when the new A should be reached
     */
    function rampA(uint256 futureA, uint256 futureTime) external onlyOwner {
        swapStorage.rampA(futureA, futureTime);
    }

    /**
     * @notice Start ramping up or down A2 parameter towards given futureA and futureTime
     * Checks if the change is too rapid, and commits the new A value only when it falls under
     * the limit range.
     * @param futureA the new A2 to ramp towards
     * @param futureTime timestamp when the new A2 should be reached
     */
    function rampA2(uint256 futureA, uint256 futureTime) external onlyOwner {
        swapStorage.rampA2(futureA, futureTime);
    }

    /**
     * @notice Stop ramping Target Price immediately. Reverts if ramp Target Price is already stopped.
     */
    function stopRampTargetPrice() external onlyOwner {
        swapStorage.tokenPrecisionMultipliers[0] = targetPriceStorage.stopRampTargetPrice();
    }


    /**
     * @notice Stop ramping A immediately. Reverts if ramp A is already stopped.
     */
    function stopRampA() external onlyOwner {
        swapStorage.stopRampA();
    }

    /**
     * @notice Stop ramping A2 immediately. Reverts if ramp A2 is already stopped.
     */
    function stopRampA2() external onlyOwner {
        swapStorage.stopRampA2();
    }

    // /**
    //  * @notice Disables the guarded launch phase, removing any limits on deposit amounts and addresses
    //  */
    // function disableGuard() external onlyOwner {
    //     guarded = false;
    // }

    // /**
    //  * @notice Reads and returns current guarded status of the pool
    //  * @return guarded_ boolean value indicating whether the deposits should be guarded
    //  */
    // function isGuarded() external view returns (bool) {
    //     return guarded;
    // }
}
