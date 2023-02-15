// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.6.11;

import "../TroveManager.sol";
import "../BorrowerOperations.sol";
import "../ActivePool.sol";
import "../DefaultPool.sol";
import "../StabilityPool.sol";
import "../GasPool.sol";
import "../CollSurplusPool.sol";
import "../YUSDToken.sol";
import "./PriceFeedTestnet.sol";
import "../SortedTroves.sol";
import "../TroveManagerLiquidations.sol";
import "../TroveManagerRedemptions.sol";
import "../Dependencies/Whitelist.sol";
import "./EchidnaProxy.sol";


// Run with:
// rm -f fuzzTests/corpus/* # (optional)
// ~/.local/bin/echidna-test contracts/TestContracts/EchidnaTester.sol --contract EchidnaTester --config fuzzTests/echidna_config.yaml

contract EchidnaTester {
    using SafeMath for uint;

    uint constant private NUMBER_OF_ACTORS = 100;
    uint constant private INITIAL_BALANCE = 1e24;
    uint private MCR;
    uint private CCR;
    uint private YUSD_GAS_COMPENSATION;

    TroveManager public troveManager;
    TroveManagerLiquidations public troveManagerLiquidations;
    TroveManagerRedemptions public troveManagerRedemptions;
    BorrowerOperations public borrowerOperations;
    ActivePool public activePool;
    DefaultPool public defaultPool;
    StabilityPool public stabilityPool;
    GasPool public gasPool;
    CollSurplusPool public collSurplusPool;
    YUSDToken public yusdToken;
    PriceFeedTestnet priceFeedTestnet;
    SortedTroves sortedTroves;
    Whitelist whitelist;

    EchidnaProxy[NUMBER_OF_ACTORS] public echidnaProxies;

    uint private numberOfTroves;

    constructor() public payable {
        troveManager = new TroveManager();
        borrowerOperations = new BorrowerOperations();
        activePool = new ActivePool();
        defaultPool = new DefaultPool();
        stabilityPool = new StabilityPool();
        gasPool = new GasPool();
        troveManagerLiquidations = new TroveManagerLiquidations();
        troveManagerRedemptions = new TroveManagerRedemptions();
        yusdToken = new YUSDToken(
            address(troveManager),
            address(troveManagerLiquidations),
            address(troveManagerRedemptions),
            address(stabilityPool),
            address(borrowerOperations)
        );
        whitelist = new Whitelist();

        collSurplusPool = new CollSurplusPool();
        priceFeedTestnet = new PriceFeedTestnet();

        sortedTroves = new SortedTroves();

        troveManager.setAddresses(address(borrowerOperations), 
            address(activePool), address(defaultPool), 
            address(stabilityPool), address(gasPool), address(collSurplusPool),
            address(priceFeedTestnet), address(yusdToken), 
            address(sortedTroves), address(0), address(0), address(0), address(0));
       
        borrowerOperations.setAddresses(address(troveManager), 
            address(activePool), address(defaultPool), 
            address(stabilityPool), address(gasPool), address(collSurplusPool),
            address(priceFeedTestnet), address(sortedTroves), 
            address(yusdToken), address(0));

        activePool.setAddresses(address(borrowerOperations), 
            address(troveManager), address(stabilityPool), address(defaultPool), address(whitelist),
            address(troveManagerLiquidations), address(troveManagerRedemptions), address(collSurplusPool)
        );

        defaultPool.setAddresses(address(troveManager), address(activePool), address(whitelist), address(0));
        
        stabilityPool.setAddresses(address(borrowerOperations), 
            address(troveManager), address(activePool), address(yusdToken), 
            address(sortedTroves), address(0), address(0), address(troveManagerLiquidations)); 

        collSurplusPool.setAddresses(address(borrowerOperations), 
             address(troveManager), address(troveManagerRedemptions), address(activePool), address(whitelist));
    
        sortedTroves.setParams(1e18, address(troveManager), address(borrowerOperations), address(troveManagerRedemptions));

        for (uint i = 0; i < NUMBER_OF_ACTORS; i++) {
            echidnaProxies[i] = new EchidnaProxy(troveManager, borrowerOperations, stabilityPool, yusdToken);
            (bool success, ) = address(echidnaProxies[i]).call{value: INITIAL_BALANCE}("");
            require(success, "proxy called failed");
        }

        MCR = borrowerOperations.MCR();
        CCR = borrowerOperations.CCR();
        YUSD_GAS_COMPENSATION = borrowerOperations.YUSD_GAS_COMPENSATION();
        require(MCR != 0, "MCR <= 0");
        require(CCR != 0, "CCR <= 0");

        priceFeedTestnet.setPrice(1e22);
    }

    // @KingYeti: added this helper function
    function _getVC(address[] memory _tokens, uint[] memory _amounts) internal view returns (uint totalVC) {
        require(_tokens.length == _amounts.length, "_getVC: length mismatch");
        for (uint i = 0; i < _tokens.length; i++) {
            address token = _tokens[i];
            uint tokenVC = whitelist.getValueVC(token, _amounts[i]);
            totalVC = totalVC.add(tokenVC);
        }
        return totalVC;
    }

    // TroveManager

//    function liquidateExt(uint _i, address _user) external {
//        uint actor = _i % NUMBER_OF_ACTORS;
//        echidnaProxies[actor].liquidatePrx(_user);
//    }
//
//    function liquidateTrovesExt(uint _i, uint _n) external {
//        // pass
//        // @KingYeti: we no longer have this function
////        uint actor = _i % NUMBER_OF_ACTORS;
////        echidnaProxies[actor].liquidateTrovesPrx(_n);
//    }
//
//    function batchLiquidateTrovesExt(uint _i, address[] calldata _troveArray) external {
//        uint actor = _i % NUMBER_OF_ACTORS;
//        echidnaProxies[actor].batchLiquidateTrovesPrx(_troveArray);
//    }
//
//    function redeemCollateralExt(
//        uint _i,
//        uint _YUSDAmount,
//        address _firstRedemptionHint,
//        address _upperPartialRedemptionHint,
//        address _lowerPartialRedemptionHint,
//        uint _partialRedemptionHintNICR
//    ) external {
//        uint actor = _i % NUMBER_OF_ACTORS;
//        echidnaProxies[actor].redeemCollateralPrx(_YUSDAmount, _firstRedemptionHint, _upperPartialRedemptionHint, _lowerPartialRedemptionHint, _partialRedemptionHintNICR, 0, 0);
//    }
//
//    // Borrower Operations
//
//    function getAdjustedETH(uint actorBalance, uint _ETH, uint ratio) internal view returns (uint) {
//        uint price = priceFeedTestnet.getPrice();
//        require(price != 0);
//        uint minETH = ratio.mul(YUSD_GAS_COMPENSATION).div(price);
//        require(actorBalance > minETH);
//        uint ETH = minETH + _ETH % (actorBalance - minETH);
//        return ETH;
//    }
//
//    // @KingYeti: changed parameters
//    function getAdjustedYUSD(address[] memory _tokens, uint[] memory _amounts, uint _YUSDAmount, uint ratio) internal view returns (uint) {
//        uint VC = _getVC(_tokens, _amounts);
//        uint YUSDAmount = _YUSDAmount;
//        uint compositeDebt = YUSDAmount.add(YUSD_GAS_COMPENSATION);
//        uint ICR = LiquityMath._computeCR(VC, compositeDebt);
//        if (ICR < ratio) {
//            compositeDebt = VC.div(ratio);
//            YUSDAmount = compositeDebt.sub(YUSD_GAS_COMPENSATION);
//        }
//        return YUSDAmount;
//    }
//
//    // @KingYeti: changed parameters
//    function openTroveExt(uint _i, address[] memory _tokens, uint[] memory _amounts, uint _YUSDAmount) public payable {
//        uint actor = _i % NUMBER_OF_ACTORS;
//        EchidnaProxy echidnaProxy = echidnaProxies[actor];
//        uint actorBalance = address(echidnaProxy).balance;
//
//        // we pass in CCR instead of MCR in case it’s the first one
//        uint ETH = getAdjustedETH(actorBalance, _ETH, CCR);
//        uint YUSDAmount = getAdjustedYUSD(_tokens, _amounts, _YUSDAmount, CCR);
//
//        //console.log('ETH', ETH);
//        //console.log('YUSDAmount', YUSDAmount);
//
//        echidnaProxy.openTrovePrx(_tokens, _amounts, YUSDAmount, address(0), address(0), 0);
//
//        numberOfTroves = troveManager.getTroveOwnersCount();
//        assert(numberOfTroves != 0);
//        // canary
//        //assert(numberOfTroves == 0);
//    }
//
//    function openTroveRawExt(uint _i, uint _ETH, uint _YUSDAmount, address _upperHint, address _lowerHint, uint _maxFee) public payable {
//        uint actor = _i % NUMBER_OF_ACTORS;
//        echidnaProxies[actor].openTrovePrx(_ETH, _YUSDAmount, _upperHint, _lowerHint, _maxFee);
//    }
//
//    function addCollExt(uint _i, uint _ETH) external payable {
//        uint actor = _i % NUMBER_OF_ACTORS;
//        EchidnaProxy echidnaProxy = echidnaProxies[actor];
//        uint actorBalance = address(echidnaProxy).balance;
//
//        uint ETH = getAdjustedETH(actorBalance, _ETH, MCR);
//
//        echidnaProxy.addCollPrx(ETH, address(0), address(0));
//    }
//
//    function addCollRawExt(uint _i, uint _ETH, address _upperHint, address _lowerHint) external payable {
//        uint actor = _i % NUMBER_OF_ACTORS;
//        echidnaProxies[actor].addCollPrx(_ETH, _upperHint, _lowerHint);
//    }
//
//    function withdrawCollExt(uint _i, uint _amount, address _upperHint, address _lowerHint) external {
//        uint actor = _i % NUMBER_OF_ACTORS;
//        echidnaProxies[actor].withdrawCollPrx(_amount, _upperHint, _lowerHint);
//    }
//
//    function withdrawYUSDExt(uint _i, uint _amount, address _upperHint, address _lowerHint, uint _maxFee) external {
//        uint actor = _i % NUMBER_OF_ACTORS;
//        echidnaProxies[actor].withdrawYUSDPrx(_amount, _upperHint, _lowerHint, _maxFee);
//    }
//
//    function repayYUSDExt(uint _i, uint _amount, address _upperHint, address _lowerHint) external {
//        uint actor = _i % NUMBER_OF_ACTORS;
//        echidnaProxies[actor].repayYUSDPrx(_amount, _upperHint, _lowerHint);
//    }
//
//    function closeTroveExt(uint _i) external {
//        uint actor = _i % NUMBER_OF_ACTORS;
//        echidnaProxies[actor].closeTrovePrx();
//    }
//
//    function adjustTroveExt(uint _i, uint _ETH, uint _collWithdrawal, uint _debtChange, bool _isDebtIncrease) external payable {
//        uint actor = _i % NUMBER_OF_ACTORS;
//        EchidnaProxy echidnaProxy = echidnaProxies[actor];
//        uint actorBalance = address(echidnaProxy).balance;
//
//        uint ETH = getAdjustedETH(actorBalance, _ETH, MCR);
//        uint debtChange = _debtChange;
//        if (_isDebtIncrease) {
//            debtChange = getAdjustedYUSD(ETH, uint(_debtChange), MCR);
//        }
//        echidnaProxy.adjustTrovePrx(ETH, _collWithdrawal, debtChange, _isDebtIncrease, address(0), address(0), 0);
//    }
//
//    function adjustTroveRawExt(uint _i, uint _ETH, uint _collWithdrawal, uint _debtChange, bool _isDebtIncrease, address _upperHint, address _lowerHint, uint _maxFee) external payable {
//        uint actor = _i % NUMBER_OF_ACTORS;
//        echidnaProxies[actor].adjustTrovePrx(_ETH, _collWithdrawal, _debtChange, _isDebtIncrease, _upperHint, _lowerHint, _maxFee);
//    }
//
//    // Pool Manager
//
//    function provideToSPExt(uint _i, uint _amount, address _frontEndTag) external {
//        uint actor = _i % NUMBER_OF_ACTORS;
//        echidnaProxies[actor].provideToSPPrx(_amount, _frontEndTag);
//    }
//
//    function withdrawFromSPExt(uint _i, uint _amount) external {
//        uint actor = _i % NUMBER_OF_ACTORS;
//        echidnaProxies[actor].withdrawFromSPPrx(_amount);
//    }
//
//    // YUSD Token
//
//    function transferExt(uint _i, address recipient, uint256 amount) external returns (bool) {
//        uint actor = _i % NUMBER_OF_ACTORS;
//        echidnaProxies[actor].transferPrx(recipient, amount);
//    }
//
//    function approveExt(uint _i, address spender, uint256 amount) external returns (bool) {
//        uint actor = _i % NUMBER_OF_ACTORS;
//        echidnaProxies[actor].approvePrx(spender, amount);
//    }
//
//    function transferFromExt(uint _i, address sender, address recipient, uint256 amount) external returns (bool) {
//        uint actor = _i % NUMBER_OF_ACTORS;
//        echidnaProxies[actor].transferFromPrx(sender, recipient, amount);
//    }
//
//    function increaseAllowanceExt(uint _i, address spender, uint256 addedValue) external returns (bool) {
//        uint actor = _i % NUMBER_OF_ACTORS;
//        echidnaProxies[actor].increaseAllowancePrx(spender, addedValue);
//    }
//
//    function decreaseAllowanceExt(uint _i, address spender, uint256 subtractedValue) external returns (bool) {
//        uint actor = _i % NUMBER_OF_ACTORS;
//        echidnaProxies[actor].decreaseAllowancePrx(spender, subtractedValue);
//    }
//
//    // PriceFeed
//
//    function setPriceExt(uint256 _price) external {
//        bool result = priceFeedTestnet.setPrice(_price);
//        assert(result);
//    }
//
//    // --------------------------
//    // Invariants and properties
//    // --------------------------
//
//    function echidna_canary_number_of_troves() public view returns(bool) {
//        if (numberOfTroves > 20) {
//            return false;
//        }
//
//        return true;
//    }
//
//    function echidna_canary_active_pool_balance() public view returns(bool) {
//        if (address(activePool).balance != 0) {
//            return false;
//        }
//        return true;
//    }
//
//    function echidna_troves_order() external view returns(bool) {
//        address currentTrove = sortedTroves.getFirst();
//        address nextTrove = sortedTroves.getNext(currentTrove);
//
//        while (currentTrove != address(0) && nextTrove != address(0)) {
//            if (troveManager.getNominalICR(nextTrove) > troveManager.getNominalICR(currentTrove)) {
//                return false;
//            }
//            // Uncomment to check that the condition is meaningful
//            //else return false;
//
//            currentTrove = nextTrove;
//            nextTrove = sortedTroves.getNext(currentTrove);
//        }
//
//        return true;
//    }
//
//    /**
//     * Status
//     * Minimum debt (gas compensation)
//     * Stake != 0
//     */
//    function echidna_trove_properties() public view returns(bool) {
//        address currentTrove = sortedTroves.getFirst();
//        while (currentTrove != address(0)) {
//            // Status
//            if (TroveManager.Status(troveManager.getTroveStatus(currentTrove)) != TroveManager.Status.active) {
//                return false;
//            }
//            // Uncomment to check that the condition is meaningful
//            //else return false;
//
//            // Minimum debt (gas compensation)
//            if (troveManager.getTroveDebt(currentTrove) < YUSD_GAS_COMPENSATION) {
//                return false;
//            }
//            // Uncomment to check that the condition is meaningful
//            //else return false;
//
//            // Stake != 0
//            if (troveManager.getTroveStake(currentTrove) == 0) {
//                return false;
//            }
//            // Uncomment to check that the condition is meaningful
//            //else return false;
//
//            currentTrove = sortedTroves.getNext(currentTrove);
//        }
//        return true;
//    }
//
//    function echidna_ETH_balances() public view returns(bool) {
//        if (address(troveManager).balance != 0) {
//            return false;
//        }
//
//        if (address(borrowerOperations).balance != 0) {
//            return false;
//        }
//
//        if (address(activePool).balance != activePool.getCollateral(weth.address)) {
//            return false;
//        }
//
//        if (address(defaultPool).balance != defaultPool.getCollateral(weth.address)) {
//            return false;
//        }
//
//        if (address(stabilityPool).balance != stabilityPool.getETH()) {
//            return false;
//        }
//
//        if (address(yusdToken).balance != 0) {
//            return false;
//        }
//
//        if (address(priceFeedTestnet).balance != 0) {
//            return false;
//        }
//
//        if (address(sortedTroves).balance != 0) {
//            return false;
//        }
//
//        return true;
//    }
//
//    function echidna_price() public view returns(bool) {
//        uint price = priceFeedTestnet.getPrice();
//
//        if (price == 0) {
//            return false;
//        }
//        // Uncomment to check that the condition is meaningful
//        //else return false;
//
//        return true;
//    }
//
//    // Total YUSD matches
//    function echidna_YUSD_global_balances() public view returns(bool) {
//        uint totalSupply = yusdToken.totalSupply();
//        uint gasPoolBalance = yusdToken.balanceOf(address(gasPool));
//
//        uint activePoolBalance = activePool.getYUSDDebt();
//        uint defaultPoolBalance = defaultPool.getYUSDDebt();
//        if (totalSupply != activePoolBalance + defaultPoolBalance) {
//            return false;
//        }
//
//        uint stabilityPoolBalance = stabilityPool.getTotalYUSDDeposits();
//        address currentTrove = sortedTroves.getFirst();
//        uint trovesBalance;
//        while (currentTrove != address(0)) {
//            trovesBalance += yusdToken.balanceOf(address(currentTrove));
//            currentTrove = sortedTroves.getNext(currentTrove);
//        }
//        // we cannot state equality because tranfers are made to external addresses too
//        if (totalSupply <= stabilityPoolBalance + trovesBalance + gasPoolBalance) {
//            return false;
//        }
//
//        return true;
//    }

    /*
    function echidna_test() public view returns(bool) {
        return true;
    }
    */
}
