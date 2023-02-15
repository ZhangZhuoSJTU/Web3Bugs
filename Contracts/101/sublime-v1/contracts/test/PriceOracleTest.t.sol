// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import 'forge-std/Test.sol';
import '../PriceOracle.sol';
import './Constants.sol';
import '../mocks/MockToken.sol';
import '../mocks/MockV3Aggregator.sol';
import './roles/Admin.sol';

contract PriceOracleTest is Test {
    PriceOracle priceOracle;
    bool isForked;
    IERC20 public collateralAsset;
    IERC20 public borrowAsset;
    address public collateralAssetAggregatorAddress;
    address public borrowAssetAggregatorAddress;
    address uniswapPoolAddress;
    uint32 uniswapPriceAveragingPeriod;

    function setCollateralAsset() public {
        if (isForked) {
            collateralAsset = ERC20(Constants.WBTC);
            collateralAssetAggregatorAddress = Constants.WBTC_priceFeedChainlink;
        } else {
            collateralAsset = new MockToken('CollateralAsset', 'MT1', 18, 1e40, address(this));
            collateralAssetAggregatorAddress = address(new MockV3Aggregator(18, 12876423400040030304304));
        }
    }

    function setBorrowAsset() public {
        if (isForked) {
            borrowAsset = ERC20(Constants.DAI);
            borrowAssetAggregatorAddress = Constants.DAI_priceFeedChainlink;
        } else {
            borrowAsset = new MockToken('BorrowAsset', 'MT2', 8, 1e40, address(this));
            borrowAssetAggregatorAddress = address(new MockV3Aggregator(8, 195040576));
        }
    }

    function setUp() public {
        uint256 _chainId = getChainID();
        if (_chainId == 1) {
            isForked = true;
        }
        priceOracle = new PriceOracle(1 days);
        uniswapPriceAveragingPeriod = 10;
        priceOracle.initialize(address(this), uniswapPriceAveragingPeriod);
        assertTrue(address(priceOracle) != address(0));
        setBorrowAsset();
        setCollateralAsset();
        uniswapPoolAddress = Constants.WBTC_DAI_priceFeedUniswap;
    }

    function test_fail_doesFeedExist_chainLink() public {
        assertFalse(priceOracle.doesFeedExist(address(borrowAsset), address(collateralAsset)));
        assertFalse(priceOracle.doesFeedExist(address(collateralAsset), address(borrowAsset)));
    }

    function test_doesFeedExist_chainLink() public {
        priceOracle.setChainlinkFeedAddress(address(collateralAsset), collateralAssetAggregatorAddress, 1 days);
        priceOracle.setChainlinkFeedAddress(address(borrowAsset), borrowAssetAggregatorAddress, 1 days);
        assertTrue(priceOracle.doesFeedExist(address(borrowAsset), address(collateralAsset)));
        assertTrue(priceOracle.doesFeedExist(address(collateralAsset), address(borrowAsset)));
    }

    function test_doesFeedExist_uniswap() public {
        priceOracle.setUniswapFeedAddress(address(borrowAsset), address(collateralAsset), uniswapPoolAddress);
        assertTrue(priceOracle.doesFeedExist(address(borrowAsset), address(collateralAsset)));
        assertTrue(priceOracle.doesFeedExist(address(collateralAsset), address(borrowAsset)));
    }

    function test_setUniswapFeedAddress() public {
        try priceOracle.setUniswapFeedAddress(address(borrowAsset), address(borrowAsset), address(0)) {
            revert('setUniswapFeedAddress should fail');
        } catch Error(string memory reason) {
            assertEq(reason, 'PO:SUFA1');
        }
    }

    function test_setChainlinkFeedAddress_fail_1() public {
        try priceOracle.setChainlinkFeedAddress(address(0), collateralAssetAggregatorAddress, 1 days) {
            revert('setChainlinkFeedAddress should fail');
        } catch Error(string memory reason) {
            assertEq(reason, 'PO:IGD1');
        }
    }

    function test_setChainlinkFeedAddress_fail_2() public {
        try priceOracle.setChainlinkFeedAddress(address(collateralAsset), collateralAssetAggregatorAddress, 2 days) {
            revert('setChainlinkFeedAddress should fail');
        } catch Error(string memory reason) {
            assertEq(reason, 'PO:SCFA1');
        }
    }

    event UniswapPriceAveragingPeriodUpdated(uint32 uniswapPriceAveragingPeriod);

    function test_setUniswapPriceAveragingPeriod() public {
        vm.expectEmit(true, true, true, true);
        emit UniswapPriceAveragingPeriodUpdated(uniswapPriceAveragingPeriod + 100);
        priceOracle.setUniswapPriceAveragingPeriod(uniswapPriceAveragingPeriod + 100);
    }

    function test_fail_setUniswapPriceAveragingPeriod() public {
        try priceOracle.setUniswapPriceAveragingPeriod(0) {
            revert('setUniswapPriceAveragingPeriod should fail');
        } catch Error(string memory reason) {
            assertEq(reason, 'PO:ISUPAP1');
        }
        try priceOracle.setUniswapPriceAveragingPeriod(uniswapPriceAveragingPeriod) {
            revert('setUniswapPriceAveragingPeriod should fail');
        } catch Error(string memory reason) {
            assertEq(reason, 'PO:ISUPAP2');
        }
    }

    function test_getLatestPrice_chainLink() public {
        priceOracle.setChainlinkFeedAddress(address(collateralAsset), collateralAssetAggregatorAddress, 1 days);
        priceOracle.setChainlinkFeedAddress(address(borrowAsset), borrowAssetAggregatorAddress, 1 days);

        (uint256 _price, uint256 _decimals) = priceOracle.getLatestPrice(address(borrowAsset), address(collateralAsset));
        assertTrue(_decimals == 18);
        assertTrue(_price > 0);
    }

    function test_getLatestPrice_uniswap() public {
        if (isForked) {
            priceOracle.setUniswapFeedAddress(address(borrowAsset), address(collateralAsset), uniswapPoolAddress);
            (uint256 _price, uint256 _decimals) = priceOracle.getLatestPrice(address(borrowAsset), address(collateralAsset));
            assertTrue(_decimals == 18);
            assertTrue(_price > 0);
        }
    }

    function test_getLatestPrice_uniswap_2() public {
        (uint256 _price, uint256 _decimals) = priceOracle.getUniswapLatestPrice(address(borrowAsset), address(collateralAsset));
        assertTrue(_price == 0);
        assertTrue(_decimals == 0);
    }

    function test_fail_getLatestPrice_1() public {
        priceOracle.setUniswapFeedAddress(address(borrowAsset), address(collateralAsset), address(0));
        try priceOracle.getLatestPrice(address(borrowAsset), address(collateralAsset)) {
            revert('getLatestPrice should fail');
        } catch Error(string memory reason) {
            assertEq(reason, 'PO:GLP1');
        }
    }

    function test_fail_getLatestPrice_2() public {
        priceOracle.setChainlinkFeedAddress(address(collateralAsset), collateralAssetAggregatorAddress, 1 days);
        priceOracle.setChainlinkFeedAddress(address(borrowAsset), borrowAssetAggregatorAddress, 1 days);

        vm.mockCall(
            address(borrowAssetAggregatorAddress),
            abi.encodeWithSelector(AggregatorV3Interface.latestRoundData.selector),
            abi.encode(1, 0, block.timestamp, block.timestamp, 2)
        );

        try priceOracle.getLatestPrice(address(borrowAsset), address(collateralAsset)) {
            revert('getLatestPrice should fail');
        } catch Error(string memory reason) {
            assertEq(reason, 'PO:GLP1');
        }
    }

    function test_fail_getLatestPrice_3() public {
        priceOracle.setChainlinkFeedAddress(address(collateralAsset), collateralAssetAggregatorAddress, 1 days);
        priceOracle.setChainlinkFeedAddress(address(borrowAsset), borrowAssetAggregatorAddress, 1 days);

        vm.mockCall(
            address(borrowAssetAggregatorAddress),
            abi.encodeWithSelector(AggregatorV3Interface.latestRoundData.selector),
            abi.encode(4, 10, block.timestamp, block.timestamp, 1)
        );

        try priceOracle.getLatestPrice(address(borrowAsset), address(collateralAsset)) {
            revert('getLatestPrice should fail');
        } catch Error(string memory reason) {
            assertEq(reason, 'PO:GLP1');
        }
    }

    function test_fail_getLatestPrice_4() public {
        priceOracle.setChainlinkFeedAddress(address(collateralAsset), collateralAssetAggregatorAddress, 1 days);
        priceOracle.setChainlinkFeedAddress(address(borrowAsset), borrowAssetAggregatorAddress, 1 days);

        vm.mockCall(
            address(collateralAssetAggregatorAddress),
            abi.encodeWithSelector(AggregatorV3Interface.latestRoundData.selector),
            abi.encode(1, 0, block.timestamp, block.timestamp, 2)
        );

        try priceOracle.getLatestPrice(address(borrowAsset), address(collateralAsset)) {
            revert('getLatestPrice should fail');
        } catch Error(string memory reason) {
            assertEq(reason, 'PO:GLP1');
        }
    }

    function test_fail_getLatestPrice_5() public {
        priceOracle.setChainlinkFeedAddress(address(collateralAsset), collateralAssetAggregatorAddress, 1 days);
        priceOracle.setChainlinkFeedAddress(address(borrowAsset), borrowAssetAggregatorAddress, 1 days);

        vm.mockCall(
            address(collateralAssetAggregatorAddress),
            abi.encodeWithSelector(AggregatorV3Interface.latestRoundData.selector),
            abi.encode(4, 10, block.timestamp, block.timestamp, 2)
        );

        try priceOracle.getLatestPrice(address(borrowAsset), address(collateralAsset)) {
            revert('getLatestPrice should fail');
        } catch Error(string memory reason) {
            assertEq(reason, 'PO:GLP1');
        }
    }

    function getChainID() internal pure returns (uint256) {
        uint256 id;
        assembly {
            id := chainid()
        }
        return id;
    }
}
