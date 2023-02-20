pragma solidity 0.7.6;
pragma abicoder v2;

import '../creditLine.HelperFunctions.t.sol';

contract CreditLine_Compound_HelperFunctionTests is CreditLine_HelperFunctionTests {
    function setUp() public override {
        super.setUp();

        requestData.borrowAssetStrategy = compoundYieldAddress;
        requestData.collateralStrategy = compoundYieldAddress;

        creditLineId = goToActiveStage();

        // Setting global parameters
        borrowAssetStrategy = requestData.borrowAssetStrategy;
        collateralStrategy = requestData.collateralStrategy;
    }
}
