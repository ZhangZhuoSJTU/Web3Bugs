//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

/**
 *  @title AssetManager Interface
 *  @dev Manage the token balances staked by the users and deposited by admins, and invest tokens to the integrated underlying lending protocols.
 */
interface IAssetManager {
    /**
     *  @dev Returns the balance of asset manager, plus the total amount of tokens deposited to all the underlying lending protocols.
     *  @param tokenAddress ERC20 token address
     *  @return Lending pool balance
     */
    function getPoolBalance(address tokenAddress) external view returns (uint256);

    /**
     *  @dev Returns the amount of the lending pool balance minus the amount of total staked.
     *  @param tokenAddress ERC20 token address
     *  @return Amount can be borrowed
     */
    function getLoanableAmount(address tokenAddress) external view returns (uint256);

    /**
     *  @dev Get the total amount of tokens deposited to all the integrated underlying protocols without side effects.
     *  @param tokenAddress ERC20 token address
     *  @return Total market balance
     */
    function totalSupply(address tokenAddress) external returns (uint256);

    /**
     *  @dev Get the total amount of tokens deposited to all the integrated underlying protocols, but without side effects. Safe to call anytime, but may not get the most updated number for the current block. Call totalSupply() for that purpose.
     *  @param tokenAddress ERC20 token address
     *  @return Total market balance
     */
    function totalSupplyView(address tokenAddress) external view returns (uint256);

    /**
     *  @dev Check if there is an underlying protocol available for the given ERC20 token.
     *  @param tokenAddress ERC20 token address
     *  @return Whether is supported
     */
    function isMarketSupported(address tokenAddress) external view returns (bool);

    /**
     *  @dev Deposit tokens to AssetManager, and those tokens will be passed along to adapters to deposit to integrated asset protocols if any is available.
     *  @param token ERC20 token address
     *  @param amount Deposit amount, in wei
     *  @return Deposited amount
     */
    function deposit(address token, uint256 amount) external returns (bool);

    /**
     *  @dev Withdraw from AssetManager
     *  @param token ERC20 token address
     *  @param account User address
     *  @param amount Withdraw amount, in wei
     *  @return Withdraw amount
     */
    function withdraw(
        address token,
        address account,
        uint256 amount
    ) external returns (bool);

    /**
     *  @dev Add a new ERC20 token to support in AssetManager
     *  @param tokenAddress ERC20 token address
     */
    function addToken(address tokenAddress) external;

    /**
     *  @dev Add a new adapter for the underlying lending protocol
     *  @param adapterAddress adapter address
     */
    function addAdapter(address adapterAddress) external;

    /**
     *  @dev For a give token set allowance for all integrated money markets
     *  @param tokenAddress ERC20 token address
     */
    function approveAllMarketsMax(address tokenAddress) external;

    /**
     *  @dev For a give moeny market set allowance for all underlying tokens
     *  @param adapterAddress Address of adaptor for money market
     */
    function approveAllTokensMax(address adapterAddress) external;

    /**
     *  @dev Set withdraw sequence
     *  @param newSeq priority sequence of money market indices to be used while withdrawing
     */
    function changeWithdrawSequence(uint256[] calldata newSeq) external;

    /**
     *  @dev Rebalance the tokens between integrated lending protocols
     *  @param tokenAddress ERC20 token address
     *  @param percentages Proportion
     */
    function rebalance(address tokenAddress, uint256[] calldata percentages) external;

    /**
     *  @dev Claim the tokens left on AssetManager balance, in case there are tokens get stuck here.
     *  @param tokenAddress ERC20 token address
     *  @param recipient Recipient address
     */
    function claimTokens(address tokenAddress, address recipient) external;

    /**
     *  @dev Claim the tokens stuck in the integrated adapters
     *  @param index MoneyMarkets array index
     *  @param tokenAddress ERC20 token address
     *  @param recipient Recipient address
     */
    function claimTokensFromAdapter(
        uint256 index,
        address tokenAddress,
        address recipient
    ) external;

    /**
     *  @dev Get the number of supported underlying protocols.
     *  @return MoneyMarkets length
     */
    function moneyMarketsCount() external view returns (uint256);

    /**
     *  @dev Get the count of supported tokens
     *  @return Number of supported tokens
     */
    function supportedTokensCount() external view returns (uint256);

    /**
     *  @dev Get the supported lending protocol
     *  @param tokenAddress ERC20 token address
     *  @param marketId MoneyMarkets array index
     *  @return tokenSupply
     */
    function getMoneyMarket(address tokenAddress, uint256 marketId) external view returns (uint256, uint256);

    /**
     *  @dev debt write off
     *  @param tokenAddress ERC20 token address
     *  @param amount WriteOff amount
     */
    function debtWriteOff(address tokenAddress, uint256 amount) external;
}
