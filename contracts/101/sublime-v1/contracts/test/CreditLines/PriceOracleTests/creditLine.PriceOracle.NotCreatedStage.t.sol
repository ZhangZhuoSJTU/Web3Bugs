pragma solidity 0.7.6;
pragma abicoder v2;

import '../Helpers/CLParent.sol';
import '../../../PriceOracle.sol';

import '@openzeppelin/contracts/math/SafeMath.sol';

contract CreditLine_PriceOracle_NotCreatedStageTests is CLParent {
    using SafeMath for uint256;

    CreditLine cl;
    PriceOracle priceOracle;

    function setUp() public {
        CLSetUp();

        cl = CreditLine(creditLineAddress);
        priceOracle = PriceOracle(priceOracleAddress);

        (uint256 _ratioOfPrices, uint256 _decimals) = priceOracle.getLatestPrice(address(usdc), address(borrowAsset));

        requestData.requestTo = address(lender);
        // Borrow Asset equivalent of 1,000 in USD
        requestData.borrowLimit = uint128(uint256(CLConstants.maxBorrowLimit / 1e12).mul(_ratioOfPrices).div(10**_decimals));
        requestData.borrowRate = CLConstants.maxBorrowRate / 1e18;
        requestData.autoLiquidation = false;
        requestData.collateralRatio = (CLConstants.maxCollteralRatio / 1e12) * 200;
        requestData.borrowAsset = address(borrowAsset);
        requestData.borrowAssetStrategy = noYieldAddress;
        requestData.collateralAsset = address(collateralAsset);
        requestData.collateralStrategy = noYieldAddress;
        requestData.requestAsLender = false;
    }

    //----------------------- Request function with asset price variation, failing tests -----------------------//

    // Request should fail if both asset prices are zero
    function test_request_POZero1() public {
        // setting both asset prices to zero
        setAggregatorPrice(0, 0);

        try borrower.createRequest(creditLineAddress, requestData) {
            revert('Both prices are zero');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:ILB1');
        }
    }

    // Request should fail if borrow asset price goes to zero
    function test_request_POZero2() public {
        // setting borrow asset price to zero
        setAggregatorPrice(0, 1000000);

        try borrower.createRequest(creditLineAddress, requestData) {
            revert('Borrow asset price is zero');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:ILB1');
        }
    }

    // Request should fail if usdc asset price goes to zero
    function test_request_POZero3() public {
        // setting collateral asset price to zero
        setAggregatorPrice(195040576, 0);

        try borrower.createRequest(creditLineAddress, requestData) {
            revert('USDC asset price is zero');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:ILB1');
        }
    }

    //----------------------- Request function with asset price variation, passing tests -----------------------//

    function test_fuzzPrices(uint128 _borrowAssetPrice, uint128 _USDCAssetPrice) public {
        uint256 borrowAssetPrice = scaleToRange256(_borrowAssetPrice, 1, type(uint128).max);
        uint256 USDCAssetPrice = scaleToRange256(_USDCAssetPrice, 1, type(uint128).max);

        // RatioOfPrice will not go beyond 1e30 in practical scenarios
        // Limiting RatioOfPrice.mul(1e18) <= 1e30
        if (USDCAssetPrice.div(borrowAssetPrice) <= 1e12) {
            // setting asset prices
            setAggregatorPrice(borrowAssetPrice, USDCAssetPrice);

            try borrower.createRequest(creditLineAddress, requestData) {
                assert_creditlineConstantsAndStatus(1, address(borrower), requestData);
            } catch Error(string memory reason) {
                assertEq(reason, 'CL:ILB1');
            }
        }
    }

    // Change in prices should not affect request function
    // Prices switched between collateral and borrow asset
    function test_request_POFluctuations1() public {
        // Initial prices //
        // test Asset: 295040576 //
        // usdc Asset: 1000000 //
        requestData.borrowLimit = CLConstants.maxBorrowLimit / 1e3;

        // switching asset prices
        // ratio of prices becomes inverse of original
        setAggregatorPrice(1000000, 295040576);

        uint256 creditLineId = borrower.createRequest(creditLineAddress, requestData);
        assert_creditlineConstantsAndStatus(creditLineId, address(borrower), requestData);
    }

    // Change in prices should not affect request function
    // Price fall to half of their value
    function test_request_POFluctuations2() public {
        // Initial prices //
        // usdc Asset: 1000000 //
        // borrow Asset: 195040576 //
        requestData.borrowLimit = CLConstants.maxBorrowLimit / 1e3;

        // setting asset prices to halves
        setAggregatorPrice(195040576 / 2, 1000000 / 2);

        uint256 creditLineId = borrower.createRequest(creditLineAddress, requestData);
        assert_creditlineConstantsAndStatus(creditLineId, address(borrower), requestData);
    }

    // Change in prices should not affect request function
    // Both prices become same value
    function test_request_POFluctuations3() public {
        // Initial prices //
        // usdc Asset: 1000000 //
        // borrow Asset: 195040576 //
        requestData.borrowLimit = CLConstants.maxBorrowLimit / 1e3;

        // setting asset prices to same prices
        // ratio of prices become 1
        setAggregatorPrice(195040576, 195040576);

        uint256 creditLineId = borrower.createRequest(creditLineAddress, requestData);
        assert_creditlineConstantsAndStatus(creditLineId, address(borrower), requestData);
    }

    //----------------------- Assert/helper functions -----------------------//

    function assert_creditlineConstantsAndStatus(
        uint256 _creditLineId,
        address _requestBy,
        CLConstants.RequestParams memory requestData
    ) public {
        getCreditlineConstants(_creditLineId);

        if (requestData.requestAsLender) {
            assertEq(constantsCheck.lender, _requestBy);
            assertEq(constantsCheck.borrower, requestData.requestTo);
        } else {
            assertEq(constantsCheck.lender, requestData.requestTo);
            assertEq(constantsCheck.borrower, _requestBy);
        }

        assertEq(constantsCheck.borrowLimit, requestData.borrowLimit);
        assertEq(constantsCheck.idealCollateralRatio, requestData.collateralRatio);
        assertEq(constantsCheck.borrowRate, requestData.borrowRate);
        assertEq(constantsCheck.borrowAsset, requestData.borrowAsset);
        assertEq(constantsCheck.borrowAssetStrategy, requestData.borrowAssetStrategy);
        assertEq(constantsCheck.collateralAsset, requestData.collateralAsset);
        assertEq(constantsCheck.collateralStrategy, requestData.collateralStrategy);

        uint256 status = uint256(cl.getCreditLineStatus(_creditLineId));
        assertEq(status, 1); // Checking if creditLine status is updated to REQUESTED
    }

    function setAggregatorPrice(uint256 borrowAssetPrice, uint256 usdcPrice) public {
        if (borrowAssetPrice == 0 || usdcPrice == 0) {
            vm.mockCall(
                priceOracleAddress,
                abi.encodeWithSelector(IPriceOracle.getLatestPrice.selector, address(borrowAsset), address(usdc)),
                abi.encode(0, 0) // price, decimals
            );
        } else {
            vm.mockCall(
                priceOracleAddress,
                abi.encodeWithSelector(IPriceOracle.getLatestPrice.selector, address(borrowAsset), address(usdc)),
                abi.encode(borrowAssetPrice.mul(1e18).div(usdcPrice), 18) // price, decimals
            );
        }
    }
}
