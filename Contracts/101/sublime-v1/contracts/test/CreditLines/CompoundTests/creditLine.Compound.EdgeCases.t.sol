pragma solidity 0.7.6;
pragma abicoder v2;

import '../creditLine.EdgeCases.t.sol';

contract CreditLine_Compound_EdgeCaseTests is CreditLine_EdgeCaseTests {
    function setUp() public override {
        super.setUp();

        requestData.borrowAssetStrategy = compoundYieldAddress;
        requestData.collateralStrategy = compoundYieldAddress;
    }
}
