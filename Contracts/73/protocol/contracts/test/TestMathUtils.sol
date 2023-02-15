pragma solidity ^0.5.11;

import "../libraries/MathUtils.sol";
import "./helpers/truffle/Assert.sol";

contract TestMathUtils {
    function test_validPerc() public {
        Assert.equal(MathUtils.validPerc(50), true, "50 should be a valid percentage");
        Assert.equal(MathUtils.validPerc(0), true, "0 should be a valid percentage");
        Assert.equal(MathUtils.validPerc(1000000), true, "the max should be a valid percentage");
        Assert.equal(MathUtils.validPerc(1000001), false, "1 more than the max should not be valid percentage");
    }

    function test_percOf1() public {
        Assert.equal(MathUtils.percOf(100, 3, 4), 75, "3/4 of 100 should be 75");
        Assert.equal(MathUtils.percOf(100, 7, 9), 77, "7/9 of 100 should be 77");
    }

    function test_percOf2() public {
        Assert.equal(MathUtils.percOf(100, 3), 0, ".0003% of 100 is 0");
        Assert.equal(MathUtils.percOf(100, 100000), 10, "10% of 100 is 10");
    }

    function test_percPoints() public {
        Assert.equal(MathUtils.percPoints(3, 4), 750000, "3/4 should convert to valid percentage");
        Assert.equal(MathUtils.percPoints(100, 300), 333333, "100/300 should convert to valid percentage");
    }
}
