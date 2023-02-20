// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "../../Locke.sol";
import { TestHelpers } from "./TestHelpers.sol";
import "solmate/tokens/ERC20.sol";
import "./TestToken.sol";

contract User is TestHelpers{
    ERC20 testTokenA;
    ERC20 testTokenB;
    ERC20 testTokenC;
    constructor(
        ERC20 _testTokenA,
        ERC20 _testTokenB,
        ERC20 _testTokenC
    ) {
        testTokenA = _testTokenA;
        testTokenB = _testTokenB;
        testTokenC = _testTokenC;
    }

    function doStake(Stream stream, address token, uint112 amount) public {
        write_balanceOf_ts(address(token), address(this), amount);
        ERC20(token).approve(address(stream), amount);
        stream.stake(amount);
    }

    function doWithdraw(Stream stream, uint112 amount) public {
        stream.withdraw(amount);
    }

    function doExit(Stream stream) public {
        stream.exit();
    }

    function doClaimReward(Stream stream) public {
        stream.claimReward();
    }

    function doCreateStream(StreamFactory factory, bool isSale) public returns (Stream){
        (
            uint32 maxDepositLockDuration,
            uint32 maxRewardLockDuration,
            uint32 maxStreamDuration,
            uint32 minStreamDuration
        ) = factory.streamParams();

        uint32 startTime = uint32(block.timestamp + 10);
        Stream stream = factory.createStream(
            address(testTokenA),
            address(testTokenB),
            startTime,
            minStreamDuration,
            maxDepositLockDuration,
            0,
            isSale
            // false,
            // bytes32(0)
        );
        return stream;
    }

    function failClaimFees(Stream stream) public {
        bytes4 sig = sigs("claimFees(address)");
        expect_revert_with(
            address(stream),
            sig,
            abi.encode(address(this)),
            "!gov"
        );
    }
}

abstract contract LockeTest is TestHelpers {
    // contracts
    StreamFactory defaultStreamFactory;


    ERC20 testTokenA;
    ERC20 testTokenB;
    ERC20 testTokenC;

    // users
    User internal alice;
    User internal bob;

    function setUp() public virtual {
        hevm.warp(1609459200); // jan 1, 2021
        testTokenA = ERC20(address(new TestToken("Test Token A", "TTA", 18)));
        testTokenB = ERC20(address(new TestToken("Test Token B", "TTB", 18)));
        testTokenC = ERC20(address(new TestToken("Test Token C", "TTC", 18)));
        write_balanceOf_ts(address(testTokenA), address(this), 100*10**18);
        write_balanceOf_ts(address(testTokenB), address(this), 100*10**18);
        write_balanceOf_ts(address(testTokenC), address(this), 100*10**18);
        assertEq(testTokenA.balanceOf(address(this)), 100*10**18);
        assertEq(testTokenB.balanceOf(address(this)), 100*10**18);

        defaultStreamFactory = new StreamFactory(address(this), address(this));

        alice = new User(testTokenA, testTokenB, testTokenC);
        bob = new User(testTokenA, testTokenB, testTokenC);

    }

    function createDefaultStream() public returns (Stream) {
        return defaultStreamFactory.createStream(
            address(testTokenA),
            address(testTokenB),
            uint32(block.timestamp + 10), // 10 seconds in future
            4 weeks,
            26 weeks, // 6 months
            0,
            false
            // false,
            // bytes32(0)
        );
    }
}
