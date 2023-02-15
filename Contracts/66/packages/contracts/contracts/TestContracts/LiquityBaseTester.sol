// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.6.11;
// pragma experimental ABIEncoderV2;

import "../Dependencies/LiquityBase.sol";

// test contract to test Liquity base functions with custom newColls struct
contract LiquityBaseTester is LiquityBase {

    event Sum(address[] tokens, uint[] amounts);

    function setAddresses(address _whitelist, address _defaultPool, address _activePool) external {
        whitelist = IWhitelist(_whitelist);
        defaultPool = IDefaultPool(_defaultPool);
        activePool = IActivePool(_activePool);
    }

    function _toColls(address[] memory _colls, uint[] memory _amounts) internal pure returns (newColls memory colls) {
        colls.tokens = _colls;
        colls.amounts = _amounts;
    }

    function createCollExample() external pure returns (address[] memory tokens, uint[] memory amounts) {
        tokens = new address[](2);
        amounts = new uint[](2);
        tokens[0] = address(1);
        tokens[1] = address(2);
        amounts[0] = 1e18;
        amounts[1] = 2e18;
    }

    // call sumColls with two newColls struct
    function sumCollsTwoColls(address[] memory _tokens1, uint[] memory _amounts1,
                        address[] memory _tokens2, uint[] memory _amounts2) external returns
    (address[] memory, uint[] memory) {
        newColls memory resultOfSum = _sumColls(newColls(_tokens1, _amounts1), newColls(_tokens2, _amounts2));
        emit Sum(resultOfSum.tokens, resultOfSum.amounts);
        return (resultOfSum.tokens, resultOfSum.amounts);
    }

    // call sumColls with one newColls struct and one split into arrays
    function sumCollsOneCollsOneSplit(address[] memory _tokens1, uint[] memory _amounts1,
        address[] memory _tokens2, uint[] memory _amounts2) external returns
    (address[] memory, uint[] memory) {
        newColls memory resultOfSum = _sumColls(newColls(_tokens1, _amounts1), _tokens2, _amounts2);
        emit Sum(resultOfSum.tokens, resultOfSum.amounts);
        return (resultOfSum.tokens, resultOfSum.amounts);
    }

    // call sumColls with one newColls struct and one split into arrays
    function sumCollsTwoSplit(address[] memory _tokens1, uint[] memory _amounts1,
        address[] memory _tokens2, uint[] memory _amounts2) external returns
    (address[] memory, uint[] memory) {
        newColls memory resultOfSum = _sumColls(_tokens1, _amounts1, _tokens2, _amounts2);
        emit Sum(resultOfSum.tokens, resultOfSum.amounts);
        return (resultOfSum.tokens, resultOfSum.amounts);
    }

    // call _leftSumColls
    function leftSumColls(address[] memory _tokens1, uint[] memory _amounts1,
        address[] memory _tokens2, uint[] memory _amounts2) external {
        uint[] memory sumAmounts = _leftSumColls(newColls(_tokens1, _amounts1), _tokens2, _amounts2);
        address[] memory tokens;
        emit Sum(tokens, sumAmounts);
    }

    // call _leftSubColls
    function leftSubColls(address[] memory _tokens1, uint[] memory _amounts1,
        address[] memory _tokens2, uint[] memory _amounts2) external {
        uint[] memory diffAmounts = _leftSubColls(newColls(_tokens1, _amounts1), _tokens2, _amounts2);
        address[] memory tokens;
        emit Sum(tokens, diffAmounts);
    }

    // call _subColls
    function subColls(address[] memory _tokens1, uint[] memory _amounts1,
        address[] memory _tokens2, uint[] memory _amounts2) external {
        newColls memory diff = _subColls(newColls(_tokens1, _amounts1), _tokens2, _amounts2);
        emit Sum(diff.tokens, diff.amounts);
    }
}