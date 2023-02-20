//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;
pragma abicoder v1;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "../Controller.sol";
import "../interfaces/IMarketRegistry.sol";
import "../interfaces/IMoneyMarketAdapter.sol";
import "../interfaces/IAssetManager.sol";

/**
 *  @title AssetManager
 *  @dev Manage the token assets deposited by components and admins, and invest tokens to the integrated underlying lending protocols.
 */
contract AssetManager is Controller, ReentrancyGuardUpgradeable, IAssetManager {
    using SafeERC20Upgradeable for IERC20Upgradeable;
    using AddressUpgradeable for address;

    IMoneyMarketAdapter[] public moneyMarkets;
    mapping(address => Market) public supportedMarkets;
    address[] public supportedTokensList;
    //record admin or userManager balance
    mapping(address => mapping(address => uint256)) public balances; //1 user 2 token
    mapping(address => uint256) public totalPrincipal; //total stake amount
    address public marketRegistry;
    // slither-disable-next-line uninitialized-state
    uint256[] public withdrawSeq; // Priority sequence of money market indices for processing withdraws

    struct Market {
        bool isSupported;
    }

    modifier checkMarketSupported(address token) {
        require(isMarketSupported(token), "AssetManager: token not support");
        _;
    }

    modifier onlyAuth(address token) {
        require(
            _isUToken(msg.sender, token) || _isUserManager(msg.sender, token),
            "AssetManager: sender must uToken or userManager"
        );
        _;
    }

    /**
     *  @dev Emit when making a deposit
     *  @param token Depositing token address
     *  @param account Account address
     *  @param amount Deposit amount, in wei
     */
    event LogDeposit(address indexed token, address indexed account, uint256 amount);
    /**
     *  @dev Emit when withdrawing from AssetManager
     *  @param token Depositing token address
     *  @param account Account address
     *  @param amount Withdraw amount, in wei
     *  @param remaining The amount cannot be withdrawn
     */
    event LogWithdraw(address indexed token, address indexed account, uint256 amount, uint256 remaining);
    /**
     *  @dev Emit when rebalancing among the integrated money markets
     *  @param tokenAddress The address of the token to be rebalanced
     *  @param percentages Array of the percentages of the tokens to deposit to the money markets
     */
    event LogRebalance(address tokenAddress, uint256[] percentages);

    function __AssetManager_init(address _marketRegistry) public initializer {
        Controller.__Controller_init(msg.sender);
        ReentrancyGuardUpgradeable.__ReentrancyGuard_init();
        marketRegistry = _marketRegistry;
    }

    function setMarketRegistry(address _marketRegistry) external onlyAdmin {
        marketRegistry = _marketRegistry;
    }

    /**
     *  @dev Get the balance of asset manager, plus the total amount of tokens deposited to all the underlying lending protocols
     *  @param tokenAddress ERC20 token address
     *  @return Pool balance
     */
    function getPoolBalance(address tokenAddress) public view override returns (uint256) {
        IERC20Upgradeable poolToken = IERC20Upgradeable(tokenAddress);
        uint256 balance = poolToken.balanceOf(address(this));
        if (isMarketSupported(tokenAddress)) {
            return totalSupplyView(tokenAddress) + balance;
        } else {
            return balance;
        }
    }

    /**
     *  @dev Returns the amount of the lending pool balance minus the amount of total staked.
     *  @param tokenAddress ERC20 token address
     *  @return Amount can be borrowed
     */
    function getLoanableAmount(address tokenAddress) public view override returns (uint256) {
        uint256 poolBalance = getPoolBalance(tokenAddress);
        if (poolBalance > totalPrincipal[tokenAddress]) return poolBalance - totalPrincipal[tokenAddress];
        return 0;
    }

    /**
     *  @dev Get the total amount of tokens deposited to all the integrated underlying protocols without side effects.
     *  @param tokenAddress ERC20 token address
     *  @return Total market balance
     */
    function totalSupply(address tokenAddress) public override returns (uint256) {
        if (isMarketSupported(tokenAddress)) {
            uint256 tokenSupply = 0;
            for (uint256 i = 0; i < moneyMarkets.length; i++) {
                if (!moneyMarkets[i].supportsToken(tokenAddress)) {
                    continue;
                }
                tokenSupply += moneyMarkets[i].getSupply(tokenAddress);
            }

            return tokenSupply;
        } else {
            return 0;
        }
    }

    /**
     *  @dev Get the total amount of tokens deposited to all the integrated underlying protocols, but without side effects. Safe to call anytime, but may not get the most updated number for the current block. Call totalSupply() for that purpose.
     *  @param tokenAddress ERC20 token address
     *  @return Total market balance
     */
    function totalSupplyView(address tokenAddress) public view override returns (uint256) {
        if (isMarketSupported(tokenAddress)) {
            uint256 tokenSupply = 0;
            for (uint256 i = 0; i < moneyMarkets.length; i++) {
                if (!moneyMarkets[i].supportsToken(tokenAddress)) {
                    continue;
                }
                tokenSupply += moneyMarkets[i].getSupplyView(tokenAddress);
            }

            return tokenSupply;
        } else {
            return 0;
        }
    }

    /**
     *  @dev Check if there is an underlying protocol available for the given ERC20 token.
     *  @param tokenAddress ERC20 token address
     *  @return Whether is supported
     */
    function isMarketSupported(address tokenAddress) public view override returns (bool) {
        return supportedMarkets[tokenAddress].isSupported;
    }

    /**
     *  @dev Deposit tokens to AssetManager, and those tokens will be passed along to adapters to deposit to integrated asset protocols if any is available.
     *  @param token ERC20 token address
     *  @param amount ERC20 token address
     *  @return Deposited amount
     */
    function deposit(address token, uint256 amount)
        external
        override
        whenNotPaused
        onlyAuth(token)
        nonReentrant
        returns (bool)
    {
        IERC20Upgradeable poolToken = IERC20Upgradeable(token);
        require(amount > 0, "AssetManager: amount can not be zero");

        if (!_isUToken(msg.sender, token)) {
            balances[msg.sender][token] += amount;
            totalPrincipal[token] += amount;
        }

        bool remaining = true;
        if (isMarketSupported(token)) {
            // assumption: markets are arranged in order of decreasing liquidity
            // iterate markets till floors are filled
            // floors define minimum amount to maintain confidence in liquidity
            for (uint256 i = 0; i < moneyMarkets.length && remaining; i++) {
                IMoneyMarketAdapter moneyMarket = moneyMarkets[i];

                if (!moneyMarket.supportsToken(token)) continue;
                if (moneyMarket.floorMap(token) <= moneyMarket.getSupply(token)) continue;

                poolToken.safeTransferFrom(msg.sender, address(moneyMarket), amount);
                moneyMarket.deposit(token);
                remaining = false;
            }

            // assumption: less liquid markets provide more yield
            // iterate markets in reverse to optimize for yield
            // do this only if floors are filled i.e. min liquidity satisfied
            // dposit in the market where ceiling is not being exceeded
            for (uint256 j = moneyMarkets.length; j > 0 && remaining; j--) {
                IMoneyMarketAdapter moneyMarket = moneyMarkets[j - 1];
                if (!moneyMarket.supportsToken(token)) continue;

                uint256 supply = moneyMarket.getSupply(token);
                uint256 ceiling = moneyMarket.ceilingMap(token);
                if (ceiling <= supply) continue;
                if (supply + amount > ceiling) continue;

                poolToken.safeTransferFrom(msg.sender, address(moneyMarket), amount);
                moneyMarket.deposit(token);
                remaining = false;
            }
        }

        if (remaining) {
            poolToken.safeTransferFrom(msg.sender, address(this), amount);
        }

        emit LogDeposit(token, msg.sender, amount);

        return true;
    }

    /**
     *  @dev Withdraw from AssetManager
     *  @param token ERC20 token address
     *  @param account User address
     *  @param amount ERC20 token address
     *  @return Withdraw amount
     */
    function withdraw(
        address token,
        address account,
        uint256 amount
    ) external override whenNotPaused nonReentrant onlyAuth(token) returns (bool) {
        require(_checkSenderBalance(msg.sender, token, amount), "AssetManager: balance not enough to withdraw");

        uint256 remaining = amount;

        // If there are tokens in Asset Manager then transfer them on priority
        uint256 selfBalance = IERC20Upgradeable(token).balanceOf(address(this));
        if (selfBalance > 0) {
            uint256 withdrawAmount = selfBalance < remaining ? selfBalance : remaining;
            remaining -= withdrawAmount;
            IERC20Upgradeable(token).safeTransfer(account, withdrawAmount);
        }

        if (isMarketSupported(token)) {
            // iterate markets according to defined sequence and withdraw
            for (uint256 i = 0; i < withdrawSeq.length && remaining > 0; i++) {
                IMoneyMarketAdapter moneyMarket = moneyMarkets[withdrawSeq[i]];
                if (!moneyMarket.supportsToken(token)) continue;

                uint256 supply = moneyMarket.getSupply(token);
                if (supply == 0) continue;

                uint256 withdrawAmount = supply < remaining ? supply : remaining;
                remaining -= withdrawAmount;
                moneyMarket.withdraw(token, account, withdrawAmount);
            }
        }

        if (!_isUToken(msg.sender, token)) {
            balances[msg.sender][token] = balances[msg.sender][token] - amount + remaining;
            totalPrincipal[token] = totalPrincipal[token] - amount + remaining;
        }

        emit LogWithdraw(token, account, amount, remaining);

        return true;
    }

    function debtWriteOff(address token, uint256 amount) external override {
        require(balances[msg.sender][token] >= amount, "AssetManager: balance not enough");
        balances[msg.sender][token] -= amount;
        totalPrincipal[token] -= amount;
    }

    /**
     *  @dev Add a new ERC20 token to support in AssetManager
     *  @param tokenAddress ERC20 token address
     */
    function addToken(address tokenAddress) external override onlyAdmin {
        require(!supportedMarkets[tokenAddress].isSupported, "AssetManager: token is exist");
        supportedTokensList.push(tokenAddress);
        supportedMarkets[tokenAddress].isSupported = true;

        approveAllMarketsMax(tokenAddress);
    }

    /**
     *  @dev For a give token set allowance for all integrated money markets
     *  @param tokenAddress ERC20 token address
     */
    function approveAllMarketsMax(address tokenAddress) public override onlyAdmin {
        IERC20Upgradeable poolToken = IERC20Upgradeable(tokenAddress);
        for (uint256 i = 0; i < moneyMarkets.length; i++) {
            poolToken.safeApprove(address(moneyMarkets[i]), 0);
            poolToken.safeApprove(address(moneyMarkets[i]), type(uint256).max);
        }
    }

    /**
     *  @dev Add a new adapter for the underlying lending protocol
     *  @param adapterAddress adapter address
     */
    function addAdapter(address adapterAddress) external override onlyAdmin {
        bool isExist = false;
        for (uint256 i = 0; i < moneyMarkets.length; i++) {
            if (adapterAddress == address(moneyMarkets[i])) isExist = true;
        }

        if (!isExist) moneyMarkets.push(IMoneyMarketAdapter(adapterAddress));

        approveAllTokensMax(adapterAddress);
    }

    function overwriteAdapters(address[] calldata adapters) external onlyAdmin {
        moneyMarkets = new IMoneyMarketAdapter[](adapters.length);
        for (uint256 i = 0; i < adapters.length; i++) {
            moneyMarkets[i] = IMoneyMarketAdapter(adapters[i]);
        }
    }

    /**
     *  @dev For a give moeny market set allowance for all underlying tokens
     *  @param adapterAddress Address of adaptor for money market
     */
    function approveAllTokensMax(address adapterAddress) public override onlyAdmin {
        for (uint256 i = 0; i < supportedTokensList.length; i++) {
            IERC20Upgradeable poolToken = IERC20Upgradeable(supportedTokensList[i]);
            poolToken.safeApprove(adapterAddress, 0);
            poolToken.safeApprove(adapterAddress, type(uint256).max);
        }
    }

    /**
     *  @dev Set withdraw sequence
     *  @param newSeq priority sequence of money market indices to be used while withdrawing
     */
    function changeWithdrawSequence(uint256[] calldata newSeq) external override onlyAdmin {
        withdrawSeq = newSeq;
    }

    /**
     * @dev Take all the supply of `tokenAddress` and redistribute it according to `percentages`.
     *
     * Rejects if the token is not supported.
     *
     * @param tokenAddress Address of the token that is going to be rebalanced
     * @param percentages A list of percentages, expressed as units in 10000, indicating how to deposit the tokens in
     * each underlying money market. The length of this array is one less than the amount of money markets: the last
     * money market will receive the remaining tokens. For example, if there are 3 money markets, and you want to
     * rebalance so that the first one has 10.5% of the tokens, the second one 55%, and the third one 34.5%, this param
     * will be [1050, 5500].
     */
    function rebalance(address tokenAddress, uint256[] calldata percentages)
        external
        override
        checkMarketSupported(tokenAddress)
        onlyAdmin
    {
        IERC20Upgradeable token = IERC20Upgradeable(tokenAddress);
        require(percentages.length + 1 == moneyMarkets.length, "AssetManager: percentages error");

        for (uint256 i = 0; i < moneyMarkets.length; i++) {
            if (!moneyMarkets[i].supportsToken(tokenAddress)) {
                continue;
            }
            moneyMarkets[i].withdrawAll(tokenAddress, address(this));
        }

        uint256 tokenSupply = token.balanceOf(address(this));

        for (uint256 i = 0; i < percentages.length; i++) {
            if (!moneyMarkets[i].supportsToken(tokenAddress)) {
                continue;
            }
            uint256 amountToDeposit = (tokenSupply * percentages[i]) / 10000;
            if (amountToDeposit == 0) {
                continue;
            }
            token.safeTransfer(address(moneyMarkets[i]), amountToDeposit);
            moneyMarkets[i].deposit(tokenAddress);
        }

        uint256 remainingTokens = token.balanceOf(address(this));
        if (moneyMarkets[moneyMarkets.length - 1].supportsToken(tokenAddress) && remainingTokens > 0) {
            token.safeTransfer(address(moneyMarkets[moneyMarkets.length - 1]), remainingTokens);
            moneyMarkets[moneyMarkets.length - 1].deposit(tokenAddress);
        }

        require(token.balanceOf(address(this)) == 0, "AssetManager: there are remaining funds in the fund pool");

        emit LogRebalance(tokenAddress, percentages);
    }

    /**
     *  @dev Claim the tokens left on AssetManager balance, in case there are tokens get stuck here.
     *  @param tokenAddress ERC20 token address
     *  @param recipient Recipient address
     */
    function claimTokens(address tokenAddress, address recipient) external override onlyAdmin {
        require(recipient != address(0), "AsstManager: recipient can not be zero");
        IERC20Upgradeable token = IERC20Upgradeable(tokenAddress);
        uint256 balance = token.balanceOf(address(this));
        token.safeTransfer(recipient, balance);
    }

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
    ) external override onlyAdmin {
        IMoneyMarketAdapter moneyMarket = moneyMarkets[index];
        moneyMarket.claimTokens(tokenAddress, recipient);
    }

    /**
     *  @dev Get the number of supported underlying protocols.
     *  @return MoneyMarkets length
     */
    function moneyMarketsCount() external view override returns (uint256) {
        return moneyMarkets.length;
    }

    /**
     *  @dev Get the count of supported tokens
     *  @return Number of supported tokens
     */
    function supportedTokensCount() external view override returns (uint256) {
        return supportedTokensList.length;
    }

    /**
     *  @dev Get the supported lending protocol
     *  @param tokenAddress ERC20 token address
     *  @param marketId MoneyMarkets array index
     *  @return rate tokenSupply, rate(compound is supplyRatePerBlock 1e18, aave is supplyRatePerYear 1e27)
     */
    function getMoneyMarket(address tokenAddress, uint256 marketId)
        external
        view
        override
        returns (uint256 rate, uint256 tokenSupply)
    {
        rate = moneyMarkets[marketId].getRate(tokenAddress);
        tokenSupply += moneyMarkets[marketId].getSupplyView(tokenAddress);
    }

    function _checkSenderBalance(
        address sender,
        address tokenAddress,
        uint256 amount
    ) private view returns (bool) {
        if (_isUToken(sender, tokenAddress)) {
            // For all the lending markets, which have no deposits, return the tokens from the pool
            return getLoanableAmount(tokenAddress) >= amount;
        } else {
            return balances[sender][tokenAddress] >= amount;
        }
    }

    function _isUToken(address sender, address token) private view returns (bool) {
        (address uTokenAddress, ) = IMarketRegistry(marketRegistry).tokens(token);
        return uTokenAddress == sender;
    }

    function _isUserManager(address sender, address token) private view returns (bool) {
        (, address userManagerAddress) = IMarketRegistry(marketRegistry).tokens(token);
        return userManagerAddress == sender;
    }
}
