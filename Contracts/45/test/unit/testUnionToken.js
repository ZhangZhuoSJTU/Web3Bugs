const {ethers} = require("hardhat");
const {expect} = require("chai");
require("chai").should();
const {parseEther} = require("ethers").utils;
const {AddressZero} = require("ethers").constants;
const {signERC2612Permit} = require("eth-permit");

const {waitNBlocks, increaseTime} = require("../../utils");

describe("UnionToken Contract", () => {
    let ADMIN, ALICE, BOB, GEORGE, COMPTROLLER, delegatee;
    // const [, privateKey_BOB] = privateKeys;
    const name = "Union Token";
    let testToken;
    let unionToken;

    const Types = {
        Delegation: [
            {name: "delegatee", type: "address"},
            {name: "nonce", type: "uint256"},
            {name: "expiry", type: "uint256"}
        ]
    };

    const Domain = (chainId, contractAddress) => ({
        name,
        version: "1",
        chainId,
        verifyingContract: contractAddress
    });

    before(async () => {
        [ADMIN, ALICE, BOB, GEORGE, COMPTROLLER] = await ethers.getSigners();

        testToken = await upgrades.deployProxy(
            await ethers.getContractFactory("FaucetERC20"),
            ["Dai Stablecoin", "DAI"], // exact name needed for signature verifaction
            {initializer: "__FaucetERC20_init(string,string)"}
        );

        await testToken.mint(ADMIN.address, parseEther("10000000"));
    });

    const deployUnionToken = async () => {
        const latestBlock = await ethers.provider.getBlock("latest");
        // console.log({latestBlock});
        const mintingAllowedAfter = latestBlock.timestamp + 10;

        // const mintingAllowedAfter = Math.floor(Date.now()/1000); // 10 mins after current time
        // console.log({mintingAllowedAfter})

        const UnionToken = await ethers.getContractFactory("UnionToken");
        unionToken = await UnionToken.deploy("Union Token", "UNION", mintingAllowedAfter);
        await waitNBlocks(10);
    };

    describe("Mint using non admin (Bob)", () => {
        before(deployUnionToken);

        it("Bob should not be admin", async () => {
            isAdmin = (await unionToken.owner()) == BOB.address;
            isAdmin.should.eq(false);
        });

        it("Mint transaction from Bob should fail", async () => {
            await expect(unionToken.connect(BOB).mint(ADMIN.address, parseEther("10000000"))).to.be.revertedWith(
                "Ownable: caller is not the owner"
            );
        });
    });

    describe("Mint cap", () => {
        beforeEach(deployUnionToken);

        it("Should be able to mint amount less than mint cap", async () => {
            await increaseTime(3600);

            const totalSupply = await unionToken.totalSupply();
            const mintCap = await unionToken.mintCap();
            const mintAmount = totalSupply.mul(mintCap).div("100");

            await unionToken.mint(ADMIN.address, mintAmount);
        });

        it("Should not be able to mint amount greater than mint cap", async () => {
            await increaseTime(3600);

            const totalSupply = await unionToken.totalSupply();
            const mintCap = await unionToken.mintCap();
            const mintAmount = totalSupply.mul(mintCap).div("100");
            await expect(unionToken.mint(ADMIN.address, mintAmount.add("1"))).to.be.revertedWith("exceeded mint cap");
        });
    });

    describe("Initialization", () => {
        before(deployUnionToken);

        it("Token should have correct name", async () => {
            const name = await unionToken.name();
            name.should.eq("Union Token");
        });

        it("Token should have correct symbol", async () => {
            const symbol = await unionToken.symbol();
            symbol.should.eq("UNION");
        });

        it("Token should have correct decimals", async () => {
            const decimals = await unionToken.decimals();
            decimals.toString().should.eq("18");
        });

        it("Deployer should be whitelisted", async () => {
            const isWhitelisted = await unionToken.isWhitelisted(ADMIN.address);
            isWhitelisted.should.eq(true);
        });
    });

    describe("Delegate by sig", () => {
        const expiry = 10e9;
        let nonce = 0;
        beforeEach(async () => {
            delegatee = ADMIN;
            await deployUnionToken();
        });

        it("Bob should not have delegated to anyone", async () => {
            let res = await unionToken.delegates(BOB.address);
            res.should.eq(AddressZero);
        });

        it("delegation with valid parameteres should succeed", async () => {
            const signature = await BOB._signTypedData(Domain(await BOB.getChainId(), unionToken.address), Types, {
                delegatee: delegatee.address,
                nonce,
                expiry
            });
            const {v, r, s} = ethers.utils.splitSignature(signature);

            await expect(unionToken.connect(BOB).delegateBySig(delegatee.address, nonce, expiry, v, r, s))
                .to.emit(unionToken, "DelegateChanged")
                .withArgs(BOB.address, AddressZero, delegatee.address);
        });

        it("Bob should have delegated to correct address", async () => {
            await unionToken.connect(BOB).delegate(delegatee.address);

            let res = await unionToken.delegates(BOB.address);
            res.should.eq(delegatee.address);
        });

        it("reverts if the signatory is invalid", async () => {
            await expect(
                unionToken
                    .connect(BOB)
                    .delegateBySig(
                        delegatee.address,
                        nonce,
                        expiry,
                        0,
                        "0x0000000000000000000000000000000000000000000000000000000000000bad",
                        "0x0000000000000000000000000000000000000000000000000000000000000bad"
                    )
            ).to.be.revertedWith("ECDSA: invalid signature 'v' value");
        });

        it("reverts if the nonce is bad ", async () => {
            const signature = await BOB._signTypedData(Domain(await BOB.getChainId(), unionToken.address), Types, {
                delegatee: delegatee.address,
                nonce,
                expiry
            });
            const {v, r, s} = ethers.utils.splitSignature(signature);

            await expect(
                unionToken.connect(BOB).delegateBySig(delegatee.address, nonce + 1, expiry, v, r, s)
            ).to.be.revertedWith("ERC20Votes: invalid nonce");
        });

        it("reverts if the signature has expired", async () => {
            const expiry = 0;
            const signature = await BOB._signTypedData(Domain(await BOB.getChainId(), unionToken.address), Types, {
                delegatee: delegatee.address,
                nonce,
                expiry
            });
            const {v, r, s} = ethers.utils.splitSignature(signature);

            await expect(
                unionToken.connect(BOB).delegateBySig(delegatee.address, nonce, expiry, v, r, s)
            ).to.be.revertedWith("ERC20Votes: signature expired");
        });
    });

    describe("Normal delegate", () => {
        beforeEach(async () => {
            delegatee = ALICE;
            await deployUnionToken();
        });

        it("Bob should not have delegated to anyone", async () => {
            let res = await unionToken.delegates(BOB.address);
            res.should.eq(AddressZero);
        });

        it("DelegateChanged event should be emitted in delegate tx", async () => {
            await expect(unionToken.connect(BOB).delegate(delegatee.address))
                .to.emit(unionToken, "DelegateChanged")
                .withArgs(BOB.address, AddressZero, delegatee.address);
        });

        it("Bob should have delegated to correct address", async () => {
            await unionToken.connect(BOB).delegate(delegatee.address);
            let res = await unionToken.delegates(BOB.address);
            res.should.eq(delegatee.address);
        });
    });

    // George delegates to Bob
    // then Georde and Alice move tokens to make checkpoints
    // Bob's votes are verified for each checkpoint
    describe("Verify checkpoint creation while tokens are moved around", () => {
        before(deployUnionToken);
        before("Transfer tokens to George", async () => {
            await unionToken.transfer(GEORGE.address, "100");
        });

        const verifyBobsCheckpointNum = ({num}) => {
            it(`Bob's checkpoint number should be ${num}`, async () => {
                const res = await unionToken.numCheckpoints(BOB.address);
                res.toString().should.eq(num);
            });
        };

        const verifyBobsCheckpointVotes = ({num, votes}) => {
            it(`Bob's ${num} checkpoint should have correct votes`, async () => {
                const res = await unionToken.checkpoints(BOB.address, num);
                res.votes.toString().should.eq(votes);
            });
        };

        verifyBobsCheckpointNum({num: "0"});

        it("George should delegate to Bob", async () => {
            await unionToken.connect(GEORGE).delegate(BOB.address);
        });
        verifyBobsCheckpointVotes({num: "0", votes: "100"});
        verifyBobsCheckpointNum({num: "1"});

        it("George should transfer some tokens to Alice", async () => {
            await unionToken.connect(GEORGE).transfer(ALICE.address, "10");
        });
        verifyBobsCheckpointVotes({num: "1", votes: "90"});
        verifyBobsCheckpointNum({num: "2"});

        it("George should transfer tokens to ALice", async () => {
            await unionToken.connect(GEORGE).transfer(ALICE.address, "10");
        });
        verifyBobsCheckpointVotes({num: "2", votes: "80"});
        verifyBobsCheckpointNum({num: "3"});

        it("Alice should transfer some tokens from Admin to George", async () => {
            await unionToken.approve(ALICE.address, "20");
            await unionToken.connect(ALICE).transferFrom(ADMIN.address, GEORGE.address, "20");
        });
        verifyBobsCheckpointVotes({num: "3", votes: "100"});
        verifyBobsCheckpointNum({num: "4"});
    });

    describe("Edge cases for getting prior votes", () => {
        before(deployUnionToken);

        it("reverts if block number >= current block", async () => {
            let blockNumber = await ethers.provider.getBlockNumber();
            await expect(unionToken.getPriorVotes(BOB.address, blockNumber + 10)).to.be.revertedWith(
                "ERC20Votes: block not yet mined"
            );
        });

        it("returns 0 if there are no checkpoints", async () => {
            const res = await unionToken.getPriorVotes(BOB.address, 0);
            res.toString().should.eq("0");
        });

        it("returns zero if < first checkpoint block", async () => {
            await waitNBlocks(1);
            await unionToken.delegate(BOB.address);
            let blockNumber = await ethers.provider.getBlockNumber();
            await waitNBlocks(2);

            let res = await unionToken.getPriorVotes(BOB.address, blockNumber - 1);
            res.toString().should.eq("0");

            res = await unionToken.getPriorVotes(BOB.address, blockNumber + 1);
            res.toString().should.eq("100000000000000000000000000");
        });

        it("returns the latest block if >= last checkpoint block", async () => {
            await unionToken.delegate(BOB.address);
            await waitNBlocks(2);
            let blockNumber = await ethers.provider.getBlockNumber();
            let res = await unionToken.getPriorVotes(BOB.address, blockNumber - 1);
            res.toString().should.eq("100000000000000000000000000");
        });
    });

    describe("Check Bob's votes for different blocks", () => {
        const interval = 5;
        const txBlock = 1;
        let startBlockNumber;

        beforeEach(async () => {
            await deployUnionToken();
            startBlockNumber = await ethers.provider.getBlockNumber();
        });

        it("Transfer tokens and check Bob's votes", async () => {
            await unionToken.delegate(BOB.address);
            await waitNBlocks(interval);

            let blockOffset = 0,
                votes = "0";
            res = await unionToken.getPriorVotes(BOB.address, startBlockNumber + blockOffset);
            res.toString().should.eq(votes);

            (blockOffset = 1), (votes = "100000000000000000000000000");
            res = await unionToken.getPriorVotes(BOB.address, startBlockNumber + blockOffset);
            res.toString().should.eq(votes);

            await unionToken.connect(ADMIN).transfer(ALICE.address, "10");
            await waitNBlocks(interval);

            (blockOffset = txBlock + interval), (votes = "100000000000000000000000000");
            res = await unionToken.getPriorVotes(BOB.address, startBlockNumber + blockOffset);
            res.toString().should.eq(votes);

            (blockOffset = txBlock + interval + 1), (votes = "99999999999999999999999990");
            res = await unionToken.getPriorVotes(BOB.address, startBlockNumber + blockOffset);
            res.toString().should.eq(votes);

            await unionToken.connect(ADMIN).transfer(ALICE.address, "10");
            await waitNBlocks(interval);

            (blockOffset = 2 * (txBlock + interval)), (votes = "99999999999999999999999990");
            res = await unionToken.getPriorVotes(BOB.address, startBlockNumber + blockOffset);
            res.toString().should.eq(votes);

            (blockOffset = 2 * (txBlock + interval) + 1), (votes = "99999999999999999999999980");
            res = await unionToken.getPriorVotes(BOB.address, startBlockNumber + blockOffset);
            res.toString().should.eq(votes);

            await unionToken.connect(ALICE).transfer(ADMIN.address, "20");
            await waitNBlocks(interval);

            (blockOffset = 3 * (txBlock + interval)), (votes = "99999999999999999999999980");
            res = await unionToken.getPriorVotes(BOB.address, startBlockNumber + blockOffset);
            res.toString().should.eq(votes);

            (blockOffset = 3 * (txBlock + interval) + 1), (votes = "100000000000000000000000000");
            res = await unionToken.getPriorVotes(BOB.address, startBlockNumber + blockOffset);
            res.toString().should.eq(votes);
        });
    });

    describe("Bob transfers Admin's tokens without allowance", () => {
        before(deployUnionToken);

        it("Bob should not have allowance to transfer Admin's tokens", async () => {
            const allowance = await unionToken.allowance(ADMIN.address, BOB.address);
            allowance.toString().should.eq("0");
        });

        it("Transfering tokens should revert", async () => {
            await expect(unionToken.connect(BOB).transferFrom(ADMIN.address, BOB.address, 1)).to.be.revertedWith(
                "ERC20: transfer amount exceeds allowance"
            );
        });
    });

    describe("Approve tokens using permit signature", () => {
        const TEST_AMOUNT = parseEther("1");
        const deadline = ethers.constants.MaxUint256;
        let nonce;
        let v, r, s;

        before(async () => {
            await deployUnionToken();
            nonce = await unionToken.nonces(BOB.address);
        });

        it("Allowance should be zero", async () => {
            const allowance = await unionToken.allowance(BOB.address, ALICE.address);
            allowance.toString().should.eq("0");
        });

        it("Admin should be able to send tx in which Bob permits Alice to spend tokens", async () => {
            const result = await signERC2612Permit(
                ethers.provider._hardhatProvider,
                {
                    name,
                    chainId: 31337,
                    version: "1",
                    verifyingContract: unionToken.address
                },
                BOB.address,
                ALICE.address,
                TEST_AMOUNT.toString()
            );
            await expect(
                await unionToken.permit(BOB.address, ALICE.address, TEST_AMOUNT, deadline, result.v, result.r, result.s)
            )
                .to.emit(unionToken, "Approval")
                .withArgs(BOB.address, ALICE.address, TEST_AMOUNT);
        });

        it("Allowance should be reflected in contract", async () => {
            const allowance = await unionToken.allowance(BOB.address, ALICE.address);
            allowance.toString().should.eq(TEST_AMOUNT.toString());
        });

        it("Nonce should be incremented for Bob", async () => {
            const nonce = await unionToken.nonces(BOB.address);
            nonce.toString().should.eq("1");
        });
    });

    describe("When Whitelist is enabled, only admin and comptroller can send Union", () => {
        before(deployUnionToken);
        before(async () => {
            await unionToken.enableWhitelist();
            await unionToken.whitelist(COMPTROLLER.address);
        });

        it("Whitelist should be enabled", async () => {
            const whitelistEnabled = await unionToken.whitelistEnabled();
            whitelistEnabled.should.eq(true);
        });

        it("Comptroller should be whitelisted", async () => {
            const isWhitelisted = await unionToken.isWhitelisted(COMPTROLLER.address);
            isWhitelisted.should.eq(true);
        });

        it("Admin should be whitelisted", async () => {
            const isWhitelisted = await unionToken.isWhitelisted(ADMIN.address);
            isWhitelisted.should.eq(true);
        });

        it("Admin should be able to transfer tokens to Comptroller", async () => {
            await unionToken.connect(ADMIN).transfer(COMPTROLLER.address, 10);
        });

        it("Comptroller should be able to transfer tokens to Bob", async () => {
            await unionToken.connect(COMPTROLLER).transfer(BOB.address, 10);
        });

        it("Bob should not be able to transfer tokens to admin", async () => {
            await expect(unionToken.connect(BOB).transfer(ADMIN.address, 1)).to.be.revertedWith(
                "Whitelistable: address not whitelisted"
            );
        });

        it("Bob should not be able to transfer tokens even after approval", async () => {
            try {
                await unionToken.connect(ADMIN).approve(BOB.address, 1);
            } catch (e) {
                // assert.fail("Approval failed");
            }
            await expect(unionToken.connect(BOB).transferFrom(ADMIN.address, BOB.address, 1)).to.be.revertedWith(
                "Whitelistable: address not whitelisted"
            );
        });

        it("Admin should be able to transfer Bob's approved tokens", async () => {
            try {
                await unionToken.connect(BOB).approve(ADMIN.address, 1);
            } catch (e) {
                // assert.fail("Approval failed");
            }
            await unionToken.connect(ADMIN).transferFrom(BOB.address, ADMIN.address, 1);
        });

        it("Comptroller should be able to transfer Bob's approved tokens", async () => {
            try {
                await unionToken.connect(BOB).approve(COMPTROLLER.address, 1);
            } catch (e) {
                // assert.fail("Approval failed");
            }
            await unionToken.connect(COMPTROLLER).transferFrom(BOB.address, COMPTROLLER.address, 1);
        });

        it("Disable whitelist", async () => {
            await unionToken.disableWhitelist();
        });

        it("Bob should be able to transfer his tokens", async () => {
            unionToken.connect(BOB).transfer(ADMIN.address, 1);
        });

        it("Bob should be able to transfer Admin's approved tokens", async () => {
            try {
                await unionToken.connect(BOB).approve(ADMIN.address, 1);
            } catch (e) {
                // assert.fail("Approval failed");
            }
            unionToken.connect(BOB).transferFrom(ADMIN.address, BOB.address, 1);
        });
    });
});
