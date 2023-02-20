// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.7.0;

import "./IVault.sol";
import "./../../ITempusPool.sol";

interface ITempusAMM {
    enum JoinKind {
        INIT,
        EXACT_TOKENS_IN_FOR_BPT_OUT
    }
    enum ExitKind {
        EXACT_BPT_IN_FOR_TOKENS_OUT,
        BPT_IN_FOR_EXACT_TOKENS_OUT
    }

    function getVault() external view returns (IVault);

    function getPoolId() external view returns (bytes32);

    function tempusPool() external view returns (ITempusPool);

    function balanceOf(address) external view returns (uint256);

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external returns (bool);

    /// Calculates the expected returned swap amount
    /// @param amount The given input amount of tokens
    /// @param yieldShareIn Specifies whether to calculate the swap from TYS to TPS (if true) or from TPS to TYS
    /// @return The expected returned amount of outToken
    function getExpectedReturnGivenIn(uint256 amount, bool yieldShareIn) external view returns (uint256);

    /// @dev Returns amount that user needs to swap to end up with almost the same amounts of Principals and Yields
    /// @param principals User's Principals balance
    /// @param yields User's Yields balance
    /// @param threshold Maximum difference between final balances of Principals and Yields
    /// @return amountIn Amount of Principals or Yields that user needs to swap to end with almost equal amounts
    function getSwapAmountToEndWithEqualShares(
        uint256 principals,
        uint256 yields,
        uint256 threshold
    ) external view returns (uint256 amountIn);

    /// @dev queries exiting TempusAMM with exact BPT tokens in
    /// @param bptAmountIn amount of LP tokens in
    /// @return principals Amount of principals that user would recieve back
    /// @return yields Amount of yields that user would recieve back
    function getExpectedTokensOutGivenBPTIn(uint256 bptAmountIn)
        external
        view
        returns (uint256 principals, uint256 yields);

    /// @dev queries exiting TempusAMM with exact tokens out
    /// @param principalsStaked amount of Principals to withdraw
    /// @param yieldsStaked amount of Yields to withdraw
    /// @return lpTokens Amount of Lp tokens that user would redeem
    function getExpectedBPTInGivenTokensOut(uint256 principalsStaked, uint256 yieldsStaked)
        external
        view
        returns (uint256 lpTokens);

    /// @dev queries joining TempusAMM with exact tokens in
    /// @param amountsIn amount of tokens to be added to the pool
    /// @return amount of LP tokens that could be recieved
    function getExpectedLPTokensForTokensIn(uint256[] memory amountsIn) external view returns (uint256);

    /// @dev This function returns the appreciation of one BPT relative to the
    /// underlying tokens. This starts at 1 when the pool is created and grows over time
    function getRate() external view returns (uint256);
}
