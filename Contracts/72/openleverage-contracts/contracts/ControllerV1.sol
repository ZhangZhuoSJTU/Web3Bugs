// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.7.6;
pragma experimental ABIEncoderV2;

import "./ControllerInterface.sol";
import "./liquidity/LPoolDelegator.sol";
import "./Adminable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/math/Math.sol";
import "./DelegateInterface.sol";
import "./lib/DexData.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./OpenLevInterface.sol";
import "./XOLEInterface.sol";

/// @title OpenLeverage Controller Logic
/// @author OpenLeverage
/// @notice You can use this contract for operating trades and find trading intel.
/// @dev Admin of this contract is the address of Timelock. Admin set configs and transfer insurance expected to XOLE.
contract ControllerV1 is DelegateInterface, Adminable, ControllerInterface, ControllerStorage {
    using SafeMath for uint;
    constructor () {}

    /// @notice Initialize proxy contract
    /// @dev This function is not supposed to call multiple times. All configs can be set through other functions.
    /// @param _oleToken Address of OLEToken.
    /// @param _xoleToken address of XOLEToken.
    /// @param _wETH Address of wrapped native coin.
    /// @param _lpoolImplementation Address of lending pool logic contract.
    /// @param _openlev Address of openLev aggregator contract.
    /// @param _dexAggregator Address of DexAggregatorDelegator.
    /// @param _oleWethDexData Index and feeRate of ole/weth pair.
    function initialize(
        IERC20 _oleToken,
        address _xoleToken,
        address _wETH,
        address _lpoolImplementation,
        address _openlev,
        DexAggregatorInterface _dexAggregator,
        bytes memory _oleWethDexData
    ) public {
        require(msg.sender == admin, "not admin");
        oleToken = _oleToken;
        xoleToken = _xoleToken;
        wETH = _wETH;
        lpoolImplementation = _lpoolImplementation;
        openLev = _openlev;
        dexAggregator = _dexAggregator;
        oleWethDexData = _oleWethDexData;
    }

    struct LPoolPairVar {
        address token0;
        address token1;
        uint16 marginLimit;
        bytes dexData;
        string tokenName;
        string tokenSymbol;
    }

    /// @notice Create Lending pools for token0, token1. create market on OpenLev
    /// @param token0 Address of token0
    /// @param token1 Address of token1
    /// @param marginLimit The liquidation trigger ratio of deposited token value to borrowed token value.
    /// @param dexData Pair initiate data including index, feeRate of the Dex and tax rate of the underlying tokens.
    function createLPoolPair(address token0, address token1, uint16 marginLimit, bytes memory dexData) external override {
        require(token0 != token1, 'identical address');
        require(lpoolPairs[token0][token1].lpool0 == address(0) || lpoolPairs[token1][token0].lpool0 == address(0), 'pool pair exists');
        LPoolPairVar memory pairVar = LPoolPairVar(token0, token1, marginLimit, dexData, "OpenLeverage LToken", "LToken");
        LPoolDelegator pool0 = new LPoolDelegator();
        pool0.initialize(pairVar.token0, pairVar.token0 == wETH ? true : false, address(this), baseRatePerBlock, multiplierPerBlock, jumpMultiplierPerBlock, kink, 1e18,
            pairVar.tokenName, pairVar.tokenSymbol, ERC20(pairVar.token0).decimals(), admin, lpoolImplementation);
        LPoolDelegator pool1 = new LPoolDelegator();
        pool1.initialize(pairVar.token1, pairVar.token1 == wETH ? true : false, address(this), baseRatePerBlock, multiplierPerBlock, jumpMultiplierPerBlock, kink, 1e18,
            pairVar.tokenName, pairVar.tokenSymbol, ERC20(pairVar.token1).decimals(), admin, lpoolImplementation);
        lpoolPairs[token0][token1] = LPoolPair(address(pool0), address(pool1));
        lpoolPairs[token1][token0] = LPoolPair(address(pool0), address(pool1));
        uint16 marketId = (OpenLevInterface(openLev)).addMarket(LPoolInterface(address(pool0)), LPoolInterface(address(pool1)), pairVar.marginLimit, pairVar.dexData);
        emit LPoolPairCreated(pairVar.token0, address(pool0), pairVar.token1, address(pool1), marketId, pairVar.marginLimit, pairVar.dexData);
    }


    /*** Policy Hooks ***/
    function mintAllowed(address minter, uint lTokenAmount) external override onlyLPoolAllowed onlyNotSuspended {
        stake(LPoolInterface(msg.sender), minter, lTokenAmount);
    }

    function transferAllowed(address from, address to, uint lTokenAmount) external override {
        withdraw(LPoolInterface(msg.sender), from, lTokenAmount);
        stake(LPoolInterface(msg.sender), to, lTokenAmount);
    }

    function redeemAllowed(address redeemer, uint lTokenAmount) external override onlyNotSuspended {
        if (withdraw(LPoolInterface(msg.sender), redeemer, lTokenAmount)) {
            getRewardInternal(LPoolInterface(msg.sender), redeemer, false);
        }
    }

    function borrowAllowed(address borrower, address payee, uint borrowAmount) external override onlyLPoolAllowed onlyNotSuspended onlyOpenLevOperator(payee) {
        require(LPoolInterface(msg.sender).availableForBorrow() >= borrowAmount, "Borrow out of range");
        updateReward(LPoolInterface(msg.sender), borrower, true);
    }

    function repayBorrowAllowed(address payer, address borrower, uint repayAmount, bool isEnd) external override {
        // Shh - currently unused
        repayAmount;
        if (isEnd) {
            require(openLev == payer, "Operator not openLev");
        }
        if (updateReward(LPoolInterface(msg.sender), borrower, true)) {
            getRewardInternal(LPoolInterface(msg.sender), borrower, true);
        }
    }

    function liquidateAllowed(uint marketId, address liquidator, uint liquidateAmount, bytes memory dexData) external override onlyOpenLevOperator(msg.sender) {
        // Shh - currently unused
        liquidateAmount;
        dexData;
        require(!marketSuspend[marketId], 'Market suspended');
        // market no distribution
        if (marketExtraDistribution[marketId] == false) {
            return;
        }
        // rewards is zero or balance not enough
        if (oleTokenDistribution.liquidatorMaxPer == 0) {
            return;
        }
        //get wETH quote ole price
        (uint256 price, uint8 decimal) = dexAggregator.getPrice(wETH, address(oleToken), oleWethDexData);
        // oleRewards=wETHValue*liquidatorOLERatio
        uint calcLiquidatorRewards = uint(600000)  // needs approximately 600k gas for liquidation
        .mul(50 gwei).mul(price).div(10 ** uint(decimal))
        .mul(oleTokenDistribution.liquidatorOLERatio).div(100);
        // check compare max
        if (calcLiquidatorRewards > oleTokenDistribution.liquidatorMaxPer) {
            calcLiquidatorRewards = oleTokenDistribution.liquidatorMaxPer;
        }
        if (calcLiquidatorRewards > oleTokenDistribution.extraBalance) {
            return;
        }
        if (transferOut(liquidator, calcLiquidatorRewards)) {
            oleTokenDistribution.extraBalance = oleTokenDistribution.extraBalance.sub(calcLiquidatorRewards);
            emit LiquidateReward(marketId, liquidator, calcLiquidatorRewards, oleTokenDistribution.extraBalance);
        }
    }

    function marginTradeAllowed(uint marketId) external view override onlyNotSuspended returns (bool){
        require(!marketSuspend[marketId], 'Market suspended');
        return true;
    }

    function updatePriceAllowed(uint marketId) external override onlyOpenLevOperator(msg.sender) {
        // Shh - currently unused
        marketId;
        // market no distribution
        if (marketExtraDistribution[marketId] == false) {
            return;
        }
        uint reward = oleTokenDistribution.updatePricePer;
        if (reward > oleTokenDistribution.extraBalance) {
            return;
        }
        if (transferOut(tx.origin, reward)) {
            oleTokenDistribution.extraBalance = oleTokenDistribution.extraBalance.sub(reward);
            emit UpdatePriceReward(marketId, tx.origin, reward, oleTokenDistribution.extraBalance);
        }
    }

    /*** Distribution Functions ***/

    function initDistribution(uint totalAmount, uint64 startTime, uint64 duration) internal pure returns (ControllerStorage.LPoolDistribution memory distribution){
        distribution.startTime = startTime;
        distribution.endTime = startTime + duration;
        require(distribution.endTime >= startTime, 'EndTime is overflow');
        distribution.duration = duration;
        distribution.lastUpdateTime = startTime;
        distribution.totalRewardAmount = totalAmount;
        distribution.rewardRate = totalAmount.div(duration);
    }

    function updateDistribution(ControllerStorage.LPoolDistribution storage distribution, uint addAmount) internal {
        uint256 blockTime = block.timestamp;
        if (blockTime >= distribution.endTime) {
            distribution.rewardRate = addAmount.div(distribution.duration);
        } else {
            uint256 remaining = distribution.endTime - blockTime;
            uint256 leftover = remaining.mul(distribution.rewardRate);
            distribution.rewardRate = addAmount.add(leftover).div(distribution.duration);
        }
        distribution.lastUpdateTime = uint64(blockTime);
        distribution.totalRewardAmount = distribution.totalRewardAmount.add(addAmount);
        distribution.endTime = distribution.duration + uint64(blockTime);
        require(distribution.endTime > blockTime, 'EndTime is overflow');
    }

    function checkStart(LPoolInterface lpool, bool isBorrow) internal view returns (bool){
        return block.timestamp >= lpoolDistributions[lpool][isBorrow].startTime;
    }


    function existRewards(LPoolInterface lpool, bool isBorrow) internal view returns (bool){
        return lpoolDistributions[lpool][isBorrow].totalRewardAmount > 0;
    }

    function lastTimeRewardApplicable(LPoolInterface lpool, bool isBorrow) public view returns (uint256) {
        return Math.min(block.timestamp, lpoolDistributions[lpool][isBorrow].endTime);
    }

    function rewardPerToken(LPoolInterface lpool, bool isBorrow) internal view returns (uint256) {
        LPoolDistribution memory distribution = lpoolDistributions[lpool][isBorrow];
        uint totalAmount = isBorrow ? lpool.totalBorrowsCurrent() : lpool.totalSupply().add(distribution.extraTotalToken);
        if (totalAmount == 0) {
            return distribution.rewardPerTokenStored;
        }
        return
        distribution.rewardPerTokenStored.add(
            lastTimeRewardApplicable(lpool, isBorrow)
            .sub(distribution.lastUpdateTime)
            .mul(distribution.rewardRate)
            .mul(1e18)
            .div(totalAmount)
        );
    }

    function updateReward(LPoolInterface lpool, address account, bool isBorrow) internal returns (bool) {
        if (!existRewards(lpool, isBorrow) || !checkStart(lpool, isBorrow)) {
            return false;
        }
        uint rewardPerTokenStored = rewardPerToken(lpool, isBorrow);
        lpoolDistributions[lpool][isBorrow].rewardPerTokenStored = rewardPerTokenStored;
        lpoolDistributions[lpool][isBorrow].lastUpdateTime = uint64(lastTimeRewardApplicable(lpool, isBorrow));
        if (account != address(0)) {
            lPoolRewardByAccounts[lpool][isBorrow][account].rewards = earnedInternal(lpool, account, isBorrow);
            lPoolRewardByAccounts[lpool][isBorrow][account].rewardPerTokenStored = rewardPerTokenStored;
        }
        return true;
    }

    function stake(LPoolInterface lpool, address account, uint256 amount) internal returns (bool) {
        bool updateSucceed = updateReward(lpool, account, false);
        if (xoleToken == address(0) || XOLEInterface(xoleToken).balanceOf(account) < oleTokenDistribution.xoleRaiseMinAmount) {
            return updateSucceed;
        }
        uint addExtraToken = amount.mul(oleTokenDistribution.xoleRaiseRatio).div(100);
        lPoolRewardByAccounts[lpool][false][account].extraToken = lPoolRewardByAccounts[lpool][false][account].extraToken.add(addExtraToken);
        lpoolDistributions[lpool][false].extraTotalToken = lpoolDistributions[lpool][false].extraTotalToken.add(addExtraToken);
        return updateSucceed;
    }

    function withdraw(LPoolInterface lpool, address account, uint256 amount) internal returns (bool)  {
        bool updateSucceed = updateReward(lpool, account, false);
        if (xoleToken == address(0)) {
            return updateSucceed;
        }
        uint extraToken = lPoolRewardByAccounts[lpool][false][account].extraToken;
        if (extraToken == 0) {
            return updateSucceed;
        }
        uint oldBalance = lpool.balanceOf(account);
        //withdraw all
        if (oldBalance == amount) {
            lPoolRewardByAccounts[lpool][false][account].extraToken = 0;
            lpoolDistributions[lpool][false].extraTotalToken = lpoolDistributions[lpool][false].extraTotalToken.sub(extraToken);
        } else {
            uint subExtraToken = extraToken.mul(amount).div(oldBalance);
            lPoolRewardByAccounts[lpool][false][account].extraToken = extraToken.sub(subExtraToken);
            lpoolDistributions[lpool][false].extraTotalToken = lpoolDistributions[lpool][false].extraTotalToken.sub(subExtraToken);
        }
        return updateSucceed;
    }


    function earnedInternal(LPoolInterface lpool, address account, bool isBorrow) internal view returns (uint256) {
        LPoolRewardByAccount memory accountReward = lPoolRewardByAccounts[lpool][isBorrow][account];
        uint accountBalance = isBorrow ? lpool.borrowBalanceCurrent(account) : lpool.balanceOf(account).add(accountReward.extraToken);
        return
        accountBalance
        .mul(rewardPerToken(lpool, isBorrow).sub(accountReward.rewardPerTokenStored))
        .div(1e18)
        .add(accountReward.rewards);
    }

    function getRewardInternal(LPoolInterface lpool, address account, bool isBorrow) internal {
        uint256 reward = lPoolRewardByAccounts[lpool][isBorrow][account].rewards;
        if (reward > 0) {
            bool succeed = transferOut(account, reward);
            if (succeed) {
                lPoolRewardByAccounts[lpool][isBorrow][account].rewards = 0;
                emit PoolReward(address(lpool), account, isBorrow, reward);
            }
        }
    }

    function earned(LPoolInterface lpool, address account, bool isBorrow) external override view returns (uint256) {
        if (!existRewards(lpool, isBorrow) || !checkStart(lpool, isBorrow)) {
            return 0;
        }
        return earnedInternal(lpool, account, isBorrow);
    }

    function getSupplyRewards(LPoolInterface[] calldata lpools, address account) external override {
        uint rewards;
        for (uint i = 0; i < lpools.length; i++) {
            if (updateReward(lpools[i], account, false)) {
                uint poolRewards = lPoolRewardByAccounts[lpools[i]][false][account].rewards;
                rewards = rewards.add(poolRewards);
                lPoolRewardByAccounts[lpools[i]][false][account].rewards = 0;
                emit PoolReward(address(lpools[i]), account, false, poolRewards);
            }
        }
        require(rewards > 0, 'rewards is zero');
        require(oleToken.balanceOf(address(this)) >= rewards, 'balance<rewards');
        oleToken.transfer(account, rewards);
    }


    function transferOut(address to, uint amount) internal returns (bool){
        if (oleToken.balanceOf(address(this)) < amount) {
            return false;
        }
        oleToken.transfer(to, amount);
        return true;
    }
    /*** Admin Functions ***/

    function setOLETokenDistribution(uint moreSupplyBorrowBalance, uint moreExtraBalance, uint128 updatePricePer, uint128 liquidatorMaxPer, uint16 liquidatorOLERatio, uint16 xoleRaiseRatio, uint128 xoleRaiseMinAmount) external override onlyAdmin {
        uint newSupplyBorrowBalance = oleTokenDistribution.supplyBorrowBalance.add(moreSupplyBorrowBalance);
        uint newExtraBalance = oleTokenDistribution.extraBalance.add(moreExtraBalance);
        uint totalAll = newExtraBalance.add(newSupplyBorrowBalance);
        require(oleToken.balanceOf(address(this)) >= totalAll, 'not enough balance');
        oleTokenDistribution.supplyBorrowBalance = newSupplyBorrowBalance;
        oleTokenDistribution.extraBalance = newExtraBalance;
        oleTokenDistribution.updatePricePer = updatePricePer;
        oleTokenDistribution.liquidatorMaxPer = liquidatorMaxPer;
        oleTokenDistribution.liquidatorOLERatio = liquidatorOLERatio;
        oleTokenDistribution.xoleRaiseRatio = xoleRaiseRatio;
        oleTokenDistribution.xoleRaiseMinAmount = xoleRaiseMinAmount;
        emit NewOLETokenDistribution(moreSupplyBorrowBalance, moreExtraBalance, updatePricePer, liquidatorMaxPer, liquidatorOLERatio, xoleRaiseRatio, xoleRaiseMinAmount);
    }

    function distributeRewards2Pool(address pool, uint supplyAmount, uint borrowAmount, uint64 startTime, uint64 duration) external override onlyAdmin {
        require(supplyAmount > 0 || borrowAmount > 0, 'amount is less than 0');
        require(startTime > block.timestamp, 'startTime < blockTime');
        if (supplyAmount > 0) {
            require(lpoolDistributions[LPoolInterface(pool)][false].startTime == 0, 'Distribute only once');
            lpoolDistributions[LPoolInterface(pool)][false] = initDistribution(supplyAmount, startTime, duration);
        }
        if (borrowAmount > 0) {
            require(lpoolDistributions[LPoolInterface(pool)][true].startTime == 0, 'Distribute only once');
            lpoolDistributions[LPoolInterface(pool)][true] = initDistribution(borrowAmount, startTime, duration);
        }
        uint subAmount = supplyAmount.add(borrowAmount);
        oleTokenDistribution.supplyBorrowBalance = oleTokenDistribution.supplyBorrowBalance.sub(subAmount);
        emit Distribution2Pool(pool, supplyAmount, borrowAmount, startTime, duration, oleTokenDistribution.supplyBorrowBalance);
    }

    function distributeRewards2PoolMore(address pool, uint supplyAmount, uint borrowAmount) external override onlyAdmin {
        require(supplyAmount > 0 || borrowAmount > 0, 'amount0 and amount1 is 0');
        if (supplyAmount > 0) {
            updateReward(LPoolInterface(pool), address(0), false);
            updateDistribution(lpoolDistributions[LPoolInterface(pool)][false], supplyAmount);
        }
        if (borrowAmount > 0) {
            updateReward(LPoolInterface(pool), address(0), true);
            updateDistribution(lpoolDistributions[LPoolInterface(pool)][true], borrowAmount);
        }
        bool isBorrowMore = borrowAmount > 0 ? true : false;
        uint subAmount = supplyAmount.add(borrowAmount);
        oleTokenDistribution.supplyBorrowBalance = oleTokenDistribution.supplyBorrowBalance.sub(subAmount);
        emit Distribution2Pool(pool, supplyAmount, borrowAmount, lpoolDistributions[LPoolInterface(pool)][isBorrowMore].startTime,
            lpoolDistributions[LPoolInterface(pool)][isBorrowMore].duration, oleTokenDistribution.supplyBorrowBalance);
    }

    function distributeExtraRewards2Markets(uint[] memory marketIds, bool isDistribution) external override onlyAdminOrDeveloper {
        for (uint i = 0; i < marketIds.length; i++) {
            marketExtraDistribution[marketIds[i]] = isDistribution;
        }
    }

    function setLPoolImplementation(address _lpoolImplementation) external override onlyAdmin {
        require(address(0) != _lpoolImplementation, '0x');
        lpoolImplementation = _lpoolImplementation;
    }

    function setOpenLev(address _openlev) external override onlyAdmin {
        require(address(0) != _openlev, '0x');
        openLev = _openlev;
    }

    function setDexAggregator(DexAggregatorInterface _dexAggregator) external override onlyAdmin {
        require(address(0) != address(_dexAggregator), '0x');
        dexAggregator = _dexAggregator;
    }

    function setInterestParam(uint256 _baseRatePerBlock, uint256 _multiplierPerBlock, uint256 _jumpMultiplierPerBlock, uint256 _kink) external override onlyAdmin {
        require(_baseRatePerBlock < 1e13 && _multiplierPerBlock < 1e13 && _jumpMultiplierPerBlock < 1e13 && _kink <= 1e18, 'PRI');
        baseRatePerBlock = _baseRatePerBlock;
        multiplierPerBlock = _multiplierPerBlock;
        jumpMultiplierPerBlock = _jumpMultiplierPerBlock;
        kink = _kink;
    }

    function setLPoolUnAllowed(address lpool, bool unAllowed) external override onlyAdminOrDeveloper {
        lpoolUnAlloweds[lpool] = unAllowed;
    }

    function setSuspend(bool _uspend) external override onlyAdminOrDeveloper {
        suspend = _uspend;
    }

    function setMarketSuspend(uint marketId, bool suspend) external override onlyAdminOrDeveloper {
        marketSuspend[marketId] = suspend;
    }

    function setOleWethDexData(bytes memory _oleWethDexData) external override onlyAdminOrDeveloper {
        oleWethDexData = _oleWethDexData;
    }

    modifier onlyLPoolAllowed() {
        require(!lpoolUnAlloweds[msg.sender], "LPool paused");
        _;
    }

    modifier onlyNotSuspended() {
        require(!suspend, 'Suspended');
        _;
    }
    
    modifier onlyOpenLevOperator(address operator) {
        require(openLev == operator || openLev == address(0), "Operator not openLev");
        _;
    }

}