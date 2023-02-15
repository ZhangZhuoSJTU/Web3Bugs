//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;

contract FixedInterestRateModelMock {
    bool public constant isInterestRateModel = true;
    uint256 public interestRatePerBlock;

    constructor(uint256 interestRatePerBlock_) {
        interestRatePerBlock = interestRatePerBlock_;
    }

    function getBorrowRate() public view returns (uint256) {
        return interestRatePerBlock;
    }

    function getSupplyRate(uint256 reserveFactorMantissa) public view returns (uint256) {
        uint256 ratio = uint256(1e18) - reserveFactorMantissa;
        return (interestRatePerBlock * ratio) / 1e18;
    }

    function setInterestRate(uint256 interestRatePerBlock_) external {
        interestRatePerBlock = interestRatePerBlock_;
    }
}
