// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;
pragma abicoder v2;

import '../../roles/User.sol';
import '../../../SublimeProxy.sol';
import '../../../mocks/Paused.sol';
import '../../../mocks/MockVerification2.sol';
import '../../../mocks/MockV3Aggregator.sol';
import '../../../mocks/MockToken.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol'; // Required to check ERC20 balances of different actors

import '../../../PooledCreditLine/PooledCreditLine.sol';
import '../../../PooledCreditLine/LenderPool.sol';
import '../../../PriceOracle.sol';
import '../../../SavingsAccount/SavingsAccount.sol';
import './../../roles/Admin.sol';
import '../../../yield/StrategyRegistry.sol';
import '../../../yield/NoYield.sol';
import '../../../yield/CompoundYield.sol';
import '../../../mocks/MockWETH.sol';
import '../../../mocks/MockCToken.sol';
import '../../Constants.sol';

import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import '@openzeppelin/contracts-upgradeable/proxy/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC20/ERC20PausableUpgradeable.sol';

import '../../../interfaces/IPooledCreditLineDeclarations.sol';
import '../Roles/PCLAdmin.t.sol';
import '../Helpers/PCLConstants.t.sol';
import '../../../SublimeProxy.sol';
import 'forge-std/Test.sol';

contract PCLAdminUpdateTests is IPooledCreditLineDeclarations, Test {
    using SafeMath for uint256;
    using SafeMath for uint128;

    PriceOracle priceOracle;
    SavingsAccount savingsAccount;
    NoYield noYield;
    CompoundYield compoundYield;
    StrategyRegistry strategyRegistry;
    PooledCreditLine pooledCreditLine;
    LenderPool lenderPool;
    MockVerification2 verification;
    MockV3Aggregator aggregator1;
    MockV3Aggregator aggregator2;
    MockV3Aggregator aggregator3;
    MockToken collateralAsset;
    MockToken borrowAsset;
    MockToken USDC;
    MockWETH WETH;
    MockCToken cToken1;
    MockCToken cToken2;
    Paused pausedContract;
    PCLAdmin proxyAdmin;
    PCLAdmin admin;
    User user;
    User protocolFeeCollector;
    PCLUser pooledCreditLineBorrower;
    PCLUser pooledCreditLineLender_1;
    PCLUser pooledCreditLineLender_2;
    PCLUser pooledCreditLineLender_3;
    PCLUser pooledCreditLineLender_4;
    SublimeProxy sublimeProxyInstance;
    SublimeProxy priceOracleProxyInstance;
    SublimeProxy strategyRegistryProxyInstance;
    SublimeProxy compoundYieldProxyInstance;
    SublimeProxy pooledCreditLineProxyInstance;
    SublimeProxy lenderPoolProxyInstance;
    uint256 pooledCreditLineID;
    PooledCreditLineStatus status;
    uint256 lendAmount;
    uint256 minimumCollateralRequired;
    uint256 collateralToDeposit;
    uint256 borrowableAmount;
    uint256 amountToBorrow;
    uint256 protocolFeeFraction;
    uint256 protocolFee_1;
    uint256 protocolFee_2;
    uint256 protocolFeeCollectorBalance_1;
    uint256 protocolFeeCollectorBalance_2;
    address protocolFeeCollectorNew;
    IPooledCreditLineDeclarations.Request request;

    address pooledCreditLineAddress;
    address lenderPoolAddress;

    function setUp() public {
        // This is for the price oracle to get a non-zero timestamp
        vm.warp(block.timestamp + 10);

        proxyAdmin = new PCLAdmin(pooledCreditLineAddress, lenderPoolAddress);
        admin = new PCLAdmin(pooledCreditLineAddress, lenderPoolAddress);
        user = new User();
        protocolFeeCollector = new User();
        pausedContract = new Paused();

        collateralAsset = new MockToken('MockToken1', 'MT1', 18, 10e40, address(admin));
        borrowAsset = new MockToken('MockToken2', 'MT2', 18, 10e40, address(admin));
        USDC = new MockToken('MockUSDC', 'USDC', 6, 10e20, address(admin));
        WETH = new MockWETH();

        verification = new MockVerification2();
        aggregator1 = new MockV3Aggregator(18, 12876423400040030304304);
        aggregator2 = new MockV3Aggregator(8, 92392394976);
        aggregator3 = new MockV3Aggregator(6, 1000000);

        bytes4 functionSig;
        address sublimeProxy;
        bytes memory emptyBytes;

        PriceOracle _priceOracleImplementation = new PriceOracle(Constants.CHAINLINK_HEARTBEAT);
        priceOracleProxyInstance = new SublimeProxy(address(_priceOracleImplementation), address(proxyAdmin), emptyBytes);
        sublimeProxy = address(priceOracleProxyInstance);
        priceOracle = PriceOracle(payable(sublimeProxy));
        functionSig = admin.getFunctionSignature('initialize(address,uint32)');
        admin.execute(
            address(priceOracle),
            0,
            abi.encodePacked(functionSig, abi.encode(address(admin), address(WETH), PCLConstants.uniswapPriceAveragingPeriod))
        );

        StrategyRegistry _strategyRegistry = new StrategyRegistry();
        strategyRegistryProxyInstance = new SublimeProxy(address(_strategyRegistry), address(proxyAdmin), emptyBytes);
        sublimeProxy = address(strategyRegistryProxyInstance);
        strategyRegistry = StrategyRegistry(sublimeProxy);
        functionSig = admin.getFunctionSignature('initialize(address,uint256)');
        admin.execute(address(strategyRegistry), 0, abi.encodePacked(functionSig, abi.encode(address(admin), 10)));

        SavingsAccount _savingsAccount = new SavingsAccount(address(strategyRegistry));
        sublimeProxyInstance = new SublimeProxy(address(_savingsAccount), address(proxyAdmin), emptyBytes);
        sublimeProxy = address(sublimeProxyInstance);
        savingsAccount = SavingsAccount(sublimeProxy);
        functionSig = admin.getFunctionSignature('initialize(address)');
        admin.execute(address(savingsAccount), 0, abi.encodePacked(functionSig, abi.encode(address(admin))));

        NoYield _noYield = new NoYield(Constants._treasuryAddress, address(savingsAccount));
        sublimeProxy = address(new SublimeProxy(address(_noYield), address(proxyAdmin), emptyBytes));
        noYield = NoYield(sublimeProxy);
        functionSig = admin.getFunctionSignature('initialize(address)');
        admin.execute(address(noYield), 0, abi.encodePacked(functionSig, abi.encode(address(admin))));

        CompoundYield _compoundYield = new CompoundYield(address(WETH), Constants._treasuryAddress, address(savingsAccount));
        compoundYieldProxyInstance = new SublimeProxy(address(_compoundYield), address(proxyAdmin), emptyBytes);
        sublimeProxy = address(compoundYieldProxyInstance);
        compoundYield = CompoundYield(payable(sublimeProxy));
        functionSig = admin.getFunctionSignature('initialize(address)');
        admin.execute(address(compoundYield), 0, abi.encodePacked(functionSig, abi.encode(address(admin))));

        cToken1 = new MockCToken(address(collateralAsset));
        admin.forceUpdateTokenAddressForCompoundYield(address(compoundYield), address(collateralAsset), address(cToken1));
        admin.setDepositLimitForCompoundYield(address(compoundYield), address(collateralAsset), type(uint256).max);
        admin.transferOwnership(address(collateralAsset), address(cToken1));

        cToken2 = new MockCToken(address(borrowAsset));
        admin.forceUpdateTokenAddressForCompoundYield(address(compoundYield), address(borrowAsset), address(cToken2));
        admin.setDepositLimitForCompoundYield(address(compoundYield), address(borrowAsset), type(uint256).max);
        admin.transferOwnership(address(borrowAsset), address(cToken2));

        functionSig = admin.getFunctionSignature('addStrategy(address)');
        admin.execute(address(strategyRegistry), 0, abi.encodePacked(functionSig, abi.encode(address(noYield), 1782)));

        // Adding compoundYield to the strategy
        functionSig = admin.getFunctionSignature('addStrategy(address)');
        admin.execute(address(strategyRegistry), 0, abi.encodePacked(functionSig, abi.encode(address(compoundYield), 1782)));

        LimitsManager _limitsManager;
        {
            LimitsManager _limitsManagerImpl = new LimitsManager(address(USDC), address(priceOracle));
            sublimeProxy = address(new SublimeProxy(address(_limitsManagerImpl), address(proxyAdmin), emptyBytes));
            _limitsManager = LimitsManager(sublimeProxy);
            functionSig = admin.getFunctionSignature('initialize(address)');
            admin.execute(address(_limitsManager), 0, abi.encodePacked(functionSig, abi.encode(address(admin))));
        }

        lenderPoolProxyInstance = new SublimeProxy(address(strategyRegistry), address(proxyAdmin), emptyBytes);
        address lenderPoolProxyAddress = address(lenderPoolProxyInstance); // use any address and latter change to, here used strategyRegistry
        PooledCreditLine _pooledCreditLine = new PooledCreditLine(
            lenderPoolProxyAddress,
            address(priceOracle),
            address(savingsAccount),
            address(strategyRegistry),
            address(verification),
            address(_limitsManager),
            1e18 / 10
        );
        pooledCreditLineProxyInstance = new SublimeProxy(address(_pooledCreditLine), address(proxyAdmin), emptyBytes);
        sublimeProxy = address(pooledCreditLineProxyInstance);
        pooledCreditLine = PooledCreditLine(sublimeProxy);

        LenderPool _lenderPool = new LenderPool(address(pooledCreditLine), address(savingsAccount), address(verification));
        lenderPool = LenderPool(lenderPoolProxyAddress);
        proxyAdmin.changeImplementationAddressOfProxy(address(lenderPool), address(_lenderPool));
        functionSig = admin.getFunctionSignature('initialize()');
        admin.execute(address(lenderPool), 0, abi.encodePacked(functionSig));

        functionSig = admin.getFunctionSignature('initialize(address,uint256,address)');
        admin.execute(
            address(pooledCreditLine),
            0,
            abi.encodePacked(functionSig, abi.encode(address(admin), 10e16, address(protocolFeeCollector)))
        );

        pooledCreditLineAddress = address(pooledCreditLine);
        lenderPoolAddress = address(lenderPool);

        pooledCreditLineBorrower = new PCLUser(pooledCreditLineAddress, lenderPoolAddress);
        pooledCreditLineLender_1 = new PCLUser(pooledCreditLineAddress, lenderPoolAddress);
        pooledCreditLineLender_2 = new PCLUser(pooledCreditLineAddress, lenderPoolAddress);
        pooledCreditLineLender_3 = new PCLUser(pooledCreditLineAddress, lenderPoolAddress);
        pooledCreditLineLender_4 = new PCLUser(pooledCreditLineAddress, lenderPoolAddress);

        admin.setChainlinkFeedAddress(address(priceOracle), address(collateralAsset), address(aggregator1), Constants.CHAINLINK_HEARTBEAT);
        admin.setChainlinkFeedAddress(address(priceOracle), address(borrowAsset), address(aggregator2), Constants.CHAINLINK_HEARTBEAT);
        admin.setChainlinkFeedAddress(address(priceOracle), address(USDC), address(aggregator3), Constants.CHAINLINK_HEARTBEAT);

        // Adding the verifiers to the verifiers mapping
        verification.whitelistVerifier(PCLConstants._borrowerVerifier);
        verification.whitelistVerifier(PCLConstants._lenderVerifier);

        // Verifying the users
        verification.verifyUser(address(pooledCreditLineBorrower), address(PCLConstants._borrowerVerifier));
        verification.verifyUser(address(pooledCreditLineLender_1), address(PCLConstants._lenderVerifier));
        verification.verifyUser(address(pooledCreditLineLender_2), address(PCLConstants._lenderVerifier));
        verification.verifyUser(address(pooledCreditLineLender_3), address(PCLConstants._lenderVerifier));
        verification.verifyUser(address(pooledCreditLineLender_4), address(PCLConstants._lenderVerifier));

        admin.updateLP(lenderPoolAddress);
        admin.updatePCL(pooledCreditLineAddress);

        // Setting limits for the pooledCreditLine
        admin.updateBorrowRateLimits(PCLConstants.minBorrowRate, PCLConstants.maxBorrowRate);
        admin.updateBorrowLimitLimits(PCLConstants.minBorrowLimit, PCLConstants.maxBorrowLimit);

        admin.updateIdealCollateralRatioLimits(PCLConstants.minCollateralRatio, PCLConstants.maxCollateralRatio);

        admin.updateCollectionPeriodLimits(PCLConstants.minCollectionPeriod, PCLConstants.maxCollectionPeriod);

        admin.updateDurationLimits(PCLConstants.minDuration, PCLConstants.maxDuration);

        admin.updateDefaultGracePeriodLimits(PCLConstants.minDefaultGraceDuration, PCLConstants.maxDefaultGraceDuration);

        admin.updateGracePenaltyRateLimits(PCLConstants.minGracePenaltyRate, PCLConstants.maxGracePenaltyRate);

        // Setting up the request parameteres for creating a PCL
        request.borrowLimit = uint128(1_000_000 * 1e18);
        request.borrowRate = uint128((5 * 1e18) / 1e2);
        request.collateralRatio = 1e18;
        request.borrowAsset = address(borrowAsset);
        request.collateralAsset = address(collateralAsset);
        request.duration = 100 days;
        request.lenderVerifier = address(PCLConstants._lenderVerifier);
        request.defaultGracePeriod = 1 days;
        request.gracePenaltyRate = (10 * 1e18) / 1e2;
        request.collectionPeriod = 5 days;
        request.minBorrowAmount = 90_000 * 1e18;
        request.borrowAssetStrategy = address(compoundYield);
        request.collateralAssetStrategy = address(compoundYield);
        request.borrowerVerifier = address(PCLConstants._borrowerVerifier);
        request.areTokensTransferable = true;
    }

    // Test1: Admin increases ideal collateral ratio limits
    function test_increaseCollateralRatioLimit() public {
        request.collateralRatio = PCLConstants.maxCollateralRatio.mul(100);
        try pooledCreditLineBorrower.createRequest(request) {
            revert('Borrower cannot increase collateral ratio limit');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:R8');
        }

        admin.updateIdealCollateralRatioLimits(PCLConstants.minCollateralRatio, PCLConstants.maxCollateralRatio.mul(100));
        pooledCreditLineID = pooledCreditLineBorrower.createRequest(request);
        status = pooledCreditLine.getStatusAndUpdate(pooledCreditLineID);
        assertTrue(status == PooledCreditLineStatus.REQUESTED);
    }

    // Test2: Admin decreases the ideal collateral ratio limit
    function test_decreaseCollateralRatioLimit() public {
        request.collateralRatio = PCLConstants.minCollateralRatio.div(100);
        try pooledCreditLineBorrower.createRequest(request) {
            revert('Borrower cannot change the collateral ratio limit ');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:R8');
        }

        admin.updateIdealCollateralRatioLimits(PCLConstants.minCollateralRatio.div(100), PCLConstants.maxCollateralRatio);

        pooledCreditLineID = pooledCreditLineBorrower.createRequest(request);
        status = pooledCreditLine.getStatusAndUpdate(pooledCreditLineID);
        assertTrue(status == PooledCreditLineStatus.REQUESTED);
    }

    // Test3: Increase borrow Rate Limits
    function test_increaseBorrowRateLimit() public {
        request.borrowRate = uint128(PCLConstants.maxBorrowRate.mul(100));
        try pooledCreditLineBorrower.createRequest(request) {
            revert('Borrower cannot change the Borrow Rate Limits');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:R7');
        }

        admin.updateBorrowRateLimits(PCLConstants.minBorrowRate, PCLConstants.maxBorrowRate.mul(100));
        pooledCreditLineID = pooledCreditLineBorrower.createRequest(request);
        status = pooledCreditLine.getStatusAndUpdate(pooledCreditLineID);
        assertTrue(status == PooledCreditLineStatus.REQUESTED);
    }

    // Test4: Decrease borrow rate limits
    function test_decreaseBorrowRateLimit() public {
        request.borrowRate = uint128(PCLConstants.minBorrowRate.div(100));
        try pooledCreditLineBorrower.createRequest(request) {
            revert('Borrower cannot change the Borrow Rate Limits');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:R7');
        }

        admin.updateBorrowRateLimits(PCLConstants.minBorrowRate.div(100), PCLConstants.maxBorrowRate);
        pooledCreditLineID = pooledCreditLineBorrower.createRequest(request);
        status = pooledCreditLine.getStatusAndUpdate(pooledCreditLineID);
        assertTrue(status == PooledCreditLineStatus.REQUESTED);
    }

    // Test5: Increase collection Limits
    function test_increaseCollectionPeriodLimit() public {
        request.collectionPeriod = PCLConstants.maxCollectionPeriod.mul(10);
        try pooledCreditLineBorrower.createRequest(request) {
            revert('Borrower cannot change the Collection Period Limits');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:R9');
        }

        admin.updateCollectionPeriodLimits(PCLConstants.minCollectionPeriod, PCLConstants.maxCollectionPeriod.mul(10));
        pooledCreditLineID = pooledCreditLineBorrower.createRequest(request);
        status = pooledCreditLine.getStatusAndUpdate(pooledCreditLineID);
        assertTrue(status == PooledCreditLineStatus.REQUESTED);
    }

    // Test6: Decrease collection Limits
    function test_decreaseCollectionPeriodLimit() public {
        request.collectionPeriod = PCLConstants.minCollectionPeriod.div(10);
        try pooledCreditLineBorrower.createRequest(request) {
            revert('Borrower cannot change the Borrow Rate Limits');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:R9');
        }

        admin.updateCollectionPeriodLimits(PCLConstants.minCollectionPeriod.div(10), PCLConstants.maxCollectionPeriod);
        pooledCreditLineID = pooledCreditLineBorrower.createRequest(request);
        status = pooledCreditLine.getStatusAndUpdate(pooledCreditLineID);
        assertTrue(status == PooledCreditLineStatus.REQUESTED);
    }

    // Test7: Decrease duration Limits
    function test_decreaseDurationLimits() public {
        request.duration = PCLConstants.minDuration.div(100);
        try pooledCreditLineBorrower.createRequest(request) {
            revert('Borrower cannot change the Duration Limits');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:R10');
        }
        admin.updateDurationLimits(PCLConstants.minDuration.div(100), PCLConstants.maxDuration);
        pooledCreditLineID = pooledCreditLineBorrower.createRequest(request);
        status = pooledCreditLine.getStatusAndUpdate(pooledCreditLineID);
        assertTrue(status == PooledCreditLineStatus.REQUESTED);
    }

    // Test8: Increase duration Limits
    function test_increaseDurationLimits() public {
        request.duration = PCLConstants.maxDuration.mul(100);
        try pooledCreditLineBorrower.createRequest(request) {
            revert('Borrower should not be able to change duration limits');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:R10');
        }
        admin.updateDurationLimits(PCLConstants.minDuration, PCLConstants.maxDuration.mul(100));
        pooledCreditLineID = pooledCreditLineBorrower.createRequest(request);
        status = pooledCreditLine.getStatusAndUpdate(pooledCreditLineID);
        assertTrue(status == PooledCreditLineStatus.REQUESTED);
    }

    // Test9: Increase Default Grace Period Limits
    function test_increaseDefaultGracePeriodLimits() public {
        request.defaultGracePeriod = PCLConstants.maxDefaultGraceDuration.mul(100);
        try pooledCreditLineBorrower.createRequest(request) {
            revert('Borrower cannot change default grace period limits');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:R11');
        }
        admin.updateDefaultGracePeriodLimits(PCLConstants.minDefaultGraceDuration, PCLConstants.maxDefaultGraceDuration.mul(100));
        pooledCreditLineID = pooledCreditLineBorrower.createRequest(request);
        status = pooledCreditLine.getStatusAndUpdate(pooledCreditLineID);
        assertTrue(status == PooledCreditLineStatus.REQUESTED);
    }

    // Test10: Decrease Default Grace Period Limits
    function test_decreaseDefaultGracePeriodLimits() public {
        request.defaultGracePeriod = PCLConstants.minDefaultGraceDuration.div(100);
        try pooledCreditLineBorrower.createRequest(request) {
            revert('Borrower cannot change default grace period limits');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:R11');
        }
        admin.updateDefaultGracePeriodLimits(PCLConstants.minDefaultGraceDuration.div(100), PCLConstants.maxDefaultGraceDuration);
        pooledCreditLineID = pooledCreditLineBorrower.createRequest(request);
        status = pooledCreditLine.getStatusAndUpdate(pooledCreditLineID);
        assertTrue(status == PooledCreditLineStatus.REQUESTED);
    }

    // Test11 Increase Grace Penalty Rate Limits
    function test_increaseGracePenaltyRateLimits() public {
        request.gracePenaltyRate = PCLConstants.maxGracePenaltyRate.mul(100);
        try pooledCreditLineBorrower.createRequest(request) {
            revert('Borrower cannot change grace penalty rates');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:R12');
        }
        admin.updateGracePenaltyRateLimits(PCLConstants.minGracePenaltyRate, PCLConstants.maxGracePenaltyRate.mul(100));
        pooledCreditLineID = pooledCreditLineBorrower.createRequest(request);
        status = pooledCreditLine.getStatusAndUpdate(pooledCreditLineID);
        assertTrue(status == PooledCreditLineStatus.REQUESTED);
    }

    // Test12 Decrease Grace Penalty Rate Limits
    function test_decreaseGracePenaltyRateLimits() public {
        request.gracePenaltyRate = PCLConstants.minGracePenaltyRate.div(100);
        try pooledCreditLineBorrower.createRequest(request) {
            revert('Borrower cannot change grace penalty rate');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:R12');
        }

        admin.updateGracePenaltyRateLimits(PCLConstants.minGracePenaltyRate.div(100), PCLConstants.maxGracePenaltyRate);
        pooledCreditLineID = pooledCreditLineBorrower.createRequest(request);
        status = pooledCreditLine.getStatusAndUpdate(pooledCreditLineID);
        assertTrue(status == PooledCreditLineStatus.REQUESTED);
    }

    function test_cannotUpdateBorrowLimitLimitsWithMinMoreThanMax() public {
        try admin.updateBorrowLimitLimits(PCLConstants.maxBorrowLimit, PCLConstants.minBorrowLimit) {
            revert('Admin cannot decrease the borrow limit less than minimum');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:UBLL1');
        }
    }

    function test_cannotUpdateBorrowLimitLimitsSameAsPrevious() public {
        try admin.updateBorrowLimitLimits(PCLConstants.minBorrowLimit, PCLConstants.maxBorrowLimit) {
            revert('Admin cannot increase the borrow limit more than maximum');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:UBLL2');
        }
    }

    function test_cannotUpdateIdealCollateralRatioLimitsWithMinMoreThanMax() public {
        try admin.updateIdealCollateralRatioLimits(PCLConstants.maxCollateralRatio, PCLConstants.minCollateralRatio) {
            revert('Admin cannot set minimum ideal collateral ratio more than the max permissible');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:UICRL1');
        }
    }

    function test_cannotUpdateIdealCollateralRatioLimitsSameAsPrevious() public {
        try admin.updateIdealCollateralRatioLimits(PCLConstants.minCollateralRatio, PCLConstants.maxCollateralRatio) {
            revert('Admin cannot update ideal collateral ratio limits same as previous');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:UICRL2');
        }
    }

    function test_cannotUpdateBorrowRateLimitsWithMinMoreThanMax() public {
        try admin.updateBorrowRateLimits(PCLConstants.maxBorrowRate, PCLConstants.minBorrowRate) {
            revert('Cannot update borrow rate limits as min more than max');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:UBRL1');
        }
    }

    function test_cannotUpdateBorrowRateLimitsSameAsPrevious() public {
        try admin.updateBorrowRateLimits(PCLConstants.minBorrowRate, PCLConstants.maxBorrowRate) {
            revert(' ');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:UBRL2');
        }
    }

    function test_cannotUpdateCollectionPeriodLimitsWithMinMoreThanMax() public {
        try admin.updateCollectionPeriodLimits(PCLConstants.maxCollectionPeriod, PCLConstants.minCollectionPeriod) {
            revert('Cannot set the min collection period as more than the max permissible');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:UCPL1');
        }
    }

    function test_cannotUpdateCollectionPeriodLimitsSameAsPrevious() public {
        try admin.updateCollectionPeriodLimits(PCLConstants.minCollectionPeriod, PCLConstants.maxCollectionPeriod) {
            revert(' Admin cannot set the collection period the same as current value');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:UCPL2');
        }
    }

    function test_cannotUpdateDurationLimitsWithMinMoreThanMax() public {
        try admin.updateDurationLimits(PCLConstants.maxDuration, PCLConstants.minDuration) {
            revert('Cannot set min duration more than the max permissible');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:UDL1');
        }
    }

    function test_cannotUpdateDurationLimitsSameAsPrevious() public {
        try admin.updateDurationLimits(PCLConstants.minDuration, PCLConstants.maxDuration) {
            revert('Admin cannot set the duration limits the same as current values');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:UDL2');
        }
    }

    function test_cannotUpdateDefaultGracePeriodLimitsWithMinMoreThanMax() public {
        try admin.updateDefaultGracePeriodLimits(PCLConstants.maxDefaultGraceDuration, PCLConstants.minDefaultGraceDuration) {
            revert('Cannot set min default grace period more than the max permissible');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:UDGPL1');
        }
    }

    function test_cannotUpdateDefaultGracePeriodLimitsSameAsPrevious() public {
        try admin.updateDefaultGracePeriodLimits(PCLConstants.minDefaultGraceDuration, PCLConstants.maxDefaultGraceDuration) {
            revert('Admin cannot set the default grace period limits the same as current values');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:UDGPL2');
        }
    }

    function test_cannotUpdateGracePenaltyRateLimitsWithMinMoreThanMax() public {
        try admin.updateGracePenaltyRateLimits(PCLConstants.maxGracePenaltyRate, PCLConstants.minGracePenaltyRate) {
            revert('Admin cannot set minimum grace penalty rate limit than the max permissible');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:UGPRL1');
        }
    }

    function test_cannotUpdateGracePenaltyRateLimitsSameAsPrevious() public {
        try admin.updateGracePenaltyRateLimits(PCLConstants.minGracePenaltyRate, PCLConstants.maxGracePenaltyRate) {
            revert('Cannot update the protocol fee fraction to be lower than min');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:UGPRL2');
        }
    }

    function test_cannotUpdateProtocolFeeFractionMoreThanMax() public {
        try admin.updateProtocolFeeFraction(PCLConstants.protocolFeeFraction + 1) {
            revert('Cannot update the protocol fee fraction to be higher than max');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:IUPFF1');
        }
    }

    function test_cannotUpdateProtocolFeeFractionSameAsPrevious() public {
        try admin.updateProtocolFeeFraction(PCLConstants.protocolFeeFraction) {
            revert('Cannot update the protocol fee fraction the same as before');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:UPFF1');
        }
    }

    function test_cannotUpdateProtocolFeeCollectorWithZeroAddress() public {
        try admin.updateProtocolFeeCollector(address(0)) {
            revert('Cannot set the protocolFeeCollector as address(0)');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:IUPFC1');
        }
    }

    function test_cannotUpdateProtocolFeeCollectorSameAsPrevious() public {
        try admin.updateProtocolFeeCollector(address(protocolFeeCollector)) {
            revert('Cannot update the protocolFeeCollector address same as before');
        } catch Error(string memory reason) {
            assertEq(reason, 'PCL:UPFC1');
        }
    }

    // Test15: Change the protocol fee collector address in the middle of a working PCL
    function test_changeProtocolFeeCollectorAddress() public {
        address protocolFeeCollectorOld = pooledCreditLine.protocolFeeCollector();

        pooledCreditLineID = pooledCreditLineBorrower.createRequest(request);
        status = pooledCreditLine.getStatusAndUpdate(pooledCreditLineID);
        assertTrue(status == PooledCreditLineStatus.REQUESTED); //Status should change to REQUESTED

        // Transferring borrow tokens to the lender
        lendAmount = request.borrowLimit;
        admin.transferToken(address(borrowAsset), address(pooledCreditLineLender_1), lendAmount);
        pooledCreditLineLender_1.setAllowance(address(lenderPool), address(borrowAsset), type(uint256).max);
        pooledCreditLineLender_1.lend(pooledCreditLineID, lendAmount);

        // Calculating the number of collateral tokens required to match and go above the ideal collateral ratio
        minimumCollateralRequired = pooledCreditLineBorrower.getRequiredCollateral(pooledCreditLineID, lendAmount);

        // Transferring collateral tokens to the borrower
        collateralToDeposit = minimumCollateralRequired.mul(2);
        admin.transferToken(address(collateralAsset), address(pooledCreditLineBorrower), collateralToDeposit);
        pooledCreditLineBorrower.setAllowance(address(pooledCreditLine), address(collateralAsset), type(uint256).max);

        // Since borrow can only be done after the collection period,
        vm.warp(block.timestamp + request.collectionPeriod);
        pooledCreditLineBorrower.start(pooledCreditLineID);

        // We want to deposit collateral now
        pooledCreditLineBorrower.depositCollateral(pooledCreditLineID, collateralToDeposit, false);

        // Calculating the borrowable amount:
        borrowableAmount = pooledCreditLineBorrower.calculateBorrowableAmount(pooledCreditLineID);
        amountToBorrow = borrowableAmount.div(4);

        //Trying to borrow the borrowable amount:
        pooledCreditLineBorrower.borrow(pooledCreditLineID, amountToBorrow);

        // Calculating the protocolFee on amountToBorrow
        protocolFeeFraction = pooledCreditLine.protocolFeeFraction();
        protocolFee_1 = (amountToBorrow.mul(protocolFeeFraction)).div(1e18);

        // Asserting that protocolFeeCollector got the correct amount of fee
        protocolFeeCollectorBalance_1 = IERC20(address(borrowAsset)).balanceOf(address(protocolFeeCollector));
        assertApproxEqAbs(protocolFee_1, protocolFeeCollectorBalance_1, 2);

        // Update the address of protocolFeeCollector
        admin.updateProtocolFeeCollector(address(pooledCreditLineLender_3));
        protocolFeeCollectorNew = pooledCreditLine.protocolFeeCollector();

        // Assert that the protocolFeeCollector address indeed got updated.
        assertEq(protocolFeeCollectorNew, address(pooledCreditLineLender_3));
        assertTrue(protocolFeeCollectorOld != protocolFeeCollectorNew);

        // Finding the initial balance of the new protocolFeeCollector before second withdrawal
        uint256 protocolFeeCollectorBalance_2Initial = IERC20(address(borrowAsset)).balanceOf(protocolFeeCollectorNew);
        log_uint(protocolFeeCollectorBalance_2Initial);

        // Borrowing some more money so that the protocol fee gets deducted
        amountToBorrow = borrowableAmount.div(2);
        pooledCreditLineBorrower.borrow(pooledCreditLineID, amountToBorrow);

        // Balance of protocolFeeCollector after the second withdrawal
        uint256 protocolFeeCollectorBalance_2Final = IERC20(address(borrowAsset)).balanceOf(protocolFeeCollectorNew);

        // Since the protocolFeeCollector address has changed, now their balance should be equal to the newly calculated protocolFee
        protocolFee_2 = (amountToBorrow.mul(protocolFeeFraction)).div(1e18);
        protocolFeeCollectorBalance_2 = protocolFeeCollectorBalance_2Final.sub(protocolFeeCollectorBalance_2Initial);
        assertApproxEqAbs(protocolFee_2, protocolFeeCollectorBalance_2, 2);
        assertApproxEqAbs(protocolFeeCollectorBalance_1, IERC20(address(borrowAsset)).balanceOf(address(protocolFeeCollectorOld)), 2);
    }

    // Test16: Change the protocolFeeFraction
    function test_changeProtocolFeeFraction() public {
        uint256 protocolFeeFractionOld = pooledCreditLine.protocolFeeFraction();

        pooledCreditLineID = pooledCreditLineBorrower.createRequest(request);

        status = pooledCreditLine.getStatusAndUpdate(pooledCreditLineID);
        assertTrue(status == PooledCreditLineStatus.REQUESTED); //Status should change to REQUESTED

        // Transferring borrow tokens to the lender
        lendAmount = request.borrowLimit;
        admin.transferToken(address(borrowAsset), address(pooledCreditLineLender_1), lendAmount);
        pooledCreditLineLender_1.setAllowance(address(lenderPool), address(borrowAsset), type(uint256).max);
        pooledCreditLineLender_1.lend(pooledCreditLineID, lendAmount);

        // Calculating the number of collateral tokens required to match and go above the ideal collateral ratio
        minimumCollateralRequired = pooledCreditLineBorrower.getRequiredCollateral(pooledCreditLineID, lendAmount);

        // Transferring collateral tokens to the borrower
        collateralToDeposit = minimumCollateralRequired.mul(2);
        admin.transferToken(address(collateralAsset), address(pooledCreditLineBorrower), collateralToDeposit);
        pooledCreditLineBorrower.setAllowance(address(pooledCreditLine), address(collateralAsset), type(uint256).max);

        // Since borrow can only be done after the collection period,
        vm.warp(block.timestamp + request.collectionPeriod);
        pooledCreditLineBorrower.start(pooledCreditLineID);

        // We want to deposit collateral now
        pooledCreditLineBorrower.depositCollateral(pooledCreditLineID, collateralToDeposit, false);

        // Calculating the borrowable amount:
        borrowableAmount = pooledCreditLineBorrower.calculateBorrowableAmount(pooledCreditLineID);
        amountToBorrow = borrowableAmount.div(2);

        //Trying to borrow half the borrowable amount:
        pooledCreditLineBorrower.borrow(pooledCreditLineID, amountToBorrow);

        // Calculating the protocol fee on the amountToBorrow
        protocolFeeFraction = pooledCreditLine.protocolFeeFraction();
        protocolFee_1 = (amountToBorrow.mul(protocolFeeFraction)).div(1e18);
        uint256 protocolFeeCollectorBalanceInitial = IERC20(address(borrowAsset)).balanceOf(address(protocolFeeCollector));

        // Update the protocolFeeFraction
        admin.updateProtocolFeeFraction(1e16);
        uint256 protocolFeeFractionNew = pooledCreditLine.protocolFeeFraction();

        // Now the borrowable amount should be equal to the earlier amountToBorrow
        borrowableAmount = pooledCreditLineBorrower.calculateBorrowableAmount(pooledCreditLineID);
        assertApproxEqAbs(borrowableAmount, amountToBorrow, 2);

        //Trying to borrow the borrowable amount:
        pooledCreditLineBorrower.borrow(pooledCreditLineID, amountToBorrow);

        // Calculating the protocol fee after the second borrow
        protocolFee_2 = (amountToBorrow.mul(protocolFeeFractionNew)).div(1e18);
        uint256 protocolFeeCollectorBalanceFinal = IERC20(address(borrowAsset)).balanceOf(address(protocolFeeCollector));
        uint256 protocolFeeCollectorBalanceAfter2ndBorrow = protocolFeeCollectorBalanceFinal.sub(protocolFeeCollectorBalanceInitial);

        // Asserting that the protocol fee for both borrowals was different even though the amount was same
        assertTrue(!(protocolFeeCollectorBalanceInitial == protocolFeeCollectorBalanceAfter2ndBorrow));
        assertEq(protocolFeeFractionNew, 1e16);
        assertTrue(protocolFeeFractionOld != protocolFeeFractionNew);
    }

    // Test18: Test the pause and upgrade functionality as the admin
    function test_pauseAndUpgradeContractsWhenSomethingBadHappens() public {
        pooledCreditLineID = pooledCreditLineBorrower.createRequest(request);

        status = pooledCreditLine.getStatusAndUpdate(pooledCreditLineID);
        assertTrue(status == PooledCreditLineStatus.REQUESTED); //Status should change to REQUESTED

        // Transferring borrow tokens to the lender
        lendAmount = request.borrowLimit;
        admin.transferToken(address(borrowAsset), address(pooledCreditLineLender_1), lendAmount);
        pooledCreditLineLender_1.setAllowance(address(lenderPool), address(borrowAsset), type(uint256).max);
        pooledCreditLineLender_1.lend(pooledCreditLineID, lendAmount);

        // Calculating the number of collateral tokens required to match and go above the ideal collateral ratio
        minimumCollateralRequired = pooledCreditLineBorrower.getRequiredCollateral(pooledCreditLineID, lendAmount);

        // Transferring collateral tokens to the borrower
        collateralToDeposit = minimumCollateralRequired.mul(2);
        admin.transferToken(address(collateralAsset), address(pooledCreditLineBorrower), collateralToDeposit);
        pooledCreditLineBorrower.setAllowance(address(pooledCreditLine), address(collateralAsset), type(uint256).max);

        // Since borrow can only be done after the collection period,
        vm.warp(block.timestamp + request.collectionPeriod);
        pooledCreditLineBorrower.start(pooledCreditLineID);

        // We want to deposit collateral now
        pooledCreditLineBorrower.depositCollateral(pooledCreditLineID, collateralToDeposit, false);

        // Calculating the borrowable amount:
        borrowableAmount = pooledCreditLineBorrower.calculateBorrowableAmount(pooledCreditLineID);
        amountToBorrow = borrowableAmount.div(4);

        //Trying to borrow the borrowable amount:
        pooledCreditLineBorrower.borrow(pooledCreditLineID, amountToBorrow);

        // Something went terribly wrong and noew we want to pause all interactions with the savings account.
        // Setting the new savings account address to address(0) or 0xffff....ff doesn't work. This error is thrown:
        // Revert ("UpgradeableProxy: new implementation is not a contract"
        log_address(address(pausedContract));

        address pcl_savingsAccount_old = address(pooledCreditLine.SAVINGS_ACCOUNT());
        address savingsAccount_impl = proxyAdmin.getImplementationAddressOfProxy(sublimeProxyInstance);
        log_named_address('Old Savings Account', savingsAccount_impl);

        proxyAdmin.changeImplementationAddressOfProxy(address(sublimeProxyInstance), address(pausedContract));

        address pausedContractAddress = proxyAdmin.getImplementationAddressOfProxy(sublimeProxyInstance);
        log_named_address('Paused Contract Address', pausedContractAddress);
        address pcl_savingsAccount_new = address(pooledCreditLine.SAVINGS_ACCOUNT());

        // assert that the savings account address for the pcl should not change
        assertEq(pcl_savingsAccount_new, pcl_savingsAccount_old);

        // Assert that the implementation addresses of the savings account changed to a paused contract
        assertTrue(savingsAccount_impl != pausedContractAddress);

        // Now that the savingsAccount is paused, let's change the proxyImplementation to a patched savingsAccount
        SavingsAccount patchedSavingsAccount = new SavingsAccount(address(strategyRegistry));
        proxyAdmin.changeImplementationAddressOfProxy(address(sublimeProxyInstance), address(patchedSavingsAccount));

        // Now comparing the address of the patchedSavingsAccount with pausedContract
        address patchedSavingsAccountAddress = proxyAdmin.getImplementationAddressOfProxy(sublimeProxyInstance);
        log_named_address('New Saving Account', patchedSavingsAccountAddress);

        assertTrue(patchedSavingsAccountAddress != pausedContractAddress);
    }

    // Test19: Test the pause functionality as the admin
    function testFail_stopSavingsAccountInteraction() public {
        pooledCreditLineID = pooledCreditLineBorrower.createRequest(request);

        status = pooledCreditLine.getStatusAndUpdate(pooledCreditLineID);
        assertTrue(status == PooledCreditLineStatus.REQUESTED); //Status should change to REQUESTED

        // Transferring borrow tokens to the lender
        lendAmount = request.borrowLimit;
        admin.transferToken(address(borrowAsset), address(pooledCreditLineLender_1), lendAmount);
        pooledCreditLineLender_1.setAllowance(address(lenderPool), address(borrowAsset), type(uint256).max);
        pooledCreditLineLender_1.lend(pooledCreditLineID, lendAmount);

        // Calculating the number of collateral tokens required to match and go above the ideal collateral ratio
        minimumCollateralRequired = pooledCreditLineBorrower.getRequiredCollateral(pooledCreditLineID, lendAmount);

        // Transferring collateral tokens to the borrower
        collateralToDeposit = minimumCollateralRequired.mul(2);
        admin.transferToken(address(collateralAsset), address(pooledCreditLineBorrower), collateralToDeposit);
        pooledCreditLineBorrower.setAllowance(address(pooledCreditLine), address(collateralAsset), type(uint256).max);

        // Since borrow can only be done after the collection period,
        vm.warp(block.timestamp + request.collectionPeriod);

        // We want to deposit collateral now
        pooledCreditLineBorrower.depositCollateral(pooledCreditLineID, collateralToDeposit, false);

        // Calculating the borrowable amount:
        borrowableAmount = pooledCreditLineBorrower.calculateBorrowableAmount(pooledCreditLineID);
        amountToBorrow = borrowableAmount.div(4);

        //Trying to borrow the borrowable amount:
        pooledCreditLineBorrower.borrow(pooledCreditLineID, amountToBorrow);

        // Something went terribly wrong and noew we want to pause all interactions with the savings account.
        // Setting the new savings account address to address(0) doesn't work. This error is thrown:
        // Revert ("UpgradeableProxy: new implementation is not a contract"
        log_address(address(pausedContract));

        address pcl_savingsAccount_old = address(pooledCreditLine.SAVINGS_ACCOUNT());
        address savingsAccount_impl = proxyAdmin.getImplementationAddressOfProxy(sublimeProxyInstance);
        log_named_address('Old Savings Account', savingsAccount_impl);

        proxyAdmin.changeImplementationAddressOfProxy(address(sublimeProxyInstance), address(pausedContract));

        address pausedContractAddress = proxyAdmin.getImplementationAddressOfProxy(sublimeProxyInstance);
        log_named_address('Paused Contract Address', pausedContractAddress);
        address pcl_savingsAccount_new = address(pooledCreditLine.SAVINGS_ACCOUNT());

        // assert that the savings account address for the pcl should not change
        assertEq(pcl_savingsAccount_new, pcl_savingsAccount_old);

        // Assert that the implementation addresses of the savings account changed to a paused contract
        assertTrue(savingsAccount_impl != pausedContractAddress);

        // This call should break and testFail should succeed
        savingsAccount.getTotalTokens(address(pooledCreditLineBorrower), request.borrowAsset);
    }

    // Test20: Test the pause and upgrade functionality of price oracle as the admin
    function test_pauseAndUpgradePriceOracleContract() public {
        // Create your PCL request
        pooledCreditLineID = pooledCreditLineBorrower.createRequest(request);

        // The status of the PCL request should be in REQUESTED state
        status = pooledCreditLine.getStatusAndUpdate(pooledCreditLineID);
        assertTrue(status == PooledCreditLineStatus.REQUESTED);

        // Transferring borrow tokens to the lender, and then lender lends to the PCL
        lendAmount = request.borrowLimit;
        admin.transferToken(address(borrowAsset), address(pooledCreditLineLender_1), lendAmount);
        pooledCreditLineLender_1.setAllowance(address(lenderPool), address(borrowAsset), type(uint256).max);
        pooledCreditLineLender_1.lend(pooledCreditLineID, lendAmount);

        // The collection period gets over
        vm.warp(block.timestamp + request.collectionPeriod);

        // Borrower signs the required documents and then calls the start function
        pooledCreditLineBorrower.start(pooledCreditLineID);

        // Since the borrowLimit is met, the status should change to ACTIVE state
        status = pooledCreditLine.getStatusAndUpdate(pooledCreditLineID);
        assertTrue(status == PooledCreditLineStatus.ACTIVE);

        // Calculating the number of collateral tokens required to match and go above the ideal collateral ratio
        minimumCollateralRequired = pooledCreditLineBorrower.getRequiredCollateral(pooledCreditLineID, lendAmount);

        // Transferring collateral tokens to the borrower
        collateralToDeposit = minimumCollateralRequired.mul(2);
        admin.transferToken(address(collateralAsset), address(pooledCreditLineBorrower), collateralToDeposit);
        pooledCreditLineBorrower.setAllowance(address(pooledCreditLine), address(collateralAsset), type(uint256).max);

        // We want to deposit collateral now
        pooledCreditLineBorrower.depositCollateral(pooledCreditLineID, collateralToDeposit, false);

        // Since borrow can only be done after the collection period,
        vm.warp(block.timestamp + request.collectionPeriod);

        // Calculating the borrowable amount:
        borrowableAmount = pooledCreditLineBorrower.calculateBorrowableAmount(pooledCreditLineID);
        amountToBorrow = borrowableAmount.div(4);

        // Trying to borrow the a fourth of the borrowable amount:
        pooledCreditLineBorrower.borrow(pooledCreditLineID, amountToBorrow);

        // Finding out whether the feed exist (in the current price oracle implementation)
        bool doesFeedExistInitial = priceOracle.doesFeedExist(address(request.borrowAsset), address(request.collateralAsset));
        // Something went terribly wrong and now we want to pause all interactions with the price oracle.
        // Setting the new price oracle address to address(0) or 0xffff....ff doesn't work. This error is thrown:
        // Revert ("UpgradeableProxy: new implementation is not a contract")
        log_address(address(pausedContract));

        address pcl_priceOracle_old = address(pooledCreditLine.PRICE_ORACLE());
        address priceOracle_impl = proxyAdmin.getImplementationAddressOfProxy(priceOracleProxyInstance);
        log_named_address('Old Price Oracle', priceOracle_impl);

        proxyAdmin.changeImplementationAddressOfProxy(address(priceOracleProxyInstance), address(pausedContract));

        address pausedContractAddress = proxyAdmin.getImplementationAddressOfProxy(priceOracleProxyInstance);
        log_named_address('Paused Contract Address', pausedContractAddress);
        address pcl_priceOracle_new = address(pooledCreditLine.PRICE_ORACLE());

        // assert that the price oracle address for the pcl should not change
        assertEq(pcl_priceOracle_new, pcl_priceOracle_old);

        // Assert that the implementation addresses of the price oracle changed to a paused contract
        assertTrue(priceOracle_impl != pausedContractAddress);

        // Now that the priceOracle is paused, let's change the proxyImplementation to a patched priceOracle
        PriceOracle patchedPriceOracle = new PriceOracle(type(uint128).max);
        proxyAdmin.changeImplementationAddressOfProxy(address(priceOracleProxyInstance), address(patchedPriceOracle));

        // Now comparing the address of the patchedPriceOracle with pausedContract
        address patchedPriceOracleAddress = proxyAdmin.getImplementationAddressOfProxy(priceOracleProxyInstance);
        log_named_address('New Price Oracle', patchedPriceOracleAddress);

        bool doesFeedExistFinal = priceOracle.doesFeedExist(address(request.borrowAsset), address(request.collateralAsset));

        assertTrue(patchedPriceOracleAddress != pausedContractAddress);
        assertTrue(doesFeedExistFinal == doesFeedExistInitial);
    }

    // Test21: Test the pause functionality of price oracle as the admin
    function testFail_stopPriceOracleInteraction() public {
        // Create your PCL request
        pooledCreditLineID = pooledCreditLineBorrower.createRequest(request);

        // The status of the PCL request should be in REQUESTED state
        status = pooledCreditLine.getStatusAndUpdate(pooledCreditLineID);
        assertTrue(status == PooledCreditLineStatus.REQUESTED);

        // Transferring borrow tokens to the lender, and then lender lends to the PCL
        lendAmount = request.borrowLimit;
        admin.transferToken(address(borrowAsset), address(pooledCreditLineLender_1), lendAmount);
        pooledCreditLineLender_1.setAllowance(address(lenderPool), address(borrowAsset), type(uint256).max);
        pooledCreditLineLender_1.lend(pooledCreditLineID, lendAmount);

        // The collection period gets over
        vm.warp(block.timestamp + request.collectionPeriod);

        // Borrower signs the required documents and then calls the start function
        pooledCreditLineBorrower.start(pooledCreditLineID);

        // Since the borrowLimit is met, the status should change to ACTIVE state
        status = pooledCreditLine.getStatusAndUpdate(pooledCreditLineID);
        assertTrue(status == PooledCreditLineStatus.ACTIVE);

        // Calculating the number of collateral tokens required to match and go above the ideal collateral ratio
        minimumCollateralRequired = pooledCreditLineBorrower.getRequiredCollateral(pooledCreditLineID, lendAmount);

        // Transferring collateral tokens to the borrower
        collateralToDeposit = minimumCollateralRequired.mul(2);
        admin.transferToken(address(collateralAsset), address(pooledCreditLineBorrower), collateralToDeposit);
        pooledCreditLineBorrower.setAllowance(address(pooledCreditLine), address(collateralAsset), type(uint256).max);

        // We want to deposit collateral now
        pooledCreditLineBorrower.depositCollateral(pooledCreditLineID, collateralToDeposit, false);

        // Since borrow can only be done after the collection period,
        vm.warp(block.timestamp + request.collectionPeriod);

        // Calculating the borrowable amount:
        borrowableAmount = pooledCreditLineBorrower.calculateBorrowableAmount(pooledCreditLineID);
        amountToBorrow = borrowableAmount.div(4);

        // Trying to borrow the a fourth of the borrowable amount:
        pooledCreditLineBorrower.borrow(pooledCreditLineID, amountToBorrow);

        // Finding out whether the feed exist (in the current price oracle implementation)
        bool doesFeedExistInitial = priceOracle.doesFeedExist(address(request.borrowAsset), address(request.collateralAsset));
        assertTrue(doesFeedExistInitial);

        // Something went terribly wrong and now we want to pause all interactions with the price oracle.
        // Setting the new price oracle address to address(0) or 0xffff....ff doesn't work. This error is thrown:
        // Revert ("UpgradeableProxy: new implementation is not a contract")
        log_address(address(pausedContract));

        address pcl_priceOracle_old = address(pooledCreditLine.PRICE_ORACLE());
        address priceOracle_impl = proxyAdmin.getImplementationAddressOfProxy(priceOracleProxyInstance);
        log_named_address('Old Price Oracle', priceOracle_impl);

        proxyAdmin.changeImplementationAddressOfProxy(address(priceOracleProxyInstance), address(pausedContract));

        address pausedContractAddress = proxyAdmin.getImplementationAddressOfProxy(priceOracleProxyInstance);
        log_named_address('Paused Contract Address', pausedContractAddress);
        address pcl_priceOracle_new = address(pooledCreditLine.PRICE_ORACLE());

        // assert that the price oracle address for the pcl should not change
        assertEq(pcl_priceOracle_new, pcl_priceOracle_old);

        // Assert that the implementation addresses of the price oracle changed to a paused contract
        assertTrue(priceOracle_impl != pausedContractAddress);

        // Now that the price oracle contract is essentially paused, we should not be able to call priceOracle functions
        // This call should fail
        bool doesFeedExistFinal = priceOracle.doesFeedExist(address(request.borrowAsset), address(request.collateralAsset));
    }

    // Test22: Test the pause and upgrade functionality of Strategy Registry
    function test_pauseAndUpgradeStrategyRegistryContract() public {
        // Create your PCL request
        pooledCreditLineID = pooledCreditLineBorrower.createRequest(request);

        // The status of the PCL request should be in REQUESTED state
        status = pooledCreditLine.getStatusAndUpdate(pooledCreditLineID);
        assertTrue(status == PooledCreditLineStatus.REQUESTED);

        // Transferring borrow tokens to the lender, and then lender lends to the PCL
        lendAmount = request.borrowLimit;
        admin.transferToken(address(borrowAsset), address(pooledCreditLineLender_1), lendAmount);
        pooledCreditLineLender_1.setAllowance(address(lenderPool), address(borrowAsset), type(uint256).max);
        pooledCreditLineLender_1.lend(pooledCreditLineID, lendAmount);

        // The collection period gets over
        vm.warp(block.timestamp + request.collectionPeriod);

        // Borrower signs the required documents and then calls the start function
        pooledCreditLineBorrower.start(pooledCreditLineID);

        // Since the borrowLimit is met, the status should change to ACTIVE state
        status = pooledCreditLine.getStatusAndUpdate(pooledCreditLineID);
        assertTrue(status == PooledCreditLineStatus.ACTIVE);

        // Calculating the number of collateral tokens required to match and go above the ideal collateral ratio
        minimumCollateralRequired = pooledCreditLineBorrower.getRequiredCollateral(pooledCreditLineID, lendAmount);

        // Transferring collateral tokens to the borrower
        collateralToDeposit = minimumCollateralRequired.mul(2);
        admin.transferToken(address(collateralAsset), address(pooledCreditLineBorrower), collateralToDeposit);
        pooledCreditLineBorrower.setAllowance(address(pooledCreditLine), address(collateralAsset), type(uint256).max);

        // We want to deposit collateral now
        pooledCreditLineBorrower.depositCollateral(pooledCreditLineID, collateralToDeposit, false);

        // Since borrow can only be done after the collection period,
        vm.warp(block.timestamp + request.collectionPeriod);

        // Calculating the borrowable amount:
        borrowableAmount = pooledCreditLineBorrower.calculateBorrowableAmount(pooledCreditLineID);
        amountToBorrow = borrowableAmount.div(4);

        // Trying to borrow the a fourth of the borrowable amount:
        pooledCreditLineBorrower.borrow(pooledCreditLineID, amountToBorrow);

        // Finding the number of strategies in the strategy registry
        address[] memory strategyList = strategyRegistry.getStrategies();
        uint256 noOfStrategies = strategyList.length;

        // The number of strategies should be 2 (Compound Yield and No Yield)
        assertEq(noOfStrategies, 2);

        // Something went terribly wrong and now we want to pause all interactions with the strategy registry.
        // Setting the new strategy registry address to address(0) or 0xffff....ff doesn't work. This error is thrown:
        // Revert ("UpgradeableProxy: new implementation is not a contract")
        address pcl_strategyRegistry_old = address(pooledCreditLine.STRATEGY_REGISTRY());
        address strategyRegistry_impl = proxyAdmin.getImplementationAddressOfProxy(strategyRegistryProxyInstance);

        // Changing the implementation contract for the strategy registry proxy
        proxyAdmin.changeImplementationAddressOfProxy(address(strategyRegistryProxyInstance), address(pausedContract));

        // Now the implementation contract has been changed to the Paused contract
        address pausedContractAddress = proxyAdmin.getImplementationAddressOfProxy(strategyRegistryProxyInstance);
        address pcl_strategyRegistry_new = address(pooledCreditLine.STRATEGY_REGISTRY());

        // assert that the strategy registry address for the pcl should not change
        assertEq(pcl_strategyRegistry_new, pcl_strategyRegistry_old);

        // Assert that the implementation addresses of the strategy registry changed to a paused contract
        assertTrue(strategyRegistry_impl != pausedContractAddress);

        // Now that the strategyRegistry is paused, let's change the proxyImplementation to a patched strategyRegistry
        StrategyRegistry patchedStrategyRegistry = new StrategyRegistry();
        proxyAdmin.changeImplementationAddressOfProxy(address(strategyRegistryProxyInstance), address(patchedStrategyRegistry));

        // Now comparing the address of the patchedStrategyRegistry with pausedContract
        address patchedStrategyRegistryAddress = proxyAdmin.getImplementationAddressOfProxy(strategyRegistryProxyInstance);

        // Checking whether the state of the StrategyRegistry contract was maintained after the upgrade or not
        strategyList = strategyRegistry.getStrategies();
        uint256 noOfStrategiesFinal = strategyList.length;

        assertTrue(patchedStrategyRegistryAddress != pausedContractAddress); // This asserts that the implementation contract did change
        assertTrue(noOfStrategiesFinal == noOfStrategies);
    }

    // Test23: Test the pause functionality of Strategy Registry as the admin
    function testFail_stopStrategyRegistryContract() public {
        // Create your PCL request
        pooledCreditLineID = pooledCreditLineBorrower.createRequest(request);

        // The status of the PCL request should be in REQUESTED state
        status = pooledCreditLine.getStatusAndUpdate(pooledCreditLineID);
        assertTrue(status == PooledCreditLineStatus.REQUESTED);

        // Transferring borrow tokens to the lender, and then lender lends to the PCL
        lendAmount = request.borrowLimit;
        admin.transferToken(address(borrowAsset), address(pooledCreditLineLender_1), lendAmount);
        pooledCreditLineLender_1.setAllowance(address(lenderPool), address(borrowAsset), type(uint256).max);
        pooledCreditLineLender_1.lend(pooledCreditLineID, lendAmount);

        // The collection period gets over
        vm.warp(block.timestamp + request.collectionPeriod);

        // Borrower signs the required documents and then calls the start function
        pooledCreditLineBorrower.start(pooledCreditLineID);

        // Since the borrowLimit is met, the status should change to ACTIVE state
        status = pooledCreditLine.getStatusAndUpdate(pooledCreditLineID);
        assertTrue(status == PooledCreditLineStatus.ACTIVE);

        // Calculating the number of collateral tokens required to match and go above the ideal collateral ratio
        minimumCollateralRequired = pooledCreditLineBorrower.getRequiredCollateral(pooledCreditLineID, lendAmount);

        // Transferring collateral tokens to the borrower
        collateralToDeposit = minimumCollateralRequired.mul(2);
        admin.transferToken(address(collateralAsset), address(pooledCreditLineBorrower), collateralToDeposit);
        pooledCreditLineBorrower.setAllowance(address(pooledCreditLine), address(collateralAsset), type(uint256).max);

        // We want to deposit collateral now
        pooledCreditLineBorrower.depositCollateral(pooledCreditLineID, collateralToDeposit, false);

        // Since borrow can only be done after the collection period,
        vm.warp(block.timestamp + request.collectionPeriod);

        // Calculating the borrowable amount:
        borrowableAmount = pooledCreditLineBorrower.calculateBorrowableAmount(pooledCreditLineID);
        amountToBorrow = borrowableAmount.div(4);

        // Trying to borrow the a fourth of the borrowable amount:
        pooledCreditLineBorrower.borrow(pooledCreditLineID, amountToBorrow);

        // Finding the number of strategies in the strategy registry
        address[] memory strategyList = strategyRegistry.getStrategies();
        uint256 noOfStrategies = strategyList.length;

        // The number of strategies should be 2 (Compound Yield and No Yield)
        assertEq(noOfStrategies, 2);

        // Something went terribly wrong and now we want to pause all interactions with the strategy registry.
        // Setting the new strategy registry address to address(0) or 0xffff....ff doesn't work. This error is thrown:
        // Revert ("UpgradeableProxy: new implementation is not a contract")
        address pcl_strategyRegistry_old = address(pooledCreditLine.STRATEGY_REGISTRY());
        address strategyRegistry_impl = proxyAdmin.getImplementationAddressOfProxy(strategyRegistryProxyInstance);

        // Changing the implementation contract for the strategy registry proxy
        proxyAdmin.changeImplementationAddressOfProxy(address(strategyRegistryProxyInstance), address(pausedContract));

        // Now the implementation contract has been changed to the Paused contract
        address pausedContractAddress = proxyAdmin.getImplementationAddressOfProxy(strategyRegistryProxyInstance);
        address pcl_strategyRegistry_new = address(pooledCreditLine.STRATEGY_REGISTRY());

        // assert that the strategy registry address for the pcl should not change
        assertEq(pcl_strategyRegistry_new, pcl_strategyRegistry_old);

        // Assert that the implementation addresses of the strategy registry changed to a paused contract
        assertTrue(strategyRegistry_impl != pausedContractAddress);

        // Checking whether the state of the StrategyRegistry contract was maintained after the upgrade or not
        // This call should break (since we cannot call these functions from the Paused contract)
        strategyList = strategyRegistry.getStrategies();
    }

    // Test24: Test the pause and upgrade functionality of Compound Yield Contract
    function test_pauseAndUpgradeCompoundYieldContract() public {
        // Create the request
        pooledCreditLineID = pooledCreditLineBorrower.createRequest(request);

        // The status of the PCL request should be in REQUESTED state
        status = pooledCreditLine.getStatusAndUpdate(pooledCreditLineID);
        assertTrue(status == PooledCreditLineStatus.REQUESTED);

        // Transferring borrow tokens to the lender, and then lender lends to the PCL
        lendAmount = request.borrowLimit;
        admin.transferToken(address(borrowAsset), address(pooledCreditLineLender_1), lendAmount);
        pooledCreditLineLender_1.setAllowance(address(lenderPool), address(borrowAsset), type(uint256).max);
        pooledCreditLineLender_1.lend(pooledCreditLineID, lendAmount);

        // The collection period gets over
        vm.warp(block.timestamp + request.collectionPeriod);

        // Borrower signs the required documents and then calls the start function
        pooledCreditLineBorrower.start(pooledCreditLineID);

        // Since the borrowLimit is met, the status should change to ACTIVE state
        status = pooledCreditLine.getStatusAndUpdate(pooledCreditLineID);
        assertTrue(status == PooledCreditLineStatus.ACTIVE);

        // Calculating the number of collateral tokens required to match and go above the ideal collateral ratio
        minimumCollateralRequired = pooledCreditLineBorrower.getRequiredCollateral(pooledCreditLineID, lendAmount);

        // Transferring collateral tokens to the borrower
        collateralToDeposit = minimumCollateralRequired.mul(2);
        admin.transferToken(address(collateralAsset), address(pooledCreditLineBorrower), collateralToDeposit);
        pooledCreditLineBorrower.setAllowance(address(pooledCreditLine), address(collateralAsset), type(uint256).max);

        // We want to deposit collateral now
        pooledCreditLineBorrower.depositCollateral(pooledCreditLineID, collateralToDeposit, false);

        // Since borrow can only be done after the collection period,
        vm.warp(block.timestamp + request.collectionPeriod);

        // Calculating the borrowable amount:
        borrowableAmount = pooledCreditLineBorrower.calculateBorrowableAmount(pooledCreditLineID);
        amountToBorrow = borrowableAmount.div(4);

        // Trying to borrow the a fourth of the borrowable amount:
        pooledCreditLineBorrower.borrow(pooledCreditLineID, amountToBorrow);

        uint256 balanceInShares = savingsAccount.balanceInShares(
            address(pooledCreditLine),
            address(request.collateralAsset),
            address(compoundYield)
        );
        assertTrue(balanceInShares > 0);
        uint256 depositLimit = compoundYield.depositLimit(request.collateralAsset);

        // Some bug is discovered in the NoYield contract and we want to pause all interactions with the NoYield contract now.
        address compoundYieldAddressInPCL = strategyRegistry.getStrategies()[1];
        address compoundYieldImplementation = proxyAdmin.getImplementationAddressOfProxy(compoundYieldProxyInstance);

        proxyAdmin.changeImplementationAddressOfProxy(address(compoundYieldProxyInstance), address(pausedContract));

        // The implementation contract has changed but the proxy address should remain the same for PCL
        address compoundYieldAddressInPCLWhenPaused = strategyRegistry.getStrategies()[1];
        address compoundYieldImplementationWhenPaused = proxyAdmin.getImplementationAddressOfProxy(compoundYieldProxyInstance);

        assertTrue(compoundYieldAddressInPCL == compoundYieldAddressInPCLWhenPaused);
        assertTrue(compoundYieldImplementation != compoundYieldImplementationWhenPaused);

        // Now we assume that we patched the CompoundYield contract
        CompoundYield patchedCompoundYield = new CompoundYield(address(WETH), Constants._treasuryAddress, address(savingsAccount));
        proxyAdmin.changeImplementationAddressOfProxy(address(compoundYieldProxyInstance), address(patchedCompoundYield));

        // Let's see if the implementation address changed or not
        address compoundYieldImplementationPatched = proxyAdmin.getImplementationAddressOfProxy(compoundYieldProxyInstance);

        assertTrue(compoundYieldImplementationWhenPaused != compoundYieldImplementationPatched);
        assertTrue(compoundYieldImplementation != compoundYieldImplementationPatched);

        address compoundYieldAddressInPCLPatched = strategyRegistry.getStrategies()[1];
        assertTrue(compoundYieldAddressInPCLWhenPaused == compoundYieldAddressInPCLPatched);

        // Let us see if the state was maintained or not
        uint256 balanceInSharesFinal = savingsAccount.balanceInShares(
            address(pooledCreditLine),
            address(request.collateralAsset),
            address(compoundYield)
        );
        assertTrue(balanceInShares == balanceInSharesFinal);
        uint256 depositLimitFinal = compoundYield.depositLimit(request.collateralAsset);
        assertTrue(depositLimit == depositLimitFinal);
    }

    // Test24: Test the pause functionality of Compound Yield Contract. No interaction is possible with Compound yield contract.
    function testFail_pauseCompoundYieldContract() public {
        // Create the request
        pooledCreditLineID = pooledCreditLineBorrower.createRequest(request);

        // The status of the PCL request should be in REQUESTED state
        status = pooledCreditLine.getStatusAndUpdate(pooledCreditLineID);
        assertTrue(status == PooledCreditLineStatus.REQUESTED);

        // Transferring borrow tokens to the lender, and then lender lends to the PCL
        lendAmount = request.borrowLimit;
        admin.transferToken(address(borrowAsset), address(pooledCreditLineLender_1), lendAmount);
        pooledCreditLineLender_1.setAllowance(address(lenderPool), address(borrowAsset), type(uint256).max);
        pooledCreditLineLender_1.lend(pooledCreditLineID, lendAmount);

        // The collection period gets over
        vm.warp(block.timestamp + request.collectionPeriod);

        // Borrower signs the required documents and then calls the start function
        pooledCreditLineBorrower.start(pooledCreditLineID);

        // Since the borrowLimit is met, the status should change to ACTIVE state
        status = pooledCreditLine.getStatusAndUpdate(pooledCreditLineID);
        assertTrue(status == PooledCreditLineStatus.ACTIVE);

        // Calculating the number of collateral tokens required to match and go above the ideal collateral ratio
        minimumCollateralRequired = pooledCreditLineBorrower.getRequiredCollateral(pooledCreditLineID, lendAmount);

        // Transferring collateral tokens to the borrower
        collateralToDeposit = minimumCollateralRequired.mul(2);
        admin.transferToken(address(collateralAsset), address(pooledCreditLineBorrower), collateralToDeposit);
        pooledCreditLineBorrower.setAllowance(address(pooledCreditLine), address(collateralAsset), type(uint256).max);

        // We want to deposit collateral now
        pooledCreditLineBorrower.depositCollateral(pooledCreditLineID, collateralToDeposit, false);

        // Since borrow can only be done after the collection period,
        vm.warp(block.timestamp + request.collectionPeriod);

        // Calculating the borrowable amount:
        borrowableAmount = pooledCreditLineBorrower.calculateBorrowableAmount(pooledCreditLineID);
        amountToBorrow = borrowableAmount.div(4);

        // Trying to borrow the a fourth of the borrowable amount:
        pooledCreditLineBorrower.borrow(pooledCreditLineID, amountToBorrow);

        uint256 balanceInShares = savingsAccount.balanceInShares(
            address(pooledCreditLine),
            address(request.collateralAsset),
            address(compoundYield)
        );
        assertTrue(balanceInShares > 0);
        uint256 depositLimit = compoundYield.depositLimit(request.collateralAsset);

        // Some bug is discovered in the NoYield contract and we want to pause all interactions with the NoYield contract now.
        address compoundYieldAddressInPCL = strategyRegistry.getStrategies()[1];
        address compoundYieldImplementation = proxyAdmin.getImplementationAddressOfProxy(compoundYieldProxyInstance);

        proxyAdmin.changeImplementationAddressOfProxy(address(compoundYieldProxyInstance), address(pausedContract));

        // The implementation contract has changed but the proxy address should remain the same for PCL
        address compoundYieldAddressInPCLWhenPaused = strategyRegistry.getStrategies()[1];
        address compoundYieldImplementationWhenPaused = proxyAdmin.getImplementationAddressOfProxy(compoundYieldProxyInstance);

        assertTrue(compoundYieldAddressInPCL == compoundYieldAddressInPCLWhenPaused);
        assertTrue(compoundYieldImplementation != compoundYieldImplementationWhenPaused);

        uint256 depositLimitFinal = compoundYield.depositLimit(request.collateralAsset);
    }

    // Test25: Pause and upgrade the PooledCreditLine contract
    function test_pauseAndUpgradePCLContract() public {
        // Create the request
        pooledCreditLineID = pooledCreditLineBorrower.createRequest(request);

        // The status of the PCL request should be in REQUESTED state
        status = pooledCreditLine.getStatusAndUpdate(pooledCreditLineID);
        assertTrue(status == PooledCreditLineStatus.REQUESTED);

        // Transferring borrow tokens to the lender, and then lender lends to the PCL
        lendAmount = request.borrowLimit;
        admin.transferToken(address(borrowAsset), address(pooledCreditLineLender_1), lendAmount);
        pooledCreditLineLender_1.setAllowance(address(lenderPool), address(borrowAsset), type(uint256).max);
        pooledCreditLineLender_1.lend(pooledCreditLineID, lendAmount);

        // The collection period gets over
        vm.warp(block.timestamp + request.collectionPeriod);

        // Borrower signs the required documents and then calls the start function
        pooledCreditLineBorrower.start(pooledCreditLineID);

        // Since the borrowLimit is met, the status should change to ACTIVE state
        status = pooledCreditLine.getStatusAndUpdate(pooledCreditLineID);
        assertTrue(status == PooledCreditLineStatus.ACTIVE);

        // Calculating the number of collateral tokens required to match and go above the ideal collateral ratio
        minimumCollateralRequired = pooledCreditLineBorrower.getRequiredCollateral(pooledCreditLineID, lendAmount);

        // Transferring collateral tokens to the borrower
        collateralToDeposit = minimumCollateralRequired.mul(2);
        admin.transferToken(address(collateralAsset), address(pooledCreditLineBorrower), collateralToDeposit);
        pooledCreditLineBorrower.setAllowance(address(pooledCreditLine), address(collateralAsset), type(uint256).max);

        // We want to deposit collateral now
        pooledCreditLineBorrower.depositCollateral(pooledCreditLineID, collateralToDeposit, false);

        // Since borrow can only be done after the collection period,
        vm.warp(block.timestamp + request.collectionPeriod);

        // Calculating the borrowable amount:
        borrowableAmount = pooledCreditLineBorrower.calculateBorrowableAmount(pooledCreditLineID);
        amountToBorrow = borrowableAmount.div(4);

        // Trying to borrow the a fourth of the borrowable amount:
        pooledCreditLineBorrower.borrow(pooledCreditLineID, amountToBorrow);

        // Checking the state with the current implementation
        uint256 protocolFeeFractionCurrent = pooledCreditLine.protocolFeeFraction();
        uint256 depositedCollateralCurrent = pooledCreditLine.depositedCollateralInShares(pooledCreditLineID);

        // Some bug is discovered in the PCL contract and we want to pause all interactions with the PCL contract now
        address pclAddressCurrent = address(pooledCreditLine);
        address pclImplementationCurrent = proxyAdmin.getImplementationAddressOfProxy(pooledCreditLineProxyInstance);

        proxyAdmin.changeImplementationAddressOfProxy(address(pooledCreditLineProxyInstance), address(pausedContract));

        // The implementation contract has changed but the proxy address itself should remain the same
        address pclAddressPaused = address(pooledCreditLine);
        address pclImplementationPaused = proxyAdmin.getImplementationAddressOfProxy(pooledCreditLineProxyInstance);

        assertTrue(pclAddressCurrent == pclAddressPaused);
        assertTrue(pclImplementationCurrent != pclImplementationPaused);

        // Now we assume we patched the PCL contract
        PooledCreditLine patchedPCL = new PooledCreditLine(
            address(lenderPool),
            address(USDC),
            address(priceOracle),
            address(savingsAccount),
            address(strategyRegistry),
            address(verification),
            1e18 / 10
        );
        proxyAdmin.changeImplementationAddressOfProxy(address(pooledCreditLineProxyInstance), address(patchedPCL));

        // Let's see if the implementation address changed or not
        address pclImplementationPatched = proxyAdmin.getImplementationAddressOfProxy(pooledCreditLineProxyInstance);
        address pclAddressPatched = address(pooledCreditLine);

        assertTrue(pclImplementationPaused != pclImplementationPatched);
        assertTrue(pclImplementationCurrent != pclImplementationPatched);
        assertTrue(pclAddressPaused == pclAddressPatched);

        // Checking the state with the patched implementation
        uint256 protocolFeeFractionPatched = pooledCreditLine.protocolFeeFraction();
        uint256 depositedCollateralPatched = pooledCreditLine.depositedCollateralInShares(pooledCreditLineID);

        assertTrue(protocolFeeFractionPatched == protocolFeeFractionCurrent);
        assertTrue(depositedCollateralPatched == depositedCollateralCurrent);
    }

    // Test26: No interaction with the PCL is possible when the contract is paused
    function testFail_stopPCLContract() public {
        // Create the request
        pooledCreditLineID = pooledCreditLineBorrower.createRequest(request);

        // The status of the PCL request should be in REQUESTED state
        status = pooledCreditLine.getStatusAndUpdate(pooledCreditLineID);
        assertTrue(status == PooledCreditLineStatus.REQUESTED);

        // Transferring borrow tokens to the lender, and then lender lends to the PCL
        lendAmount = request.borrowLimit;
        admin.transferToken(address(borrowAsset), address(pooledCreditLineLender_1), lendAmount);
        pooledCreditLineLender_1.setAllowance(address(lenderPool), address(borrowAsset), type(uint256).max);
        pooledCreditLineLender_1.lend(pooledCreditLineID, lendAmount);

        // The collection period gets over
        vm.warp(block.timestamp + request.collectionPeriod);

        // Borrower signs the required documents and then calls the start function
        pooledCreditLineBorrower.start(pooledCreditLineID);

        // Since the borrowLimit is met, the status should change to ACTIVE state
        status = pooledCreditLine.getStatusAndUpdate(pooledCreditLineID);
        assertTrue(status == PooledCreditLineStatus.ACTIVE);

        // Calculating the number of collateral tokens required to match and go above the ideal collateral ratio
        minimumCollateralRequired = pooledCreditLineBorrower.getRequiredCollateral(pooledCreditLineID, lendAmount);

        // Transferring collateral tokens to the borrower
        collateralToDeposit = minimumCollateralRequired.mul(2);
        admin.transferToken(address(collateralAsset), address(pooledCreditLineBorrower), collateralToDeposit);
        pooledCreditLineBorrower.setAllowance(address(pooledCreditLine), address(collateralAsset), type(uint256).max);

        // We want to deposit collateral now
        pooledCreditLineBorrower.depositCollateral(pooledCreditLineID, collateralToDeposit, false);

        // Checking the state with the current implementation
        uint256 protocolFeeFractionCurrent = pooledCreditLine.protocolFeeFraction();
        uint256 depositedCollateralCurrent = pooledCreditLine.depositedCollateralInShares(pooledCreditLineID);

        // Some bug is discovered in the PCL contract and we want to pause all interactions with the PCL contract now
        address pclAddressCurrent = address(pooledCreditLine);
        address pclImplementationCurrent = proxyAdmin.getImplementationAddressOfProxy(pooledCreditLineProxyInstance);

        proxyAdmin.changeImplementationAddressOfProxy(address(pooledCreditLineProxyInstance), address(pausedContract));

        // The implementation contract has changed but the proxy address itself should remain the same
        address pclAddressPaused = address(pooledCreditLine);
        address pclImplementationPaused = proxyAdmin.getImplementationAddressOfProxy(pooledCreditLineProxyInstance);

        assertTrue(pclAddressCurrent == pclAddressPaused);
        assertTrue(pclImplementationCurrent != pclImplementationPaused);

        uint256 protocolFeeFractionPatched = pooledCreditLine.protocolFeeFraction();
        uint256 depositedCollateralPatched = pooledCreditLine.depositedCollateralInShares(pooledCreditLineID);

        assertTrue(protocolFeeFractionPatched == protocolFeeFractionCurrent);
        assertTrue(depositedCollateralPatched == depositedCollateralCurrent);
    }

    // Test27: Pause and upgrade the LenderPool contract
    function test_pauseAndUpgradeLPContract() public {
        // Create the request
        pooledCreditLineID = pooledCreditLineBorrower.createRequest(request);

        // The status of the PCL request should be in REQUESTED state
        status = pooledCreditLine.getStatusAndUpdate(pooledCreditLineID);
        assertTrue(status == PooledCreditLineStatus.REQUESTED);

        // Transferring borrow tokens to the lender, and then lender lends (half of the borrowLimit) to the PCL
        lendAmount = request.borrowLimit;
        admin.transferToken(address(borrowAsset), address(pooledCreditLineLender_1), lendAmount);
        pooledCreditLineLender_1.setAllowance(address(lenderPool), address(borrowAsset), type(uint256).max);
        pooledCreditLineLender_1.lend(pooledCreditLineID, lendAmount / 2);

        // Since the borrowLimit is not met, the status should remain in REQUESTED state
        status = pooledCreditLine.getStatusAndUpdate(pooledCreditLineID);
        assertTrue(status == PooledCreditLineStatus.REQUESTED);

        uint256 totalSupplyCurrent = lenderPool.totalSupply(pooledCreditLineID);
        (, , , , uint256 collateralHeldCurrent) = lenderPool.pooledCLVariables(pooledCreditLineID);
        (uint256 startTimeCurrent, , , , , , , ) = lenderPool.pooledCLConstants(pooledCreditLineID);

        // Some bug is discovered in the LP contract and we want to pause all interactions with the LP contract now
        address lpAddressCurrent = address(lenderPool);
        address lpImplementationCurrent = proxyAdmin.getImplementationAddressOfProxy(lenderPoolProxyInstance);

        proxyAdmin.changeImplementationAddressOfProxy(address(lenderPoolProxyInstance), address(pausedContract));

        // The implementation contract has changed but the proxy address itself should remain the same
        address lpAddressPaused = address(lenderPool);
        address lpImplementationPaused = proxyAdmin.getImplementationAddressOfProxy(lenderPoolProxyInstance);

        assertTrue(lpAddressCurrent == lpAddressPaused);
        assertTrue(lpImplementationCurrent != lpImplementationPaused);

        // Now we assume we patched the LP contract
        LenderPool patchedLP = new LenderPool(address(pooledCreditLine), address(savingsAccount), address(verification));
        proxyAdmin.changeImplementationAddressOfProxy(address(lenderPoolProxyInstance), address(patchedLP));

        // Let's see if the implementation address changed or not
        address lpImplementationPatched = proxyAdmin.getImplementationAddressOfProxy(lenderPoolProxyInstance);
        address lpAddressPatched = address(lenderPool);

        assertTrue(lpImplementationPaused != lpImplementationPatched);
        assertTrue(lpImplementationCurrent != lpImplementationPatched);
        assertTrue(lpAddressPaused == lpAddressPatched);

        // Checking the state with the patched implementation
        uint256 totalSupplyPatched = lenderPool.totalSupply(pooledCreditLineID);
        (, , , , uint256 collateralHeldPatched) = lenderPool.pooledCLVariables(pooledCreditLineID);
        (uint256 startTimePatched, , , , , , , ) = lenderPool.pooledCLConstants(pooledCreditLineID);

        assertTrue(totalSupplyCurrent == totalSupplyPatched);
        assertTrue(collateralHeldCurrent == collateralHeldPatched);
        assertTrue(startTimeCurrent == startTimePatched);
    }

    // Test28: No interaction with the LP is possible when the contract is paused
    function testFail_stopLPContracts() public {
        // Create the request
        pooledCreditLineID = pooledCreditLineBorrower.createRequest(request);

        // The status of the PCL request should be in REQUESTED state
        status = pooledCreditLine.getStatusAndUpdate(pooledCreditLineID);
        assertTrue(status == PooledCreditLineStatus.REQUESTED);

        // Transferring borrow tokens to the lender, and then lender lends (half of the borrowLimit) to the PCL
        lendAmount = request.borrowLimit;
        admin.transferToken(address(borrowAsset), address(pooledCreditLineLender_1), lendAmount);
        pooledCreditLineLender_1.setAllowance(address(lenderPool), address(borrowAsset), type(uint256).max);
        pooledCreditLineLender_1.lend(pooledCreditLineID, lendAmount / 2);

        // Since the borrowLimit is not met, the status should remain in REQUESTED state
        status = pooledCreditLine.getStatusAndUpdate(pooledCreditLineID);
        assertTrue(status == PooledCreditLineStatus.REQUESTED);

        // Calling these functions from the correct implementation contract of the LenderPool to see if they are working or not
        uint256 totalSupplyCurrent = lenderPool.totalSupply(pooledCreditLineID);
        (, , , , uint256 collateralHeldCurrent) = lenderPool.pooledCLVariables(pooledCreditLineID);
        (uint256 startTimeCurrent, , , , , , , ) = lenderPool.pooledCLConstants(pooledCreditLineID);

        // Some bug is discovered in the LP contract and we want to pause all interactions with the LP contract now
        address lpAddressCurrent = address(lenderPool);
        address lpImplementationCurrent = proxyAdmin.getImplementationAddressOfProxy(lenderPoolProxyInstance);

        proxyAdmin.changeImplementationAddressOfProxy(address(lenderPoolProxyInstance), address(pausedContract));

        // The implementation contract has changed but the proxy address itself should remain the same
        address lpAddressPaused = address(lenderPool);
        address lpImplementationPaused = proxyAdmin.getImplementationAddressOfProxy(lenderPoolProxyInstance);

        assertTrue(lpAddressCurrent == lpAddressPaused);
        assertTrue(lpImplementationCurrent != lpImplementationPaused);

        // These calls should fail (since the implementation contract does not contain this function)
        pooledCreditLineLender_1.lend(pooledCreditLineID, lendAmount / 4);
    }
}
