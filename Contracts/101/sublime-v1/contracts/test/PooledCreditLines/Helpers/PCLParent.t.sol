// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;
pragma abicoder v2;

import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import '@openzeppelin/contracts-upgradeable/proxy/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC20/ERC20PausableUpgradeable.sol';
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@chainlink/contracts/src/v0.7/interfaces/AggregatorV3Interface.sol';

import '../../roles/User.sol';
import '../../../interfaces/IPooledCreditLineDeclarations.sol';
import '../../../PriceOracle.sol';
import '../../../yield/NoYield.sol';
import '../../../yield/CompoundYield.sol';
import '../../../yield/StrategyRegistry.sol';
import '../../../SavingsAccount/SavingsAccount.sol';
import '../../../SavingsAccount/SavingsAccountUtil.sol';
import '../../../Verification/Verification.sol';
import '../../../Verification/twitterVerifier.sol';
import '../../Constants.sol';
import '../../../mocks/MockToken.sol';
import '../../../mocks/MockWETH.sol';
import '../../../mocks/MockVerification.sol';
import '../../../mocks/MockV3Aggregator.sol';
import '../../..//interfaces/IWETH9.sol';
import '../../ProtocolFeeCollector.sol';
import '../../roles/CompoundUser.sol';
import '../Roles/PCLAdmin.t.sol';
import './PCLConstants.t.sol';
import 'forge-std/Test.sol';

contract PCLParent is IPooledCreditLineDeclarations, Test {
    using stdStorage for StdStorage;

    using SafeMath for uint256;
    using SafeMath for uint128;
    using SafeERC20 for ERC20;

    uint256 constant BLOCK_TIME = 20;

    bool isForked;

    address public priceOracleAddress;
    address public collateralCTokenAddress;
    address public borrowCTokenAddress;

    address public collateralAssetAggregatorAddress;
    address public borrowAssetAggregatorAddress;
    address public usdcAggregatorAddress;

    IERC20 public collateralAsset;
    IERC20 public borrowAsset;
    IERC20 public usdc;
    IWETH9 public weth;

    address public mockAdminVerifier1;
    address public mockAdminVerifier2;

    address public savingsAccountAddress;
    address public noYieldAddress;
    address public compoundYieldAddress;
    address public limitsManagerAddress;
    address public pooledCreditLineAddress;
    address public lenderPoolAddress;

    LenderPool lp;
    PooledCreditLine pcl;

    PCLAdmin public proxyAdmin;
    PCLAdmin public admin;
    address public protocolFeeCollectorAddress;

    PCLUser public borrower;
    CompoundUser public compoundUser;

    struct LenderInfo {
        address lenderAddress;
        uint256 amount;
    }

    mapping(uint256 => LenderInfo) public lenders;
    uint256 numLenders;

    Request request;

    function setCollateralAsset() public virtual {
        if (isForked) {
            collateralAsset = ERC20(Constants.WBTC);
            collateralAssetAggregatorAddress = Constants.WBTC_priceFeedChainlink;
            collateralCTokenAddress = Constants.cWBTC;
        } else {
            collateralAsset = new MockToken('CollateralAsset', 'MT1', 18, 1e40, address(admin));
            collateralAssetAggregatorAddress = address(new MockV3Aggregator(18, 12876423400040030304304));
        }
    }

    function setBorrowAsset() public virtual {
        if (isForked) {
            borrowAsset = ERC20(Constants.DAI);
            borrowAssetAggregatorAddress = Constants.DAI_priceFeedChainlink;
            borrowCTokenAddress = Constants.cDAI;
        } else {
            borrowAsset = new MockToken('BorrowAsset', 'MT2', 8, 1e40, address(admin));
            borrowAssetAggregatorAddress = address(new MockV3Aggregator(8, 195040576));
        }
    }

    function setUp() public virtual {
        uint256 _chainId = getChainID();
        if (_chainId == 1) {
            isForked = true;
        }

        // setting global actors
        proxyAdmin = new PCLAdmin(pooledCreditLineAddress, lenderPoolAddress);
        admin = new PCLAdmin(pooledCreditLineAddress, lenderPoolAddress);
        compoundUser = new CompoundUser();

        /* --- deploying contracts ----*/

        // deploying  mock protocol fee collector
        protocolFeeCollectorAddress = address(new ProtocolFeeCollector());

        /***** set up verification *****/
        // deploy verification related contracts
        address verificationAddress = admin.deployVerification(address(proxyAdmin));

        // deploy mock admin verifier
        mockAdminVerifier1 = admin.deployMockAdminVerifier(verificationAddress);
        mockAdminVerifier2 = admin.deployMockAdminVerifier(verificationAddress);

        // whitelist mockAdminVerifier
        admin.addVerifier(verificationAddress, mockAdminVerifier1);
        admin.addVerifier(verificationAddress, mockAdminVerifier2);

        /***** set up savings account *****/
        // deploy strategy registry
        address strategyRegistryAddress = admin.deployStrategyRegistry(PCLConstants.maxStrategies);
        // deploy savings account
        savingsAccountAddress = admin.deploySavingsAccount(strategyRegistryAddress);
        // deploy no yield
        noYieldAddress = admin.deployNoYield(address(admin), savingsAccountAddress, protocolFeeCollectorAddress);
        // add savings strategies to savings account
        admin.addSavingsAccountStrategy(strategyRegistryAddress, noYieldAddress);

        setCollateralAsset();
        setBorrowAsset();

        if (isForked) {
            // forked mode
            usdc = ERC20(Constants.USDC);
            weth = IWETH9(Constants.WETH);

            writeTokenBalance(address(admin), address(collateralAsset), collateralAsset.totalSupply());
            writeTokenBalance(address(admin), address(borrowAsset), borrowAsset.totalSupply());
            writeTokenBalance(address(admin), Constants.USDC, usdc.totalSupply());
            // weth.deposit{value: 1e30}();
            // IERC20(Constants.WETH).transfer(address(admin), 1e30);

            // deploy aggregators
            usdcAggregatorAddress = Constants.USDC_priceFeedChainlink;

            // deploy compound yield
            compoundYieldAddress = admin.deployCompoundYield(
                address(admin),
                savingsAccountAddress,
                address(weth),
                protocolFeeCollectorAddress
            );
            admin.addSavingsAccountStrategy(strategyRegistryAddress, compoundYieldAddress);
            admin.addTokenAddressForCompoundYield(payable(compoundYieldAddress), address(collateralAsset), collateralCTokenAddress);
            admin.addTokenAddressForCompoundYield(payable(compoundYieldAddress), address(borrowAsset), borrowCTokenAddress);
            admin.addTokenAddressForNoYield(noYieldAddress, address(borrowAsset));
            admin.addTokenAddressForNoYield(noYieldAddress, address(collateralAsset));
        } else {
            // standard mode

            vm.warp(block.timestamp + 10);

            usdc = new MockToken('USDC', 'USDC', 6, 1e20, address(admin));
            weth = new MockWETH();

            // deploy aggregators
            usdcAggregatorAddress = address(new MockV3Aggregator(6, 1000000));

            // deploy compound yield
            compoundYieldAddress = admin.deployCompoundYield(
                address(admin),
                savingsAccountAddress,
                address(weth),
                protocolFeeCollectorAddress
            );
            admin.addSavingsAccountStrategy(strategyRegistryAddress, compoundYieldAddress);

            // adding cToken for collateralAsset
            collateralCTokenAddress = admin.deployMockCToken(address(collateralAsset), compoundYieldAddress, noYieldAddress);
            admin.transferOwnership(address(collateralAsset), collateralCTokenAddress);

            // adding cToken for borrowAsset
            borrowCTokenAddress = admin.deployMockCToken(address(borrowAsset), compoundYieldAddress, noYieldAddress);
            admin.transferOwnership(address(borrowAsset), borrowCTokenAddress);
        }

        /***** set up price oracles *****/
        // deploy price oracle contract
        priceOracleAddress = admin.deployPriceOracle(address(admin), PCLConstants.uniswapPriceAveragingPeriod);

        // add aggregators to the oracle
        admin.setChainlinkFeedAddress(
            priceOracleAddress,
            address(collateralAsset),
            collateralAssetAggregatorAddress,
            Constants.CHAINLINK_HEARTBEAT
        );
        admin.setChainlinkFeedAddress(
            priceOracleAddress,
            address(borrowAsset),
            borrowAssetAggregatorAddress,
            Constants.CHAINLINK_HEARTBEAT
        );
        admin.setChainlinkFeedAddress(priceOracleAddress, address(usdc), usdcAggregatorAddress, Constants.CHAINLINK_HEARTBEAT);

        limitsManagerAddress = admin.deployLimitsManager(address(proxyAdmin), address(usdc), priceOracleAddress);

        {
            (pooledCreditLineAddress, lenderPoolAddress) = admin.deployPCLContracts(
                address(proxyAdmin), //proxyAdmin
                savingsAccountAddress, //savingsAccount
                verificationAddress, //verification
                priceOracleAddress, //priceOracle
                strategyRegistryAddress, //strategyRegistry
                limitsManagerAddress,
                protocolFeeCollectorAddress //protocolFeeCollector
            );
        }

        pcl = PooledCreditLine(pooledCreditLineAddress);
        lp = LenderPool(lenderPoolAddress);

        // setting PCL actors
        borrower = new PCLUser(pooledCreditLineAddress, lenderPoolAddress);
        //emit log_named_address('borrower', address(borrower));
        //emit log_named_address('pcl in pclparent', pooledCreditLineAddress);
        // Verifying the borrower
        borrower.registerSelf(mockAdminVerifier2);
        // this is done to activate the registered user
        vm.warp(block.timestamp + Verification(verificationAddress).activationDelay());
    }

    function randomAmountToLend(uint256 _seed, uint256 _maxVal) public view returns (uint256) {
        // _amountToLend will only be 0 if the random number is a multiple of _maxVal
        // in this case we add a 1 to it.
        uint256 _amountToLend = uint256(keccak256(abi.encodePacked(block.timestamp, _seed))) % _maxVal;
        if (_amountToLend == 0) {
            _amountToLend = _amountToLend.add(1);
        }
        return _amountToLend;
    }

    /**
     * @dev Helper function used within generalizedLender to create a single lender and lend
     * @param _pooledCreditLineID Pooled credit line ID
     * @param _amountToLend Amount to lend
     * @param _asset Asset to be lent
     * @return address of the lender created
     */
    function createLender(
        uint256 _pooledCreditLineID,
        uint256 _amountToLend,
        address _asset
    ) public returns (address) {
        PCLUser _pooledCreditLineLender = new PCLUser(pooledCreditLineAddress, lenderPoolAddress);
        _pooledCreditLineLender.registerSelf(mockAdminVerifier1);

        admin.transferToken(address(_asset), address(_pooledCreditLineLender), _amountToLend);
        _pooledCreditLineLender.setAllowance(lenderPoolAddress, address(_asset), type(uint256).max);
        _pooledCreditLineLender.lend(_pooledCreditLineID, _amountToLend);

        return address(_pooledCreditLineLender);
    }

    /**
     * @dev used to lend into a PCL in collection stage. lenders.lenderAddress & lenders.amount store details of every lender
     * @param _pooledCreditLineID id of the PCL to lend into
     * @param _nLenders number of lenders that must be created. If 0, it'll create random number of lenders
     * @param _amountToLend cumulative amount that all lenders must lend
     * @param _asset to be lent
     * @return the final number of lenders created by the function.
     */
    function createMultipleLenders(
        uint256 _pooledCreditLineID,
        uint256 _nLenders,
        uint128 _amountToLend,
        address _asset
    ) public returns (uint256) {
        if (_amountToLend < _nLenders) {
            address _lender = createLender(_pooledCreditLineID, _amountToLend, _asset);
            lenders[0].lenderAddress = _lender;
            lenders[0].amount = _amountToLend;

            return 1;
        }

        if (_nLenders != 0) {
            uint256 _maxAmountPerLender = _amountToLend / _nLenders;
            require(_maxAmountPerLender != 0, '_amountToLend is too small');
            uint256 _penultimateCumulativeAmountSupplied = 0;
            address _lender;

            for (uint256 i; i < _nLenders - 1; ++i) {
                uint256 _amountLent = randomAmountToLend(_penultimateCumulativeAmountSupplied, _maxAmountPerLender);

                // executing lend, and getting address of lender
                _lender = createLender(_pooledCreditLineID, _amountLent, _asset);

                // updating state mapping for address of lender and amount lent
                lenders[i].lenderAddress = _lender;
                lenders[i].amount = _amountLent;

                _penultimateCumulativeAmountSupplied += _amountLent;
            }

            uint256 _amountLeft = _amountToLend - _penultimateCumulativeAmountSupplied;

            // executing lend, and getting address of lender
            _lender = createLender(_pooledCreditLineID, _amountLeft, _asset);

            // updating state mapping for address of lender and amount lent
            lenders[_nLenders - 1].lenderAddress = _lender;
            lenders[_nLenders - 1].amount = _amountLeft;

            return _nLenders;
        } else {
            uint256 _cumAmountLent = 0;
            uint256 _lenderCounter = 0;
            address _lender;
            while (_cumAmountLent < _amountToLend) {
                uint256 _maxLendableAmount = _amountToLend - _cumAmountLent;
                uint256 _amountLent;
                _amountLent = randomAmountToLend(_cumAmountLent, _maxLendableAmount);
                _lender = createLender(_pooledCreditLineID, _amountLent, _asset);
                _cumAmountLent += _amountLent;
                lenders[_lenderCounter].lenderAddress = _lender;
                lenders[_lenderCounter].amount = _amountLent;

                _lenderCounter += 1;
            }

            return _lenderCounter + 1;
        }
    }

    /**
     * @dev helper function used to reset arguments used by the generalized lender
     * @param _nLenders number of lenders created by generalizedLender
     */
    function resetLenders(uint256 _nLenders) public {
        for (uint256 i; i <= _nLenders; ++i) {
            lenders[i].lenderAddress = address(0);
            lenders[i].amount = 0;
        }
    }

    function goToActiveStage(uint256 _numLenders, uint128 _amountToLend) public returns (uint256, uint256) {
        require(
            _amountToLend <= request.borrowLimit && _amountToLend >= request.minBorrowAmount,
            'Cannot go to active stage with given params'
        );
        uint256 _id = borrower.createRequest(request);
        uint256 _finalNumLenders = createMultipleLenders(_id, _numLenders, _amountToLend, request.borrowAsset);

        vm.warp(block.timestamp + request.collectionPeriod);

        borrower.start(_id);

        uint256 _status = uint256(PooledCreditLine(pooledCreditLineAddress).getStatusAndUpdate(_id));
        assertEq(_status, 2);

        return (_id, _finalNumLenders);
    }

    function scaleToRange256(
        uint256 value,
        uint256 min,
        uint256 max
    ) internal pure returns (uint256) {
        require(max != 0 && max >= min, 'wrong input');
        if (max == min) return max;
        return min + (value % (max - min));
    }

    function scaleToRange128(
        uint128 value,
        uint128 min,
        uint128 max
    ) internal pure returns (uint128) {
        require(max != 0 && max >= min, 'wrong input');
        if (max == min) return max;
        return min + (value % (max - min));
    }

    function getChainID() internal pure returns (uint256) {
        uint256 id;
        assembly {
            id := chainid()
        }
        return id;
    }

    function writeTokenBalance(
        address who,
        address token,
        uint256 amt
    ) internal {
        if (token != Constants.WETH) {
            uint256 _totalSupply = IERC20(token).totalSupply();
            uint256 _curBalance = IERC20(token).balanceOf(who);
            stdstore.target(token).sig(IERC20(token).balanceOf.selector).with_key(who).checked_write(amt + _curBalance);
            stdstore.target(token).sig(IERC20(token).totalSupply.selector).checked_write(_totalSupply + amt);
        } else {
            token.call{value: amt}('');
            IWETH9(token).transfer(who, amt);
        }
    }

    function borrowFromCompound(
        address _cToken,
        uint256 _collateralAmount,
        uint256 _borrowAmount
    ) public returns (uint256) {
        // borrowing from compound
        address(compoundUser).call{value: _collateralAmount}('');
        // emit log_named_uint("ether balance", address(compoundUser).balance);
        compoundUser.mintCETH(Constants.cETH, _collateralAmount);
        // emit log_named_uint("cEther Balance", IERC20(Constants.cETH).balanceOf(address(compoundUser)));
        address[] memory _cTokens = new address[](1);
        _cTokens[0] = Constants.cETH;
        compoundUser.enterMarkets(Constants.COMPTROLLER, _cTokens);
        // (, uint256 _liquidity, ) = IComptroller(Constants.COMPTROLLER).getAccountLiquidity(address(compoundUser));
        // emit log_named_uint("account liquidity", _liquidity);
        return compoundUser.borrow(_cToken, _borrowAmount);
        // emit log_named_uint("borrow result", _result);
        // emit log_named_uint("compoundUser balance", borrowAsset.balanceOf(address(compoundUser)));
    }

    function _increaseBlock(uint256 _time) public {
        vm.warp(_time);
        vm.roll(_time.div(BLOCK_TIME));
    }

    modifier clearMockedCalls() {
        vm.clearMockedCalls();
        _;
    }

    function helper_exchangeRateChanges() public {
        console.log(MockCToken(borrowCTokenAddress).exchangeRateCurrent());
        console.log(MockCToken(collateralCTokenAddress).exchangeRateCurrent());

        uint256 _blockDelta = 1_000_000;
        _increaseBlock(block.timestamp + _blockDelta);

        console.log(MockCToken(borrowCTokenAddress).exchangeRateCurrent());
        console.log(MockCToken(collateralCTokenAddress).exchangeRateCurrent());
    }

    function helper_increaseExchangeRateSlowly(address _assetCTokenAddress) public {
        console.log(MockCToken(_assetCTokenAddress).exchangeRateCurrent());
        uint256 _exchangeRateCurrent = MockCToken(_assetCTokenAddress).exchangeRateCurrent();
        uint256 _blockDelta = 1_000_000;
        _increaseBlock(block.timestamp + _blockDelta);
        uint256 _exchangeRateMocked = (_exchangeRateCurrent * (1e18 + (_blockDelta * 1e4))) / 1e18;
        if (isForked) {
            vm.mockCall(
                _assetCTokenAddress,
                abi.encodeWithSelector(MockCToken.exchangeRateCurrent.selector),
                abi.encode(_exchangeRateMocked)
            );
        } else {
            MockCToken(_assetCTokenAddress).mockExchangeRateStored(_exchangeRateMocked);
        }

        console.log(MockCToken(_assetCTokenAddress).exchangeRateCurrent());
    }

    function helper_increaseExchangeRateSteeply(address _assetCTokenAddress) public {
        console.log(MockCToken(_assetCTokenAddress).exchangeRateCurrent());
        uint256 _exchangeRateCurrent = MockCToken(_assetCTokenAddress).exchangeRateCurrent();
        uint256 _blockDelta = 1_000_000;
        _increaseBlock(block.timestamp + _blockDelta);
        if (isForked) {
            vm.mockCall(
                _assetCTokenAddress,
                abi.encodeWithSelector(MockCToken.exchangeRateCurrent.selector),
                abi.encode(_exchangeRateCurrent * 2)
            );
        } else {
            MockCToken(_assetCTokenAddress).mockExchangeRateStored(_exchangeRateCurrent * 2);
        }

        console.log(MockCToken(_assetCTokenAddress).exchangeRateCurrent());
    }

    function helper_decreaseExchangeRateToZero(address _assetCTokenAddress) public {
        if (isForked) {
            vm.mockCall(_assetCTokenAddress, abi.encodeWithSelector(MockCToken.exchangeRateCurrent.selector), abi.encode(0));
        } else {
            MockCToken(_assetCTokenAddress).mockExchangeRateStored(0);
        }
    }

    function helper_priceChanges(uint256 _borrowAssetPriceSeed, uint256 _collateralAssetPriceSeed) public clearMockedCalls {
        (
            uint80 _borrowAssetRoundId,
            int256 _borrowAssetPrice,
            uint256 _borrowAssetStartedAt,
            uint256 _borrowAssetUpdatedAt,
            uint80 _borrowAssetAnsweredInRound
        ) = MockV3Aggregator(borrowAssetAggregatorAddress).latestRoundData();
        (
            uint80 _collateralAssetRoundId,
            int256 _collateralAssetPrice,
            uint256 _collateralAssetStartedAt,
            uint256 _collateralAssetUpdatedAt,
            uint80 _collateralAssetAnsweredInRound
        ) = MockV3Aggregator(collateralAssetAggregatorAddress).latestRoundData();

        _borrowAssetPriceSeed = scaleToRange256(_borrowAssetPriceSeed, 1, 10000);
        _collateralAssetPriceSeed = scaleToRange256(_collateralAssetPriceSeed, 1, 10000);

        log_named_int('Borrow asset price', _borrowAssetPrice);
        log_named_int('Collateral asset price', _collateralAssetPrice);
        log_named_uint('Borrow asset seed', _borrowAssetPriceSeed);
        log_named_uint('Collateral asset seed', _collateralAssetPriceSeed);

        _borrowAssetPrice = (_borrowAssetPrice * int256(_borrowAssetPriceSeed)) / 100;
        _collateralAssetPrice = (_collateralAssetPrice * int256(_collateralAssetPriceSeed)) / 100;

        log_named_int('Borrow asset price', _borrowAssetPrice);
        log_named_int('Collateral asset price', _collateralAssetPrice);

        vm.mockCall(
            borrowAssetAggregatorAddress,
            abi.encodeWithSelector(MockV3Aggregator.latestRoundData.selector),
            abi.encode(_borrowAssetRoundId, _borrowAssetPrice, _borrowAssetStartedAt, _borrowAssetUpdatedAt, _borrowAssetAnsweredInRound)
        );
        vm.mockCall(
            collateralAssetAggregatorAddress,
            abi.encodeWithSelector(MockV3Aggregator.latestRoundData.selector),
            abi.encode(
                _collateralAssetRoundId,
                _collateralAssetPrice,
                _collateralAssetStartedAt,
                _collateralAssetUpdatedAt,
                _collateralAssetAnsweredInRound
            )
        );
    }

    function helper_decreaseAssetPrice(address _assetAggregatorAddress, uint256 _seed) public clearMockedCalls {
        (
            uint80 _assetRoundId,
            int256 _assetPrice,
            uint256 _assetStartedAt,
            uint256 _assetUpdatedAt,
            uint80 _assetAnsweredInRound
        ) = MockV3Aggregator(_assetAggregatorAddress).latestRoundData();

        _seed = scaleToRange256(_seed, 1, 95);
        _assetPrice = (_assetPrice * int256(_seed)) / 100;

        vm.mockCall(
            _assetAggregatorAddress,
            abi.encodeWithSelector(MockV3Aggregator.latestRoundData.selector),
            abi.encode(_assetRoundId, _assetPrice, _assetStartedAt, _assetUpdatedAt, _assetAnsweredInRound)
        );
    }

    function helper_increaseAssetPrice(address _assetAggregatorAddress, uint256 _seed) public clearMockedCalls {
        (
            uint80 _assetRoundId,
            int256 _assetPrice,
            uint256 _assetStartedAt,
            uint256 _assetUpdatedAt,
            uint80 _assetAnsweredInRound
        ) = MockV3Aggregator(_assetAggregatorAddress).latestRoundData();

        _seed = scaleToRange256(_seed, 105, 10000);
        _assetPrice = (_assetPrice * int256(_seed)) / 100;

        vm.mockCall(
            _assetAggregatorAddress,
            abi.encodeWithSelector(MockV3Aggregator.latestRoundData.selector),
            abi.encode(_assetRoundId, _assetPrice, _assetStartedAt, _assetUpdatedAt, _assetAnsweredInRound)
        );
    }

    function helper_decreaseAssetPriceToZero(address _assetAggregatorAddress) public clearMockedCalls {
        (
            uint80 _assetRoundId,
            int256 _assetPrice,
            uint256 _assetStartedAt,
            uint256 _assetUpdatedAt,
            uint80 _assetAnsweredInRound
        ) = MockV3Aggregator(_assetAggregatorAddress).latestRoundData();
        vm.mockCall(
            _assetAggregatorAddress,
            abi.encodeWithSelector(MockV3Aggregator.latestRoundData.selector),
            abi.encode(_assetRoundId, 0, _assetStartedAt, _assetUpdatedAt, _assetAnsweredInRound)
        );
    }

    function helper_smallPriceChanges(uint256 _borrowAssetPriceSeed, uint256 _collateralAssetPriceSeed) public clearMockedCalls {
        (
            uint80 _borrowAssetRoundId,
            int256 _borrowAssetPrice,
            uint256 _borrowAssetStartedAt,
            uint256 _borrowAssetUpdatedAt,
            uint80 _borrowAssetAnsweredInRound
        ) = MockV3Aggregator(borrowAssetAggregatorAddress).latestRoundData();
        (
            uint80 _collateralAssetRoundId,
            int256 _collateralAssetPrice,
            uint256 _collateralAssetStartedAt,
            uint256 _collateralAssetUpdatedAt,
            uint80 _collateralAssetAnsweredInRound
        ) = MockV3Aggregator(collateralAssetAggregatorAddress).latestRoundData();
        {
            _borrowAssetPriceSeed = scaleToRange256(_borrowAssetPriceSeed, 95, 105);
            _collateralAssetPriceSeed = scaleToRange256(_collateralAssetPriceSeed, 95, 105);

            _borrowAssetPrice = (_borrowAssetPrice * int256(_borrowAssetPriceSeed)) / 100;
            _collateralAssetPrice = (_collateralAssetPrice * int256(_collateralAssetPriceSeed)) / 100;
        }
        vm.mockCall(
            borrowAssetAggregatorAddress,
            abi.encodeWithSelector(MockV3Aggregator.latestRoundData.selector),
            abi.encode(_borrowAssetRoundId, _borrowAssetPrice, _borrowAssetStartedAt, _borrowAssetUpdatedAt, _borrowAssetAnsweredInRound)
        );
        vm.mockCall(
            collateralAssetAggregatorAddress,
            abi.encodeWithSelector(MockV3Aggregator.latestRoundData.selector),
            abi.encode(
                _collateralAssetRoundId,
                _collateralAssetPrice,
                _collateralAssetStartedAt,
                _collateralAssetUpdatedAt,
                _collateralAssetAnsweredInRound
            )
        );
    }
}
