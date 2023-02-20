pragma solidity 0.7.6;
pragma abicoder v2;

import '../creditLine.Lifecycle.t.sol';

contract CreditLine_Compound_LifecycleTests is CreditLine_LifecycleTests {
    function setUp() public override {
        super.setUp();

        requestData.borrowAssetStrategy = compoundYieldAddress;
        requestData.collateralStrategy = compoundYieldAddress;
    }
}
