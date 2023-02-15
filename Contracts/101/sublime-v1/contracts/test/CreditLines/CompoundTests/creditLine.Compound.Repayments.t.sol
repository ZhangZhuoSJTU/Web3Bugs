pragma solidity 0.7.6;
pragma abicoder v2;

import '../creditLine.Repayments.t.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';

contract CreditLine_Compound_RepaymentTests is CreditLine_RepaymentTests {
    using SafeMath for uint256;

    function setUp() public override {
        CLSetUp();

        creditLine = CreditLine(creditLineAddress);
        priceOracle = PriceOracle(priceOracleAddress);

        (uint256 _ratioOfPrices, uint256 _decimals) = priceOracle.getLatestPrice(address(usdc), address(borrowAsset));

        requestData.requestTo = address(lender);
        // Borrow Asset equivalent of 1,000,000,000 in USD
        requestData.borrowLimit = uint128(uint256(CLConstants.maxBorrowLimit / 1e6).mul(_ratioOfPrices).div(10**_decimals));
        requestData.borrowRate = CLConstants.maxBorrowRate / 1e18;
        requestData.autoLiquidation = false;
        requestData.collateralRatio = CLConstants.maxCollteralRatio / 1e18;
        requestData.borrowAsset = address(borrowAsset);
        requestData.collateralAsset = address(collateralAsset);
        requestData.requestAsLender = false;

        requestData.borrowAssetStrategy = compoundYieldAddress;
        requestData.collateralStrategy = compoundYieldAddress;

        // Adding addresses to array
        userList.push(address(admin));
        userList.push(address(borrower));
        userList.push(address(lender));
        userList.push(address(liquidator));

        creditLineId = goToActiveStage();

        amount = 10**(ERC20(address(collateralAsset)).decimals());

        // Adding tokens to borrower and setting allowance for creditline contract
        admin.transferToken(address(collateralAsset), address(borrower), amount.div(1000));
        borrower.setAllowance(address(creditLine), address(collateralAsset), amount.div(1000));

        borrower.addCollateral(address(creditLine), creditLineId, amount.div(1000), false);

        uint256 borrowable = creditLine.calculateBorrowableAmount(creditLineId);

        // Adding tokens to lender and depositing to lender's savings Account
        savingsAccount_depositHelper(address(lender), address(borrowAsset), requestData.borrowAssetStrategy, borrowable);

        borrower.borrow(address(creditLine), creditLineId, borrowable);

        // Time travel by 10 days
        vm.warp(block.timestamp + 10 days);
    }
}
