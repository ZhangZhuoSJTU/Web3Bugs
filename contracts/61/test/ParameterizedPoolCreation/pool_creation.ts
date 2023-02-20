import { poolCreationTest } from '../../utils/TestTemplate/PoolCreationTemplate';
import { poolCreationTestCases as testCases } from '../../utils/TestCases/pool_creation_test_cases';

xdescribe('Testing pool creation', function () {
    testCases.forEach((testCase) => {
        poolCreationTest(
            testCase.Amount,
            testCase.Whale1,
            testCase.Whale2,
            testCase.BorrowTokenParam,
            testCase.CollateralTokenParam,
            testCase.liquidityBorrowTokenParam,
            testCase.liquidityCollateralTokenParam,
            testCase.chainlinkBorrowParam,
            testCase.chainlinkCollateralParam
        );
    });
});
