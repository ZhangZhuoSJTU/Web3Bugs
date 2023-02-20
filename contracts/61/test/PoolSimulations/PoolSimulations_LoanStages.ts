import { compoundPoolCollectionStage } from '../../utils/TestTemplate/Compound_poolLoanStages';
import { yearnPoolCollectionStage } from '../../utils/TestTemplate/Yearn_poolLoanStages';
import { psLoanStagesTestCases as testCases } from '../../utils/TestCases/pool_simulations_loan_stages_test_cases';
import { psYearnTestCases as YearnTestcases } from '../../utils/TestCases/pool_simulations_yearn_test_cases';

describe('Pool simulation using Compound strategy', function () {
    testCases.forEach((testCase) => {
        compoundPoolCollectionStage(
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

// xdescribe('Pool simulation using Yearn strategy', function () {
//     YearnTestcases.forEach((testCase) => {
//         yearnPoolCollectionStage(
//             testCase.Amount,
//             testCase.Whale1,
//             testCase.Whale2,
//             testCase.BorrowTokenParam,
//             testCase.CollateralTokenParam,
//             testCase.liquidityBorrowTokenParam,
//             testCase.liquidityCollateralTokenParam,
//             testCase.chainlinkBorrowParam,
//             testCase.chainlinkCollateralParam
//         );
//     });
// });
