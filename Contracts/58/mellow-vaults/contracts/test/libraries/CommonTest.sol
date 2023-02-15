// SPDX-License-Identifier: BUSL-1.1
pragma solidity =0.8.9;

import "../../libraries/CommonLibrary.sol";

contract CommonTest {
    constructor() {}

    function bubbleSort(address[] memory arr) external pure returns (address[] memory) {
        CommonLibrary.bubbleSort(arr);
        return arr;
    }

    function isSortedAndUnique(address[] memory tokens) external pure returns (bool) {
        return CommonLibrary.isSortedAndUnique(tokens);
    }

    function projectTokenAmountsTest(
        address[] memory tokens,
        address[] memory tokensToProject,
        uint256[] memory tokenAmountsToProject
    ) external pure returns (uint256[] memory) {
        return CommonLibrary.projectTokenAmounts(tokens, tokensToProject, tokenAmountsToProject);
    }

    function splitAmountsTest(uint256[] memory amounts, uint256[][] memory weights)
        external
        pure
        returns (uint256[][] memory)
    {
        return CommonLibrary.splitAmounts(amounts, weights);
    }

    function isContractTest(address addr) external view returns (bool) {
        return CommonLibrary.isContract(addr);
    }
}
