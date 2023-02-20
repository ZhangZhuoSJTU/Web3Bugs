// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;
pragma abicoder v2;

import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@chainlink/contracts/src/v0.7/interfaces/AggregatorV3Interface.sol';

import 'forge-std/Test.sol';

import './CLConstants.sol';
import '../Roles/CLAdmin.sol';
import '../Roles/CLUser.sol';

import '../../../mocks/MockToken.sol';
import '../../../mocks/MockWETH.sol';
import '../../../mocks/MockV3Aggregator.sol';
import '../../../interfaces/IWETH9.sol';
import '../../ProtocolFeeCollector.sol';
import '../../Constants.sol';

interface Hevm {
    function warp(uint256) external;

    function store(
        address,
        bytes32,
        bytes32
    ) external;
}

contract CLParent is Test {
    using stdStorage for StdStorage;
    using SafeMath for uint256;

    uint256 constant BLOCK_TIME = 20;

    CLConstants.CreditLineConstants constantsCheck;
    CLConstants.RequestParams requestData;

    bool isForked;

    // ERC20
    ERC20 public collateralAsset;
    ERC20 public borrowAsset;
    ERC20 public usdc;
    IWETH9 public weth;

    // Compound tokens(CTokens)
    address public collateralCTokenAddress; //collateralCToken; //mockCToken1;
    address public borrowCTokenAddress; //borrowCToken; //mockCToken2;

    // Price aggregators (mock)
    MockV3Aggregator public collateralAssetMockAggregator;
    MockV3Aggregator public borrowAssetMockAggregator;
    MockV3Aggregator public usdcMockAggregator;

    // Price aggregators (mock)
    address public collateralAssetAggregatorAddress;
    address public borrowAssetAggregatorAddress;
    address public usdcAggregatorAddress;

    // Logic implementation contract addresses
    address public priceOracleAddress;
    address public savingsAccountAddress;
    address public strategyRegistryAddress;
    address public noYieldAddress;
    address public compoundYieldAddress;
    address public protocolFeeCollectorAddress;
    address public creditLineAddress;

    // Admins for deployements
    CLAdmin public admin;

    // Credit line actors
    CLUser public borrower;
    CLUser public lender;
    CLUser public liquidator;

    function CLSetUp() public {
        uint256 _chainId = getChainID();
        if (_chainId == 1) {
            isForked = true;
        }

        // setting admin addresses
        admin = new CLAdmin();

        // setting Credit line actors
        borrower = new CLUser();
        lender = new CLUser();
        liquidator = new CLUser();

        // deploying  mock protocol fee collector
        protocolFeeCollectorAddress = address(new ProtocolFeeCollector());
        // deploying strategy registry contract
        strategyRegistryAddress = admin.deployStrategyRegistry(CLConstants.maxStrategies);
        // deploying savings account contract
        savingsAccountAddress = admin.deploySavingsAccount(strategyRegistryAddress);
        // deploying no yield contract
        noYieldAddress = admin.deployNoYield(address(admin), savingsAccountAddress, protocolFeeCollectorAddress);

        // adding savings strategies to savings account
        admin.addSavingsAccountStrategy(strategyRegistryAddress, noYieldAddress);

        if (isForked) {
            // forked mode

            //----------------------- Deployment code start -----------------------//
            collateralAsset = ERC20(Constants.WBTC);
            borrowAsset = ERC20(Constants.DAI);
            usdc = ERC20(Constants.USDC);
            weth = IWETH9(Constants.WETH);

            writeTokenBalance(address(admin), address(collateralAsset), collateralAsset.totalSupply());
            writeTokenBalance(address(admin), address(borrowAsset), borrowAsset.totalSupply());
            writeTokenBalance(address(admin), Constants.USDC, usdc.totalSupply());
            // weth.deposit{value: 1e30}();
            // IERC20(Constants.WETH).transfer(address(admin), 1e30);

            // setting price aggregator addresses
            collateralAssetAggregatorAddress = Constants.WBTC_priceFeedChainlink;
            borrowAssetAggregatorAddress = Constants.DAI_priceFeedChainlink;
            usdcAggregatorAddress = Constants.USDC_priceFeedChainlink;

            collateralCTokenAddress = Constants.cWBTC;
            borrowCTokenAddress = Constants.cDAI;

            // deploying compound yield contract
            compoundYieldAddress = admin.deployCompoundYield(
                address(admin),
                savingsAccountAddress,
                address(weth),
                protocolFeeCollectorAddress
            );

            // adding savings strategies to savings account
            admin.addSavingsAccountStrategy(strategyRegistryAddress, compoundYieldAddress);

            // adding cToken for collateralAsset
            admin.addTokenAddressForCompoundYield(payable(compoundYieldAddress), Constants.WBTC, Constants.cWBTC);
            admin.setDepositLimitForCompoundYield(payable(compoundYieldAddress), Constants.WBTC, type(uint256).max);
            admin.setDepositLimitForCompoundYield(payable(compoundYieldAddress), Constants.cWBTC, type(uint256).max);

            // adding cToken for borrowAsset
            admin.addTokenAddressForCompoundYield(payable(compoundYieldAddress), Constants.DAI, Constants.cDAI);
            admin.setDepositLimitForCompoundYield(payable(compoundYieldAddress), Constants.DAI, type(uint256).max);
            admin.setDepositLimitForCompoundYield(payable(compoundYieldAddress), Constants.cDAI, type(uint256).max);

            // adding token addresses for noYield
            admin.addTokenAddressForNoYield(noYieldAddress, Constants.WBTC);
            admin.addTokenAddressForNoYield(noYieldAddress, Constants.DAI);
        } else {
            // mock contract deployments
            vm.warp(block.timestamp + 10);

            //----------------------- Deployment code start -----------------------//

            // deploying mock tokens
            collateralAsset = new MockToken('CollateralAsset', 'MT1', 18, 1e40, address(admin));
            borrowAsset = new MockToken('BorrowAsset', 'MT2', 8, 1e40, address(admin));
            usdc = new MockToken('USDC', 'USDC', 6, 1e20, address(admin));
            weth = new MockWETH();

            // deploying price aggregators
            collateralAssetMockAggregator = new MockV3Aggregator(18, 12876423400040030304304);
            borrowAssetMockAggregator = new MockV3Aggregator(8, 195040576);
            usdcMockAggregator = new MockV3Aggregator(6, 1000000);

            // setting price aggregator addresses
            collateralAssetAggregatorAddress = address(collateralAssetMockAggregator);
            borrowAssetAggregatorAddress = address(borrowAssetMockAggregator);
            usdcAggregatorAddress = address(usdcMockAggregator);

            // deploying compound yield contract
            compoundYieldAddress = admin.deployCompoundYield(
                address(admin),
                savingsAccountAddress,
                address(weth),
                protocolFeeCollectorAddress
            );

            // adding savings strategies to savings account
            admin.addSavingsAccountStrategy(strategyRegistryAddress, compoundYieldAddress);

            // adding cToken for collateralAsset
            collateralCTokenAddress = admin.deployMockCToken(address(collateralAsset), compoundYieldAddress, noYieldAddress);
            admin.transferOwnership(address(collateralAsset), collateralCTokenAddress);

            // adding cToken for borrowAsset
            borrowCTokenAddress = admin.deployMockCToken(address(borrowAsset), compoundYieldAddress, noYieldAddress);
            admin.transferOwnership(address(borrowAsset), borrowCTokenAddress);
        }

        // deploying price oracle
        priceOracleAddress = admin.deployPriceOracle(address(admin), CLConstants.uniswapPriceAveragingPeriod);

        // adding aggregators to price oracle contract
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

        // deploying credit line contract
        creditLineAddress = admin.deployCLContracts(
            address(usdc),
            priceOracleAddress,
            savingsAccountAddress,
            strategyRegistryAddress,
            protocolFeeCollectorAddress
        );

        //----------------------- Deployment code end -----------------------//

        admin.updateBorrowLimitLimits(CLConstants.minBorrowLimit, CLConstants.maxBorrowLimit, creditLineAddress);
        admin.updateIdealCollateralRatioLimits(CLConstants.minCollateralRatio, CLConstants.maxCollteralRatio, creditLineAddress);
        admin.updateBorrowRateLimits(CLConstants.minBorrowRate, CLConstants.maxBorrowRate, creditLineAddress);
    }

    function goToActiveStage() public returns (uint256) {
        uint256 _id = borrower.createRequest(creditLineAddress, requestData);

        getCreditlineConstants(_id);

        if (requestData.requestAsLender) {
            assertEq(constantsCheck.lender, address(borrower));
            assertEq(constantsCheck.borrower, requestData.requestTo);
        } else {
            assertEq(constantsCheck.lender, requestData.requestTo);
            assertEq(constantsCheck.borrower, address(borrower));
        }
        assertEq(constantsCheck.borrowLimit, requestData.borrowLimit);
        assertEq(constantsCheck.idealCollateralRatio, requestData.collateralRatio);
        assertEq(constantsCheck.borrowRate, requestData.borrowRate);
        assertEq(constantsCheck.borrowAsset, requestData.borrowAsset);
        assertEq(constantsCheck.collateralAsset, requestData.collateralAsset);
        assertEq(constantsCheck.collateralStrategy, requestData.collateralStrategy);

        uint256 status = uint256(CreditLine(creditLineAddress).getCreditLineStatus(_id));
        assertEq(status, 1); // Checking if creditLine status is updated to REQUESTED

        CLUser requestedLender = CLUser(requestData.requestTo);
        requestedLender.acceptRequest(creditLineAddress, _id);

        status = uint256(CreditLine(creditLineAddress).getCreditLineStatus(_id));
        assertEq(status, 2); // Checking if creditLine status is updated to ACTIVE

        return (_id);
    }

    function savingsAccount_depositHelper(
        address _user,
        address _asset,
        address _strategy,
        uint256 _amount
    ) public {
        CLUser user = CLUser(_user);

        // mint tokens for user
        admin.transferToken(_asset, address(user), _amount);

        // set token allowance
        user.setAllowance(savingsAccountAddress, _asset, _amount);
        user.setAllowance(_strategy, _asset, _amount);

        // set savings account allowance
        user.setAllowanceForSavingsAccount(savingsAccountAddress, _asset, creditLineAddress, _amount);

        // deposit into savings account
        user.savingsAccountDeposit(savingsAccountAddress, _asset, _strategy, address(user), _amount);
    }

    function getCreditlineConstants(uint256 _id) public {
        (
            bool _autoLiquidation,
            bool _requestByLender,
            uint256 _borrowLimit,
            uint256 _borrowRate,
            uint256 _idealCollateralRatio,
            address _lender,
            address _borrower,
            address _borrowAsset,
            address _borrowAssetStrategy,
            address _collateralAsset,
            address _collateralStrategy
        ) = CreditLine(creditLineAddress).creditLineConstants(_id);

        constantsCheck.autoLiquidation = _autoLiquidation;
        constantsCheck.requestByLender = _requestByLender;
        constantsCheck.borrowLimit = _borrowLimit;
        constantsCheck.borrowRate = _borrowRate;
        constantsCheck.idealCollateralRatio = _idealCollateralRatio;
        constantsCheck.lender = _lender;
        constantsCheck.borrower = _borrower;
        constantsCheck.borrowAsset = _borrowAsset;
        constantsCheck.borrowAssetStrategy = _borrowAssetStrategy;
        constantsCheck.collateralAsset = _collateralAsset;
        constantsCheck.collateralStrategy = _collateralStrategy;
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

    function compareStrings(string memory a, string memory b) public pure returns (bool) {
        return (keccak256(abi.encodePacked((a))) == keccak256(abi.encodePacked((b))));
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
        uint256 _totalSupply = IERC20(token).totalSupply();
        stdstore.target(token).sig(IERC20(token).totalSupply.selector).checked_write(_totalSupply + amt);
        stdstore.target(token).sig(IERC20(token).balanceOf.selector).with_key(who).checked_write(_totalSupply + amt);
    }

    function _increaseBlock(uint256 _time) public {
        vm.warp(_time);
        vm.roll(_time.div(BLOCK_TIME));
    }
}
