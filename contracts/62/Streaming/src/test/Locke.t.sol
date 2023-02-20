// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "./utils/LockeTest.sol";



contract StreamTest is LockeTest {
    bool enteredFlashloan = false;

    function test_fundStream() public {
        // === Setup ===
        (
            uint32 maxDepositLockDuration,
            uint32 maxRewardLockDuration,
            uint32 maxStreamDuration,
            uint32 minStreamDuration
        ) = defaultStreamFactory.streamParams();

        uint112 amt = 1337;
        emit log_named_uint("blocktime", block.timestamp);
        {
            uint64 nextStream = defaultStreamFactory.currStreamId();
            emit log_named_uint("nextStream", nextStream);
            Stream stream = defaultStreamFactory.createStream(
                address(testTokenA),
                address(testTokenB),
                uint32(block.timestamp + 10), // 10 seconds in future
                minStreamDuration,
                maxDepositLockDuration,
                0,
                false
                // false,
                // bytes32(0)
            );

            testTokenA.approve(address(stream), type(uint256).max);
            // ===   ===


            // === Failures ===
            bytes4 sig = sigs("fundStream(uint112)");
            expect_revert_with(
                address(stream),
                sig,
                abi.encode(0),
                "amt"
            );
            hevm.warp(block.timestamp + 11);
            expect_revert_with(
                address(stream),
                sig,
                abi.encode(amt),
                "time"
            );
            hevm.warp(block.timestamp - 11);
            // ===   ===

            


            // === No Fees ===

            uint256 gas_left = gasleft();
            stream.fundStream(amt);
            emit log_named_uint("gas_usage_no_fee", gas_left - gasleft());
            (uint112 rewardTokenAmount, uint112 _unused, uint112 rewardTokenFeeAmount, ) = stream.tokenAmounts();
            assertEq(rewardTokenAmount, amt);
            assertEq(rewardTokenFeeAmount, 0);
            assertEq(testTokenA.balanceOf(address(stream)), 1337);
            // ===    ===
        }


        {
            // === Fees Enabled ====
            defaultStreamFactory.updateFeeParams(StreamFactory.GovernableFeeParams({
                feePercent: 100,
                feeEnabled: true
            }));
            uint256 nextStream = defaultStreamFactory.currStreamId();
            emit log_named_uint("nextStream2", nextStream);
            Stream stream = defaultStreamFactory.createStream(
                address(testTokenA),
                address(testTokenB),
                uint32(block.timestamp + 10), // 10 seconds in future
                minStreamDuration,
                maxDepositLockDuration,
                0,
                false
                // false,
                // bytes32(0)
            );

            testTokenA.approve(address(stream), type(uint256).max);

            uint112 feeAmt = 13; // expected fee amt
            uint256 gas_left = gasleft();
            stream.fundStream(amt);
            emit log_named_uint("gas_usage_w_fee", gas_left - gasleft());
            (uint112 rewardTokenAmount, uint112 _unused, uint112 rewardTokenFeeAmount, ) = stream.tokenAmounts();
            assertEq(rewardTokenAmount, amt - feeAmt);
            assertEq(rewardTokenFeeAmount, feeAmt);
            assertEq(testTokenA.balanceOf(address(stream)), 1337);
        }
    }

    function test_multiUserStake() public {
        (
            uint32 maxDepositLockDuration,
            uint32 maxRewardLockDuration,
            uint32 maxStreamDuration,
            uint32 minStreamDuration
        ) = defaultStreamFactory.streamParams();

        uint32 startTime = uint32(block.timestamp + 10);
        Stream stream = defaultStreamFactory.createStream(
            address(testTokenA),
            address(testTokenB),
            startTime,
            minStreamDuration,
            maxDepositLockDuration,
            0,
            false
            // false
            // bytes32(0)
        );

        testTokenA.approve(address(stream), type(uint256).max);
        stream.fundStream(1000);

        alice.doStake(stream, address(testTokenB), 100);


        hevm.warp(startTime + minStreamDuration / 2); // move to half done
        
        bob.doStake(stream, address(testTokenB), 100);

        hevm.warp(startTime + minStreamDuration + 1); // warp to end of stream

        alice.doClaimReward(stream);
        assertEq(testTokenA.balanceOf(address(alice)), 666);
        bob.doClaimReward(stream);
        assertEq(testTokenA.balanceOf(address(bob)), 333);
    }

    function test_multiUserStakeWithWithdraw() public {
        (
            uint32 maxDepositLockDuration,
            uint32 maxRewardLockDuration,
            uint32 maxStreamDuration,
            uint32 minStreamDuration
        ) = defaultStreamFactory.streamParams();

        uint32 startTime = uint32(block.timestamp + 10);
        Stream stream = defaultStreamFactory.createStream(
            address(testTokenA),
            address(testTokenB),
            startTime,
            minStreamDuration,
            maxDepositLockDuration,
            0,
            false
            // false
            // bytes32(0)
        );

        testTokenA.approve(address(stream), type(uint256).max);
        stream.fundStream(1000);

        alice.doStake(stream, address(testTokenB), 100);


        hevm.warp(startTime + minStreamDuration / 2); // move to half done
        
        bob.doStake(stream, address(testTokenB), 100);

        hevm.warp(startTime + minStreamDuration / 2 + minStreamDuration / 10);

        alice.doExit(stream); 

        hevm.warp(startTime + minStreamDuration + 1); // warp to end of stream


        alice.doClaimReward(stream);
        assertEq(testTokenA.balanceOf(address(alice)), 533);
        bob.doClaimReward(stream);
        assertEq(testTokenA.balanceOf(address(bob)), 466);
    }

    function test_stake() public {
        (
            uint32 maxDepositLockDuration,
            uint32 maxRewardLockDuration,
            uint32 maxStreamDuration,
            uint32 minStreamDuration
        ) = defaultStreamFactory.streamParams();

        uint32 startTime = uint32(block.timestamp + 10);
        Stream stream = defaultStreamFactory.createStream(
            address(testTokenA),
            address(testTokenB),
            startTime,
            minStreamDuration,
            maxDepositLockDuration,
            0,
            false
            // false,
            // bytes32(0)
        );

        testTokenB.approve(address(stream), type(uint256).max);

        {
            // Failures
            bytes4 sig = sigs("stake(uint112)");
            expect_revert_with(
                address(stream),
                sig,
                abi.encode(0),
                "amt"
            );

            // fast forward minStreamDuration
            hevm.warp(startTime + minStreamDuration);
            expect_revert_with(
                address(stream),
                sig,
                abi.encode(100),
                "!stream"
            );
            hevm.warp(startTime - minStreamDuration);

            write_balanceOf(address(testTokenB), address(stream), 2**112 + 1);
            expect_revert_with(
                address(stream),
                sig,
                abi.encode(100),
                "erc"
            );
            write_balanceOf(address(testTokenB), address(stream), 0);
        }

        {
            // Successes
            stream.stake(100);
            LockeERC20 asLERC = LockeERC20(stream);
            assertEq(asLERC.balanceOf(address(this)), 100);

            {
                (uint112 rewardTokenAmount, uint112 depositTokenAmount, uint112 rewardTokenFeeAmount, ) = stream.tokenAmounts();
                assertEq(depositTokenAmount, 100);
            }
            

            {
                uint112 unstreamed = stream.unstreamed();
                assertEq(unstreamed, 100);
            }
            
            {
                (uint256 lastCumulativeRewardPerToken, uint256 virtualBalance, uint112 rewards, uint112 tokens, uint32 lu, ) = stream.tokensNotYetStreamed(address(this));
                assertEq(lastCumulativeRewardPerToken, 0);
                assertEq(virtualBalance, 100);
                assertEq(tokens, 100);
                assertEq(lu, startTime);
            }
            

            // move forward 1/10th of sd
            // round up to next second
            hevm.warp(startTime + minStreamDuration / 10 + 1);
            uint256 rewardPerToken = stream.rewardPerToken();
            stream.stake(1);
            
            {
                uint112 unstreamed = stream.unstreamed();
                assertEq(unstreamed, 91);
            }

            {
                (uint256 lastCumulativeRewardPerToken, uint256 virtualBalance, uint112 rewards, uint112 tokens, uint32 lu, ) = stream.tokensNotYetStreamed(address(this));
                assertEq(lastCumulativeRewardPerToken, rewardPerToken);
                assertEq(virtualBalance, 101);
                assertEq(tokens, 91);
                assertEq(lu, block.timestamp);
            }
            

            hevm.warp(startTime + (2*minStreamDuration) / 10 + 1);
            rewardPerToken = stream.rewardPerToken();
            stream.stake(1);
            
            {
                uint112 unstreamed = stream.unstreamed();
                assertEq(unstreamed, 82);
            }

            {
                (uint256 lastCumulativeRewardPerToken, uint256 virtualBalance, uint112 rewards, uint112 tokens, uint32 lu, ) = stream.tokensNotYetStreamed(address(this));
                assertEq(lastCumulativeRewardPerToken, rewardPerToken);
                assertEq(virtualBalance, 102);
                assertEq(tokens, 82);
                assertEq(lu, block.timestamp);
            }
            

        }
        {
            hevm.warp(1609459200); // jan 1, 2021          
            // Sale test
            Stream stream = defaultStreamFactory.createStream(
                address(testTokenA),
                address(testTokenB),
                startTime,
                minStreamDuration,
                maxDepositLockDuration,
                0,
                true
                // false,
                // bytes32(0)
            );
            testTokenB.approve(address(stream), type(uint256).max);
            stream.stake(100);
            LockeERC20 asLERC = LockeERC20(stream);
            // no tokens wen sale
            assertEq(asLERC.balanceOf(address(this)), 0);

            (uint112 rewardTokenAmount, uint112 depositTokenAmount, uint112 rewardTokenFeeAmount, ) = stream.tokenAmounts();
            assertEq(depositTokenAmount, 100);
            (uint256 lastCumulativeRewardPerToken, uint256 virtualBalance, uint112 rewards, uint112 tokens, uint32 lu, ) = stream.tokensNotYetStreamed(address(this));
            assertEq(tokens, 100);
        }
    }

    function test_createIncentive() public {
        (
            uint32 maxDepositLockDuration,
            uint32 maxRewardLockDuration,
            uint32 maxStreamDuration,
            uint32 minStreamDuration
        ) = defaultStreamFactory.streamParams();

        uint32 startTime = uint32(block.timestamp + 10);
        Stream stream = defaultStreamFactory.createStream(
            address(testTokenA),
            address(testTokenB),
            startTime,
            minStreamDuration,
            maxDepositLockDuration,
            0,
            false
            // false,
            // bytes32(0)
        );

        bytes4 sig = sigs("createIncentive(address,uint112)");
        expect_revert_with(
            address(stream),
            sig,
            abi.encode(address(testTokenA), 0),
            "inc"
        );

        uint256 bal = testTokenC.balanceOf(address(this));
        testTokenC.approve(address(stream), type(uint256).max);
        stream.createIncentive(address(testTokenC), 100);
        assertEq(stream.incentives(address(testTokenC)), 100);

        hevm.warp(startTime + minStreamDuration);
        stream.claimIncentive(address(testTokenC));
        assertEq(testTokenC.balanceOf(address(this)), bal);
    }


    function test_claimDeposit() public {
        (
            uint32 maxDepositLockDuration,
            uint32 maxRewardLockDuration,
            uint32 maxStreamDuration,
            uint32 minStreamDuration
        ) = defaultStreamFactory.streamParams();

        uint32 startTime = uint32(block.timestamp + 10);

        uint32 endStream = startTime + minStreamDuration;
        uint32 endDepositLock = endStream + maxDepositLockDuration;

        {
            Stream stream = defaultStreamFactory.createStream(
                address(testTokenA),
                address(testTokenB),
                startTime,
                minStreamDuration,
                maxDepositLockDuration,
                0,
                true
                // false,
                // bytes32(0)
            );

            testTokenB.approve(address(stream), type(uint256).max);

            stream.stake(100);
            bytes4 sig = sigs("claimDepositTokens(uint112)");
            expect_revert_with(
                address(stream),
                sig,
                abi.encode(100),
                "sale"
            );
        }

        {
            Stream stream = defaultStreamFactory.createStream(
                address(testTokenA),
                address(testTokenB),
                startTime,
                minStreamDuration,
                maxDepositLockDuration,
                0,
                false
                // false,
                // bytes32(0)
            );

            testTokenB.approve(address(stream), type(uint256).max);

            stream.stake(100);
            bytes4 sig = sigs("claimDepositTokens(uint112)");
            expect_revert_with(
                address(stream),
                sig,
                abi.encode(0),
                "amt"
            );
        }

        {
            Stream stream = defaultStreamFactory.createStream(
                address(testTokenA),
                address(testTokenB),
                startTime,
                minStreamDuration,
                maxDepositLockDuration,
                0,
                false
            );

            testTokenB.approve(address(stream), type(uint256).max);

            stream.stake(100);
            bytes4 sig = sigs("claimDepositTokens(uint112)");
            expect_revert_with(
                address(stream),
                sig,
                abi.encode(100),
                "lock"
            );
        }

        {
            Stream stream = defaultStreamFactory.createStream(
                address(testTokenA),
                address(testTokenB),
                startTime,
                minStreamDuration,
                maxDepositLockDuration,
                0,
                false
            );

            testTokenB.approve(address(stream), type(uint256).max);

            stream.stake(100);

            hevm.warp(endDepositLock);
            bytes4 sig = sigs("claimDepositTokens(uint112)");
            expect_revert(
                address(stream),
                sig,
                abi.encode(101)
            );
            hevm.warp(startTime - 10);
        }

        {
            Stream stream = defaultStreamFactory.createStream(
                address(testTokenA),
                address(testTokenB),
                startTime,
                minStreamDuration,
                maxDepositLockDuration,
                0,
                false
            );

            uint256 bal = testTokenB.balanceOf(address(this));
            testTokenB.approve(address(stream), type(uint256).max);

            stream.stake(100);

            hevm.warp(endDepositLock + 1);
            stream.claimDepositTokens(100);
            assertEq(testTokenB.balanceOf(address(this)), bal);
        }
    }

    function test_creatorClaimTokens() public {
        (
            uint32 maxDepositLockDuration,
            uint32 maxRewardLockDuration,
            uint32 maxStreamDuration,
            uint32 minStreamDuration
        ) = defaultStreamFactory.streamParams();

        uint32 startTime = uint32(block.timestamp + 10);

        uint32 endStream = startTime + minStreamDuration;
        uint32 endDepositLock = endStream + maxDepositLockDuration;

        {
            Stream stream = defaultStreamFactory.createStream(
                address(testTokenA),
                address(testTokenB),
                startTime,
                minStreamDuration,
                maxDepositLockDuration,
                0,
                false
                // false,
                // bytes32(0)
            );

            testTokenB.approve(address(stream), type(uint256).max);

            stream.stake(100);
            bytes4 sig = sigs("creatorClaimSoldTokens(address)");
            expect_revert_with(
                address(stream),
                sig,
                abi.encode(address(this)),
                "!sale"
            );
        }

        {
            Stream stream = defaultStreamFactory.createStream(
                address(testTokenA),
                address(testTokenB),
                startTime,
                minStreamDuration,
                maxDepositLockDuration,
                0,
                true
                // false,
                // bytes32(0)
            );

            testTokenB.approve(address(stream), type(uint256).max);

            stream.stake(100);
            hevm.warp(endStream);
            stream.creatorClaimSoldTokens(address(this));
            bytes4 sig = sigs("creatorClaimSoldTokens(address)");
            expect_revert_with(
                address(stream),
                sig,
                abi.encode(address(this)),
                "claimed"
            );
            hevm.warp(startTime - 10);
        }

        {
            Stream stream = alice.doCreateStream(defaultStreamFactory, true);

            testTokenB.approve(address(stream), type(uint256).max);

            stream.stake(100);
            bytes4 sig = sigs("creatorClaimSoldTokens(address)");
            expect_revert_with(
                address(stream),
                sig,
                abi.encode(address(this)),
                "!creator"
            );
        }

        {
            Stream stream = defaultStreamFactory.createStream(
                address(testTokenA),
                address(testTokenB),
                startTime,
                minStreamDuration,
                maxDepositLockDuration,
                0,
                true
                // false,
                // bytes32(0)
            );

            testTokenB.approve(address(stream), type(uint256).max);

            stream.stake(100);
            bytes4 sig = sigs("creatorClaimSoldTokens(address)");
            expect_revert_with(
                address(stream),
                sig,
                abi.encode(address(this)),
                "stream"
            );
        }

        {
            Stream stream = defaultStreamFactory.createStream(
                address(testTokenA),
                address(testTokenB),
                startTime,
                minStreamDuration,
                maxDepositLockDuration,
                0,
                true
                // false,
                // bytes32(0)
            );

            uint256 bal = testTokenB.balanceOf(address(this));
            testTokenB.approve(address(stream), type(uint256).max);

            stream.stake(100);
            hevm.warp(endStream);
            stream.creatorClaimSoldTokens(address(this));
            assertEq(testTokenB.balanceOf(address(this)), bal);
            hevm.warp(startTime - 10);
        }
    }

    function test_claimFees() public {

        (
            uint32 maxDepositLockDuration,
            uint32 maxRewardLockDuration,
            uint32 maxStreamDuration,
            uint32 minStreamDuration
        ) = defaultStreamFactory.streamParams();

        uint32 startTime = uint32(block.timestamp + 10);

        uint32 endStream = startTime + minStreamDuration;
        uint32 endDepositLock = endStream + maxDepositLockDuration;

        {
            Stream stream = defaultStreamFactory.createStream(
                address(testTokenA),
                address(testTokenB),
                startTime,
                minStreamDuration,
                maxDepositLockDuration,
                0,
                false
            );

            testTokenA.approve(address(stream), type(uint256).max);
            stream.fundStream(1000);

            bob.failClaimFees(stream);
        }

        {
            Stream stream = defaultStreamFactory.createStream(
                address(testTokenA),
                address(testTokenB),
                startTime,
                minStreamDuration,
                maxDepositLockDuration,
                0,
                false
            );

            testTokenA.approve(address(stream), type(uint256).max);
            stream.fundStream(1000);
            
            bytes4 sig = sigs("claimFees(address)");
            expect_revert_with(
                address(stream),
                sig,
                abi.encode(address(this)),
                "stream"
            );
        }

        {
            defaultStreamFactory.updateFeeParams(StreamFactory.GovernableFeeParams({
                feePercent: 100,
                feeEnabled: true
            }));

            Stream stream = defaultStreamFactory.createStream(
                address(testTokenA),
                address(testTokenB),
                startTime,
                minStreamDuration,
                maxDepositLockDuration,
                0,
                false
            );

            uint256 bal = testTokenA.balanceOf(address(this));
            testTokenA.approve(address(stream), type(uint256).max);
            stream.fundStream(1000);
            
            uint256 feeAmt = 1000*100/10000;
            hevm.warp(endStream);
            stream.claimFees(address(this));
            assertEq(testTokenA.balanceOf(address(this)), bal - 1000 + feeAmt);
        }
    }

    function test_flashloan() public {
        (
            uint32 maxDepositLockDuration,
            uint32 maxRewardLockDuration,
            uint32 maxStreamDuration,
            uint32 minStreamDuration
        ) = defaultStreamFactory.streamParams();

        uint32 startTime = uint32(block.timestamp + 10);

        uint32 endStream = startTime + minStreamDuration;
        uint32 endDepositLock = endStream + maxDepositLockDuration;

        {
            Stream stream = defaultStreamFactory.createStream(
                address(testTokenA),
                address(testTokenB),
                startTime,
                minStreamDuration,
                maxDepositLockDuration,
                0,
                false
            );

            testTokenA.approve(address(stream), type(uint256).max);
            stream.fundStream(1000000);
            bob.doStake(stream, address(testTokenB), 1000000);

            bytes4 sig = sigs("flashloan(address,address,uint112,bytes)");
            expect_revert_with(
                address(stream),
                sig,
                abi.encode(address(testTokenC), address(this), 0, ""),
                "erc"
            );
            

            stream.flashloan(address(testTokenA), address(this), 1000000, abi.encode(true, testTokenA.balanceOf(address(this))));
            (,,uint112 rewardFee,) = stream.tokenAmounts();
            assertEq(rewardFee, 1000000 * 10 / 10000);
            assertTrue(enteredFlashloan);
            enteredFlashloan = false;
            expect_revert_with(
                address(stream),
                sig,
                abi.encode(address(testTokenA), address(this), 1000000, abi.encode(false, testTokenA.balanceOf(address(this)))),
                "f4"
            );

            stream.flashloan(address(testTokenB), address(this), 1000000, abi.encode(true, testTokenB.balanceOf(address(this))));
            (,,,uint112 depositFlFees) = stream.tokenAmounts();
            assertEq(depositFlFees, 1000000 * 10 / 10000);
            assertTrue(enteredFlashloan);
            enteredFlashloan = false;

            expect_revert_with(
                address(stream),
                sig,
                abi.encode(address(testTokenB), address(this), 1000000, abi.encode(false, testTokenB.balanceOf(address(this)))),
                "f1"
            );

            uint256 balA = testTokenA.balanceOf(address(this));
            uint256 balB = testTokenB.balanceOf(address(this));
            hevm.warp(endStream);
            stream.claimFees(address(this));
            assertEq(testTokenA.balanceOf(address(this)), balA + 1000000 * 10 / 10000);
            assertEq(testTokenB.balanceOf(address(this)), balB + 1000000 * 10 / 10000);
        }
    }


    function test_recoverTokens() public {
        (
            uint32 maxDepositLockDuration,
            uint32 maxRewardLockDuration,
            uint32 maxStreamDuration,
            uint32 minStreamDuration
        ) = defaultStreamFactory.streamParams();

        uint32 startTime = uint32(block.timestamp + 10);

        uint32 endStream = startTime + minStreamDuration;
        uint32 endDepositLock = endStream + maxDepositLockDuration;
        uint32 endRewardLock = endStream + 0;
        {
            Stream stream = defaultStreamFactory.createStream(
                address(testTokenA),
                address(testTokenB),
                startTime,
                minStreamDuration,
                maxDepositLockDuration,
                0,
                false
            );

            testTokenA.approve(address(stream), type(uint256).max);
            stream.fundStream(1000000);
            bob.doStake(stream, address(testTokenB), 1000000);

            bytes4 sig = sigs("recoverTokens(address,address)");
            expect_revert_with(
                address(stream),
                sig,
                abi.encode(address(testTokenB), address(this)),
                "time"
            );
            uint256 bal = testTokenB.balanceOf(address(this));
            testTokenB.transfer(address(stream), 100);
            hevm.warp(endDepositLock + 1);
            stream.recoverTokens(address(testTokenB), address(this));
            assertEq(testTokenB.balanceOf(address(this)), bal);
            hevm.warp(startTime - 10);
        }

        {
            Stream stream = defaultStreamFactory.createStream(
                address(testTokenA),
                address(testTokenB),
                startTime,
                minStreamDuration,
                maxDepositLockDuration,
                0,
                false
            );

            testTokenA.approve(address(stream), type(uint256).max);
            stream.fundStream(1000000);
            bob.doStake(stream, address(testTokenB), 1000000);

            bytes4 sig = sigs("recoverTokens(address,address)");
            expect_revert_with(
                address(stream),
                sig,
                abi.encode(address(testTokenA), address(this)),
                "time"
            );
            uint256 bal = testTokenA.balanceOf(address(this));
            testTokenA.transfer(address(stream), 100);
            hevm.warp(endRewardLock + 1);
            stream.recoverTokens(address(testTokenA), address(this));
            assertEq(testTokenA.balanceOf(address(this)), bal);
            hevm.warp(startTime - 10);
        }

        {
            Stream stream = defaultStreamFactory.createStream(
                address(testTokenA),
                address(testTokenB),
                startTime,
                minStreamDuration,
                maxDepositLockDuration,
                0,
                false
            );

            testTokenA.approve(address(stream), type(uint256).max);
            stream.fundStream(1000000);
            bob.doStake(stream, address(testTokenB), 1000000);


            testTokenC.approve(address(stream), type(uint256).max);
            stream.createIncentive(address(testTokenC), 100);

            bytes4 sig = sigs("recoverTokens(address,address)");
            expect_revert_with(
                address(stream),
                sig,
                abi.encode(address(testTokenC), address(this)),
                "stream"
            );
            uint256 bal = testTokenC.balanceOf(address(this));
            testTokenC.transfer(address(stream), 100);
            hevm.warp(endStream + 1);
            stream.recoverTokens(address(testTokenC), address(this));
            uint256 newbal = testTokenC.balanceOf(address(this));
            assertEq(newbal, bal);
            stream.claimIncentive(address(testTokenC));
            assertEq(testTokenC.balanceOf(address(this)), newbal + 100);
            hevm.warp(startTime - 10);
        }

        {
            Stream stream = defaultStreamFactory.createStream(
                address(testTokenA),
                address(testTokenB),
                startTime,
                minStreamDuration,
                maxDepositLockDuration,
                0,
                false
            );

            testTokenA.approve(address(stream), type(uint256).max);
            stream.fundStream(1000000);
            bob.doStake(stream, address(testTokenB), 1000000);

            uint256 bal = testTokenC.balanceOf(address(this));
            testTokenC.transfer(address(stream), 100);
            hevm.warp(endStream);
            stream.recoverTokens(address(testTokenC), address(this));
            assertEq(testTokenC.balanceOf(address(this)), bal);
            hevm.warp(startTime - 10);
        }
    }

    function test_arbitraryCall() public {
        (
            uint32 maxDepositLockDuration,
            uint32 maxRewardLockDuration,
            uint32 maxStreamDuration,
            uint32 minStreamDuration
        ) = defaultStreamFactory.streamParams();

        uint32 startTime = uint32(block.timestamp + 10);

        uint32 endStream = startTime + minStreamDuration;
        uint32 endDepositLock = endStream + maxDepositLockDuration;
        uint32 endRewardLock = endStream + 0;
        {
            Stream stream = defaultStreamFactory.createStream(
                address(testTokenA),
                address(testTokenB),
                startTime,
                minStreamDuration,
                maxDepositLockDuration,
                0,
                false
            );

            testTokenA.approve(address(stream), type(uint256).max);
            stream.fundStream(1000000);
            bob.doStake(stream, address(testTokenB), 1000000);

            testTokenC.approve(address(stream), type(uint256).max);
            stream.createIncentive(address(testTokenC), 100);

            bytes4 sig = sigs("arbitraryCall(address,bytes)");
            expect_revert_with(
                address(stream),
                sig,
                abi.encode(address(testTokenC), ""),
                "inc"
            );
            expect_revert_with(
                address(stream),
                sig,
                abi.encode(address(testTokenA), ""),
                "erc"
            );
        }

        {
            Stream stream = defaultStreamFactory.createStream(
                address(testTokenA),
                address(testTokenB),
                startTime,
                minStreamDuration,
                maxDepositLockDuration,
                0,
                false
            );

            uint256 bal = testTokenC.balanceOf(address(this));
            testTokenA.approve(address(stream), type(uint256).max);
            stream.fundStream(1000000);
            bob.doStake(stream, address(testTokenB), 1000000);

            testTokenC.transfer(address(stream), 100);

            bytes memory data = abi.encodePacked(sigs("transfer(address,uint256)"), abi.encode(address(this), 100));
            stream.arbitraryCall(address(testTokenC), data);
            assertEq(testTokenC.balanceOf(address(this)), bal);
        }

        {
            Stream stream = defaultStreamFactory.createStream(
                address(testTokenA),
                address(testTokenB),
                startTime,
                minStreamDuration,
                maxDepositLockDuration,
                0,
                false
            );

            uint256 bal = testTokenC.balanceOf(address(this));
            testTokenA.approve(address(stream), type(uint256).max);
            stream.fundStream(1000000);
            bob.doStake(stream, address(testTokenB), 1000000);

            testTokenC.transfer(address(stream), 100);

            bytes memory data = abi.encodePacked(sigs("transfer(address,uint256)"), abi.encode(address(this), 100));
            stream.arbitraryCall(address(testTokenC), data);
            assertEq(testTokenC.balanceOf(address(this)), bal);
        }

        {
            Stream stream = defaultStreamFactory.createStream(
                address(testTokenA),
                address(testTokenB),
                startTime,
                minStreamDuration,
                maxDepositLockDuration,
                0,
                false
            );

            uint256 bal = testTokenC.balanceOf(address(this));
            testTokenA.approve(address(stream), type(uint256).max);
            stream.fundStream(1000000);
            bob.doStake(stream, address(testTokenB), 1000000);

            bytes memory data = abi.encodePacked(sigs("manualBurn(address,address)"), abi.encode(address(testTokenA), address(stream)));
            bytes4 sig = sigs("arbitraryCall(address,bytes)");
            expect_revert_with(
                address(stream),
                sig,
                abi.encode(address(this), data),
                "erc"
            );
        }
    }

    function manualBurn(address token, address who) public {
        uint256 curBal = ERC20(token).balanceOf(who);
        write_balanceOf_ts(token, who, curBal - 10);
    }

    function lockeCall(address originator, address token, uint256 amount, bytes memory data) public {
        Stream stream = Stream(msg.sender);
        (bool sendBackFee, uint112 prevBal) = abi.decode(data, (bool, uint112));
        assertEq(ERC20(token).balanceOf(address(this)), prevBal + amount);
        if (sendBackFee) {
            ERC20(token).transfer(msg.sender, amount * 10 / 10000);
        }
        ERC20(token).transfer(msg.sender, amount);
        enteredFlashloan = true;
        return;
    }
}



contract StreamFactoryTest is LockeTest {
    function test_createStream() public {

        // ===  EXPECTED FAILURES ===
        (
            uint32 maxDepositLockDuration,
            uint32 maxRewardLockDuration,
            uint32 maxStreamDuration,
            uint32 minStreamDuration
        ) = defaultStreamFactory.streamParams();

        {
            // Fails
            bytes4 sig = sigs("createStream(address,address,uint32,uint32,uint32,uint32,bool)");
            expect_revert_with(
                address(defaultStreamFactory),
                sig,
                abi.encode(
                    address(0),
                    address(0),
                    block.timestamp - 10,
                    0,
                    0,
                    0,
                    false
                    // false,
                    // bytes32(0)
                ),
                "past"
            );

            if (minStreamDuration > 0) {
                expect_revert_with(
                    address(defaultStreamFactory),
                    sig,
                    abi.encode(
                        address(0),
                        address(0),
                        block.timestamp,
                        minStreamDuration - 1,
                        0,
                        0,
                        false
                        // false,
                        // bytes32(0)
                    ),
                    "stream"
                );
            }

            expect_revert_with(
                address(defaultStreamFactory),
                sig,
                abi.encode(
                    address(0),
                    address(0),
                    block.timestamp,
                    maxStreamDuration + 1,
                    0,
                    0,
                    false
                    // false,
                    // bytes32(0)
                ),
                "stream"
            );

            expect_revert_with(
                address(defaultStreamFactory),
                sig,
                abi.encode(
                    address(0),
                    address(0),
                    block.timestamp,
                    minStreamDuration,
                    maxDepositLockDuration + 1,
                    0,
                    false
                    // false,
                    // bytes32(0)
                ),
                "lock"
            );

            expect_revert_with(
                address(defaultStreamFactory),
                sig,
                abi.encode(
                    address(0),
                    address(0),
                    block.timestamp,
                    minStreamDuration,
                    maxDepositLockDuration,
                    maxRewardLockDuration + 1,
                    false
                    // false,
                    // bytes32(0)
                ),
                "reward"
            );
        }
        // ===   ===
        

        // === Successful ===
        {
            // No Fees
            Stream stream = defaultStreamFactory.createStream(
                address(testTokenA),
                address(testTokenB),
                uint32(block.timestamp + 10), // 10 seconds in future
                minStreamDuration,
                maxDepositLockDuration,
                0,
                false
                // false,
                // bytes32(0)
            );

            (uint16 feePercent, bool feeEnabled) = defaultStreamFactory.feeParams();

            // time stuff
            (uint32 startTime, uint32 streamDuration, uint32 depositLockDuration, uint32 rewardLockDuration) = stream.streamParams();
            assertEq(startTime, block.timestamp + 10);
            assertEq(streamDuration, minStreamDuration);
            assertEq(depositLockDuration, maxDepositLockDuration);
            assertEq(rewardLockDuration, 0);

            // tokens
            assertEq(stream.rewardToken(), address(testTokenA));
            assertEq(stream.depositToken(), address(testTokenB));

            // address
            // assertEq(address(uint160(uint(hash))), address(stream));

            // id
            assertEq(stream.streamId(), 0);

            // factory
            assertEq(defaultStreamFactory.currStreamId(), 1);

            // token
            assertEq(stream.name(), "lockeTest Token B: 0");
            assertEq(stream.symbol(), "lockeTTB0");

            // others
            (feePercent, feeEnabled) = stream.feeParams();
            assertEq(feePercent, 0);
            assertTrue(!feeEnabled);
            assertTrue(!stream.isSale());
        }
        
        {
            // With Fees
            defaultStreamFactory.updateFeeParams(StreamFactory.GovernableFeeParams({
                feePercent: 100,
                feeEnabled: true
            }));
            Stream stream = defaultStreamFactory.createStream(
                address(testTokenA),
                address(testTokenB),
                uint32(block.timestamp + 10), // 10 seconds in future
                minStreamDuration,
                maxDepositLockDuration,
                0,
                false
                // false,
                // bytes32(0)
            );

            (uint16 feePercent, bool feeEnabled) = defaultStreamFactory.feeParams();

            // time stuff
            (uint32 startTime, uint32 streamDuration, uint32 depositLockDuration, uint32 rewardLockDuration) = stream.streamParams();
            assertEq(startTime, block.timestamp + 10);
            assertEq(streamDuration, minStreamDuration);
            assertEq(depositLockDuration, maxDepositLockDuration);
            assertEq(rewardLockDuration, 0);

            // tokens
            assertEq(stream.rewardToken(), address(testTokenA));
            assertEq(stream.depositToken(), address(testTokenB));

            // address
            // assertEq(address(uint160(uint(hash))), address(stream));

            // id
            assertEq(stream.streamId(), 1);

            // factory
            assertEq(defaultStreamFactory.currStreamId(), 2);

            // token
            assertEq(stream.name(), "lockeTest Token B: 1");
            assertEq(stream.symbol(), "lockeTTB1");

            // other
            (feePercent, feeEnabled) = stream.feeParams();
            assertEq(feePercent, 100);
            assertTrue(feeEnabled);
            assertTrue(!stream.isSale());
        }
        // ===   ===
    }


    function test_updateStreamParams() public {
        // set the gov to none
        write_flat(address(defaultStreamFactory), "gov()", address(0));
        StreamFactory.GovernableStreamParams memory newParams = StreamFactory.GovernableStreamParams({
            maxDepositLockDuration: 1337 weeks,
            maxRewardLockDuration: 1337 weeks,
            maxStreamDuration: 1337 weeks,
            minStreamDuration: 1337 hours
        });
        expect_revert_with(
            address(defaultStreamFactory),
            sigs("updateStreamParams((uint32,uint32,uint32,uint32))"),
            abi.encode(newParams),
            "!gov"
        );

        // get back gov and set and check
        write_flat(address(defaultStreamFactory), "gov()", address(this));
        defaultStreamFactory.updateStreamParams(newParams);

        (
            uint32 maxDepositLockDuration,
            uint32 maxRewardLockDuration,
            uint32 maxStreamDuration,
            uint32 minStreamDuration
        ) = defaultStreamFactory.streamParams();
        assertEq(maxDepositLockDuration, 1337 weeks);
        assertEq(maxRewardLockDuration, 1337 weeks);
        assertEq(maxStreamDuration, 1337 weeks);
        assertEq(minStreamDuration, 1337 hours);
    }

    function test_updateFeeParams() public {
        // set the gov to none
        write_flat(address(defaultStreamFactory), "gov()", address(0));
        
        uint16 max = 500;
        StreamFactory.GovernableFeeParams memory newParams = StreamFactory.GovernableFeeParams({
            feePercent: max + 1,
            feeEnabled: true
        });
        expect_revert_with(
            address(defaultStreamFactory),
            sigs("updateFeeParams((uint16,bool))"),
            abi.encode(newParams),
            "!gov"
        );

        // get back gov and set and check
        write_flat(address(defaultStreamFactory), "gov()", address(this));
        
        expect_revert_with(
            address(defaultStreamFactory),
            sigs("updateFeeParams((uint16,bool))"),
            abi.encode(newParams),
            "fee"
        );

        newParams.feePercent = 137;

        defaultStreamFactory.updateFeeParams(newParams);
        (
            uint16 feePercent,
            bool feeEnabled
        ) = defaultStreamFactory.feeParams();
        assertEq(feePercent, 137);
        assertTrue(feeEnabled);
    }
}