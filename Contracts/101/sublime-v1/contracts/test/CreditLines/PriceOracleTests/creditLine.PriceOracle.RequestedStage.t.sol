pragma solidity 0.7.6;
pragma abicoder v2;

import '../Helpers/CLParent.sol';
import '../Helpers/CLConstants.sol';
import '../../../PriceOracle.sol';

import '@openzeppelin/contracts/math/SafeMath.sol';

contract CreditLine_PriceOracle_RequestedStageTests is CLParent {
    using SafeMath for uint256;

    CreditLine cl;
    PriceOracle priceOracle;

    uint256 creditLineId;

    function setUp() public {
        CLSetUp();

        cl = CreditLine(creditLineAddress);
        priceOracle = PriceOracle(priceOracleAddress);

        (uint256 _ratioOfPrices, uint256 _decimals) = priceOracle.getLatestPrice(address(usdc), address(borrowAsset));

        requestData.requestTo = address(lender);
        // Borrow Asset equivalent of 1,000,000,000 in USD
        requestData.borrowLimit = uint128(uint256(CLConstants.maxBorrowLimit / 1e6).mul(_ratioOfPrices).div(10**_decimals));
        requestData.borrowRate = CLConstants.maxBorrowRate / 1e18;
        requestData.autoLiquidation = false;
        requestData.collateralRatio = (CLConstants.maxCollteralRatio / 1e12) * 200;
        requestData.borrowAsset = address(borrowAsset);
        requestData.borrowAssetStrategy = noYieldAddress;
        requestData.collateralAsset = address(collateralAsset);
        requestData.collateralStrategy = noYieldAddress;
        requestData.requestAsLender = false;

        creditLineId = borrower.createRequest(creditLineAddress, requestData);
        assert_creditlineConstantsAndStatus(creditLineId, address(borrower), requestData);
    }

    //----------------------- Accept function with asset price variation, passing tests -----------------------//

    // Any change in price should not affect the accept funtion
    function test_accept_fuzzPrices(uint128 borrowAssetPrice, uint128 collateralAssetPrice) public {
        // setting asset prices
        setAggregatorPrice(borrowAssetPrice, collateralAssetPrice);

        lender.acceptRequest(creditLineAddress, creditLineId);

        uint256 status = uint256(cl.getCreditLineStatus(creditLineId));
        assertEq(status, 2); // Checking if creditLine status is updated to ACTIVE
    }

    // (0,0) price should not affect the accept funtion
    function test_accept_POZero1() public {
        // setting both asset prices to zero
        setAggregatorPrice(0, 0);

        lender.acceptRequest(creditLineAddress, creditLineId);

        uint256 status = uint256(cl.getCreditLineStatus(creditLineId));
        assertEq(status, 2); // Checking if creditLine status is updated to ACTIVE
    }

    // Zero asset price should not affect the accept funtion
    function test_accept_POZero2() public {
        // setting borrow asset price to zero
        setAggregatorPrice(0, 1000000);

        lender.acceptRequest(creditLineAddress, creditLineId);

        uint256 status = uint256(cl.getCreditLineStatus(creditLineId));
        assertEq(status, 2); // Checking if creditLine status is updated to ACTIVE
    }

    // Zero asset price should not affect the accept funtion
    function test_accept_POZero3() public {
        // setting collateral asset price to zero
        setAggregatorPrice(195040576, 0);

        lender.acceptRequest(creditLineAddress, creditLineId);

        uint256 status = uint256(cl.getCreditLineStatus(creditLineId));
        assertEq(status, 2); // Checking if creditLine status is updated to ACTIVE
    }

    // Any change in ratio of prices should not affect the accept funtion
    function test_accept_POFluctuations1() public {
        // Initial prices //
        // usdc Asset: 1000000 //
        // borrow Asset: 195040576 //

        // switching asset prices
        // ratio of prices becomes inverse of original
        setAggregatorPrice(1000000, 195040576);

        lender.acceptRequest(creditLineAddress, creditLineId);

        uint256 status = uint256(cl.getCreditLineStatus(creditLineId));
        assertEq(status, 2); // Checking if creditLine status is updated to ACTIVE
    }

    // Price going down by half should not affect the accept funtion
    function test_accept_POFluctuations2() public {
        // Initial prices //
        // usdc Asset: 1000000 //
        // borrow Asset: 195040576 //

        // setting asset prices to half their original value
        setAggregatorPrice(195040576 / 2, 1000000 / 2);

        lender.acceptRequest(creditLineAddress, creditLineId);

        uint256 status = uint256(cl.getCreditLineStatus(creditLineId));
        assertEq(status, 2); // Checking if creditLine status is updated to ACTIVE
    }

    // Raio_of_price = 1, should not affect the accept funtion
    function test_accept_POFluctuations3() public {
        // Initial prices //
        // usdc Asset: 1000000 //
        // borrow Asset: 195040576 //

        // setting asset prices to same prices
        // ratio of prices become 1
        setAggregatorPrice(195040576, 195040576);

        lender.acceptRequest(creditLineAddress, creditLineId);

        uint256 status = uint256(cl.getCreditLineStatus(creditLineId));
        assertEq(status, 2); // Checking if creditLine status is updated to ACTIVE
    }

    //----------------------- Cancel function with asset price variation, passing tests -----------------------//

    // Any change in price should not affect the cancel funtion
    function test_cancel_fuzzPrices(uint128 borrowAssetPrice, uint128 collateralAssetPrice) public {
        // setting asset prices
        setAggregatorPrice(borrowAssetPrice, collateralAssetPrice);

        lender.cancelRequest(creditLineAddress, creditLineId);

        uint256 status = uint256(cl.getCreditLineStatus(creditLineId));
        assertEq(status, 0); // Checking if creditLine status is updated to ACTIVE
    }

    // (0,0) price should not affect the cancel funtion
    function test_cancel_POZero1() public {
        // setting both asset prices to zero
        setAggregatorPrice(0, 0);

        lender.cancelRequest(creditLineAddress, creditLineId);

        uint256 status = uint256(cl.getCreditLineStatus(creditLineId));
        assertEq(status, 0); // Checking if creditLine status is updated to ACTIVE
    }

    // Zero asset price should not affect the cancel funtion
    function test_cancel_POZero2() public {
        // setting borrow asset price to zero
        setAggregatorPrice(0, 1000000);

        lender.cancelRequest(creditLineAddress, creditLineId);

        uint256 status = uint256(cl.getCreditLineStatus(creditLineId));
        assertEq(status, 0); // Checking if creditLine status is updated to ACTIVE
    }

    // Zero asset price should not affect the cancel funtion
    function test_cancel_POZero3() public {
        // setting collateral asset price to zero
        setAggregatorPrice(195040576, 0);

        lender.cancelRequest(creditLineAddress, creditLineId);

        uint256 status = uint256(cl.getCreditLineStatus(creditLineId));
        assertEq(status, 0); // Checking if creditLine status is updated to ACTIVE
    }

    // Any change in ratio of prices should not affect the cancel funtion
    function test_cancel_POFluctuations1() public {
        // Initial prices //
        // usdc Asset: 1000000 //
        // borrow Asset: 195040576 //

        // switching asset prices
        // ratio of prices becomes inverse of original
        setAggregatorPrice(1000000, 195040576);

        lender.cancelRequest(creditLineAddress, creditLineId);

        uint256 status = uint256(cl.getCreditLineStatus(creditLineId));
        assertEq(status, 0); // Checking if creditLine status is updated to ACTIVE
    }

    // Prices going down to half should not affect the cancel funtion
    function test_cancel_POFluctuations2() public {
        // Initial prices //
        // usdc Asset: 1000000 //
        // borrow Asset: 195040576 //

        // setting asset prices to half their initial value
        setAggregatorPrice(195040576 / 2, 1000000 / 2);

        lender.cancelRequest(creditLineAddress, creditLineId);

        uint256 status = uint256(cl.getCreditLineStatus(creditLineId));
        assertEq(status, 0); // Checking if creditLine status is updated to ACTIVE
    }

    // Ratio_of_prices = 1, should not affect the cancel funtion
    function test_cancel_POFluctuations3() public {
        // Initial prices //
        // test Asset: 295040576 //
        // borrow Asset: 195040576 //

        // setting asset prices to same prices
        // ratio of prices become 1
        setAggregatorPrice(195040576, 195040576);

        lender.cancelRequest(creditLineAddress, creditLineId);

        uint256 status = uint256(cl.getCreditLineStatus(creditLineId));
        assertEq(status, 0); // Checking if creditLine status is updated to ACTIVE
    }

    //----------------------- updateBorrowLimit function with asset price variation, failing tests -----------------------//

    // (0,0) price should fail the updateBorrowLimit funtion
    function test_updateBorrowLimit_POZero1() public {
        // setting both asset prices to zero
        setAggregatorPrice(0, 0);

        try lender.updateBorrowLimit(creditLineAddress, creditLineId, 1e13) {
            revert('Both asset prices are zero');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:ILB1');
        }
    }

    // Zero asset price should fail for the updateBorrowLimit funtion
    function test_updateBorrowLimit_POZero2() public {
        // setting borrow asset price to zero
        setAggregatorPrice(0, 1000000);

        try lender.updateBorrowLimit(creditLineAddress, creditLineId, 1e13) {
            revert('Borrow asset price is zero');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:ILB1');
        }
    }

    // Zero collateral asset price should pass for the updateBorrowLimit funtion
    function test_updateBorrowLimit_POZero3() public {
        // setting collateral asset price to zero
        setAggregatorPrice(195040576, 0);

        try lender.updateBorrowLimit(creditLineAddress, creditLineId, 1e13) {
            revert('USDC asset price is zero');
        } catch Error(string memory reason) {
            assertEq(reason, 'CL:ILB1');
        }
    }

    //----------------------- updateBorrowLimit function with asset price variation, passing tests -----------------------//

    // Any change in price should not affect the updateBorrowLimit funtion, except zero values
    function test_updateBorrowLimit_fuzzPrices(uint128 borrowAssetPrice, uint128 collateralAssetPrice) public {
        // setting asset prices
        setAggregatorPrice(borrowAssetPrice, collateralAssetPrice);

        try lender.updateBorrowLimit(creditLineAddress, creditLineId, 1e13) {
            assert_creditlineBorrowLimit(creditLineId, 1e13);
        } catch Error(string memory reason) {
            if (compareStrings(reason, 'PO:GLP1')) {
                emit log_string('PO:GLP1');
            } else if (compareStrings(reason, 'CL:ILB1')) {
                emit log_string('CL:ILB1');
            } else {
                revert(reason);
            }
        }
    }

    // Any change in ratio of prices should not affect the updateBorrowLimit funtion
    function test_updateBorrowLimit_POFluctuations1() public {
        // Initial prices //
        // usdc Asset: 1000000 //
        // borrow Asset: 195040576 //

        // switching asset prices
        // ratio of prices becomes inverse of original
        setAggregatorPrice(1000000, 195040576);

        lender.updateBorrowLimit(creditLineAddress, creditLineId, 1e13);

        assert_creditlineBorrowLimit(creditLineId, 1e13);
    }

    // Prices going down to half should not affect the updateBorrowLimit funtion
    function test_updateBorrowLimit_POFluctuations2() public {
        // Initial prices //
        // usdc Asset: 1000000 //
        // borrow Asset: 195040576 //

        // setting asset prices to half their initial value
        setAggregatorPrice(195040576 / 2, 1000000 / 2);

        lender.updateBorrowLimit(creditLineAddress, creditLineId, 1e9);

        assert_creditlineBorrowLimit(creditLineId, 1e9);
    }

    // Ratio_of_prices = 1, should not affect the updateBorrowLimit funtion
    function test_updateBorrowLimit_POFluctuations3() public {
        // Initial prices //
        // usdc Asset: 1000000 //
        // borrow Asset: 195040576 //

        // setting asset prices to same prices
        // ratio of prices become 1
        setAggregatorPrice(195040576, 195040576);

        lender.updateBorrowLimit(creditLineAddress, creditLineId, 1e13);

        assert_creditlineBorrowLimit(creditLineId, 1e13);
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

        uint256 status = uint256(cl.getCreditLineStatus(creditLineId));
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

    function assert_creditlineBorrowLimit(uint256 _creditLineId, uint256 _newBorrowLimit) public {
        getCreditlineConstants(_creditLineId);

        assertEq(constantsCheck.borrowLimit, _newBorrowLimit);
    }
}
