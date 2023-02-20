const {ethers} = require("hardhat");

const {expect} = require("chai");
require("chai").should();
const {encodeParameters, etherMantissa, waitNBlocks, increaseTime} = require("../../utils");

async function enfranchise(contract, actor, amount) {
    await contract.transfer(actor.address, etherMantissa(amount));
    await contract.connect(actor).delegate(actor.address);
}

describe("Governor Contract", () => {
    before(async function () {
        [ADMIN, CONTRACT, ALICE, BOB, actor] = await ethers.getSigners();

        Domain = contract => ({
            name: "Union Governor",
            chainId: 31337,
            version: "1",
            verifyingContract: contract.address
        });
        Types = {
            Ballot: [
                {name: "proposalId", type: "uint256"},
                {name: "support", type: "uint8"}
            ]
        };

        (targets = [BOB.address]),
            (values = ["0"]),
            (signatures = ["getBalanceOf(address)"]),
            (callDatas = [encodeParameters(["address"], [BOB.address])]);
    });

    beforeEach(async () => {
        const UnionToken = await ethers.getContractFactory("UnionTokenMock");
        const Governor = await ethers.getContractFactory("UnionGovernorMock");
        unionToken = await UnionToken.deploy("Union Token", "unionToken");
        Timelock = await ethers.getContractFactory("TimelockController");
        timelock = await Timelock.deploy(0, [ADMIN.address], [ADMIN.address]);
        governor = await Governor.deploy(unionToken.address, timelock.address);

        await unionToken.connect(ADMIN).delegate(ADMIN.address);
        await governor
            .connect(ADMIN)
            ["propose(address[],uint256[],string[],bytes[],string)"](
                targets,
                values,
                signatures,
                callDatas,
                "do nothing"
            );
        proposalId = await governor.latestProposalIds(ADMIN.address);
    });

    it("There does not exist a proposal with matching proposal id where the current block number is between the proposal's start block (exclusive) and end block (inclusive)", async () => {
        await expect(governor.connect(ADMIN).castVote(proposalId, 1)).to.be.revertedWith(
            "Governor: vote not currently active"
        );
    });

    it("Such proposal already has an entry in its voters set matching the sender", async () => {
        await waitNBlocks(2);
        await governor.connect(ALICE).castVote(proposalId, 1);

        await expect(governor.connect(ALICE).castVote(proposalId, 1)).to.be.revertedWith(
            "GovernorCompatibilityBravo: vote already cast"
        );
    });

    it("we add the sender to the proposal's voters set", async () => {
        let res;
        res = await governor.getReceipt(proposalId, ALICE.address);
        res.hasVoted.should.eq(false);
        await waitNBlocks(2);
        await governor.connect(ALICE).castVote(proposalId, 1);
        res = await governor.connect(ALICE).getReceipt(proposalId, ALICE.address);
        res.hasVoted.should.eq(true);
    });

    it("and we add that ForVotes", async () => {
        await enfranchise(unionToken, actor, 40000001);
        let targets = [actor.address];
        await governor
            .connect(actor)
            ["propose(address[],uint256[],string[],bytes[],string)"](
                targets,
                values,
                signatures,
                callDatas,
                "do nothing"
            );
        proposalId = await governor.latestProposalIds(actor.address);
        let beforeFors = await governor.proposals(proposalId);
        beforeFors.forVotes.toString().should.eq("0");
        await waitNBlocks(2);
        const votes = await unionToken.getCurrentVotes(actor.address);
        await governor.connect(actor).castVote(proposalId, 1);
        let afterFors = await governor.proposals(proposalId);
        afterFors.forVotes.toString().should.eq(votes.toString());
    });

    it("or AgainstVotes corresponding to the caller's support flag.", async () => {
        await enfranchise(unionToken, actor, 40000001);
        let targets = [actor.address];
        await governor
            .connect(actor)
            ["propose(address[],uint256[],string[],bytes[],string)"](
                targets,
                values,
                signatures,
                callDatas,
                "do nothing"
            );
        proposalId = await governor.latestProposalIds(actor.address);
        let beforeAgainsts = await governor.proposals(proposalId);
        beforeAgainsts.againstVotes.toString().should.eq("0");
        await waitNBlocks(2);
        const votes = await unionToken.getCurrentVotes(actor.address);
        await governor.connect(actor).castVote(proposalId, 0);
        let afterAgainsts = await governor.proposals(proposalId);
        afterAgainsts.againstVotes.toString().should.eq(votes.toString());
    });

    it("reverts if the signatory is invalid", async () => {
        await expect(
            governor.castVoteBySig(
                proposalId,
                0,
                0,
                "0x0000000000000000000000000000000000000000000000000000000000000bad",
                "0x0000000000000000000000000000000000000000000000000000000000000bad"
            )
        ).to.be.revertedWith("ECDSA: invalid signature 'v' value");
    });

    it("casts vote on behalf of the signatory", async () => {
        await enfranchise(unionToken, BOB, 100000);
        let targets = [actor.address];
        await governor
            .connect(BOB)
            ["propose(address[],uint256[],string[],bytes[],string)"](
                targets,
                values,
                signatures,
                callDatas,
                "do nothing"
            );
        proposalId = await governor.latestProposalIds(BOB.address);
        const signature = await BOB._signTypedData(Domain(governor), Types, {
            proposalId,
            support: 1
        });
        const {v, r, s} = ethers.utils.splitSignature(signature);

        let beforeFors = await governor.proposals(proposalId);
        beforeFors.forVotes.toString().should.eq("0");
        await waitNBlocks(2);
        const votes = await unionToken.getCurrentVotes(BOB.address);
        await governor.connect(ADMIN).castVoteBySig(proposalId, 1, v, r, s);
        let afterFors = await governor.proposals(proposalId);
        afterFors.forVotes.toString().should.eq(votes.toString());
    });
});

describe("Governor Contract Propose", () => {
    let governor, unionToken, proposalId;
    before(async () => {
        [ADMIN, CONTRACT, ALICE, BOB] = await ethers.getSigners();
        targets = [ADMIN.address];
        values = ["0"];
        signatures = ["getBalanceOf(address)"];
        callDatas = [encodeParameters(["address"], [BOB.address])];

        const UnionToken = await ethers.getContractFactory("UnionTokenMock");
        const Governor = await ethers.getContractFactory("UnionGovernorMock");
        unionToken = await UnionToken.deploy("Union Token", "unionToken");
        Timelock = await ethers.getContractFactory("TimelockController");
        timelock = await Timelock.deploy(0, [ADMIN.address], [ADMIN.address]);
        governor = await Governor.deploy(unionToken.address, timelock.address);

        await unionToken.connect(ADMIN).delegate(ADMIN.address);
        await governor
            .connect(ADMIN)
            ["propose(address[],uint256[],string[],bytes[],string)"](
                targets,
                values,
                signatures,
                callDatas,
                "do nothing"
            );
        proposalBlock = +(await ethers.provider.getBlockNumber());
        proposalId = await governor.latestProposalIds(ADMIN.address);
        trivialProposal = await governor.proposals(proposalId);
    });

    it("ID is set to a globally unique identifier", async () => {
        trivialProposal.id.toString().should.eq(proposalId.toString());
    });

    it("Proposer is set to the sender", async () => {
        trivialProposal.proposer.should.eq(ADMIN.address);
    });

    it("Start block is set to the current block number plus vote delay", async () => {
        trivialProposal.startBlock.toString().should.eq(proposalBlock + 2 + "");
    });

    it("End block is set to the current block number plus vote delay and vote period", async () => {
        const period = await governor.votingPeriod();
        const delay = await governor.votingDelay();
        trivialProposal.endBlock.should.eq((parseInt(proposalBlock) + parseInt(delay) + parseInt(period)).toString());
    });

    it("ForVotes and AgainstVotes are initialized to zero", async () => {
        trivialProposal.forVotes.toString().should.eq("0");
        trivialProposal.againstVotes.toString().should.eq("0");
    });

    it("Executed and Canceled flags are initialized to false", async () => {
        trivialProposal.canceled.should.eq(false);
        trivialProposal.executed.should.eq(false);
    });

    it("ETA is initialized to zero", async () => {
        trivialProposal.eta.toString().should.eq("0");
    });

    it("Targets, Values, Signatures, Calldatas are set according to parameters", async () => {
        let dynamicFields = await governor.getActions(trivialProposal.id);
        dynamicFields.targets[0].should.eq(ADMIN.address);
        dynamicFields.signatures[0].should.eq("getBalanceOf(address)");
        dynamicFields.calldatas[0].should.eq(encodeParameters(["address"], [BOB.address]));
    });

    it("proposer votes below proposal threshold", async () => {
        await expect(
            governor
                .connect(BOB)
                ["propose(address[],uint256[],string[],bytes[],string)"](
                    targets.concat(ADMIN.address),
                    values,
                    signatures,
                    callDatas,
                    "do nothing"
                )
        ).to.be.revertedWith("GovernorCompatibilityBravo: proposer votes below proposal threshold");
    });

    it("the length of the values, signatures or calldatas arrays are not the same length", async () => {
        await unionToken.transfer(BOB.address, etherMantissa(400001));
        await unionToken.connect(BOB).delegate(BOB.address);

        await expect(
            governor
                .connect(BOB)
                ["propose(address[],uint256[],string[],bytes[],string)"](
                    targets.concat(ALICE.address),
                    values,
                    signatures,
                    callDatas,
                    "do nothing"
                )
        ).to.be.revertedWith("Governor: invalid proposal length");

        await expect(
            governor
                .connect(BOB)
                ["propose(address[],uint256[],string[],bytes[],string)"](
                    targets,
                    values.concat(values),
                    signatures,
                    callDatas,
                    "do nothing"
                )
        ).to.be.revertedWith("Governor: invalid proposal length");

        await expect(
            governor
                .connect(BOB)
                ["propose(address[],uint256[],string[],bytes[],string)"](
                    targets,
                    values,
                    signatures,
                    callDatas.concat(callDatas),
                    "do nothing"
                )
        ).to.be.revertedWith("Governor: invalid proposal length");
    });

    it("or if that length is zero or greater than Max Operations.", async () => {
        await unionToken.transfer(BOB.address, etherMantissa(400001));
        await unionToken.connect(BOB).delegate(BOB.address);
        await expect(
            governor.connect(BOB)["propose(address[],uint256[],string[],bytes[],string)"]([], [], [], [], "do nothing")
        ).to.be.revertedWith("Governor: empty proposal");
    });

    it("reverts with active", async () => {
        await waitNBlocks(2);

        await expect(
            governor["propose(address[],uint256[],string[],bytes[],string)"](
                targets,
                values,
                signatures,
                callDatas,
                "do nothing"
            )
        ).to.be.revertedWith("Governor: found an already active proposal");
    });
});

describe("Governor Contract Queue", () => {
    let governor, unionToken;
    before(async () => {
        [ADMIN, BOB] = await ethers.getSigners();
        const UnionToken = await ethers.getContractFactory("UnionTokenMock");
        const Governor = await ethers.getContractFactory("UnionGovernorMock");
        unionToken = await UnionToken.deploy("Union Token", "unionToken");
        Timelock = await ethers.getContractFactory("TimelockController");
        timelock = await Timelock.deploy(0, [ADMIN.address], [ADMIN.address]);
        governor = await Governor.deploy(unionToken.address, timelock.address);
        await timelock.grantRole(ethers.utils.id("TIMELOCK_ADMIN_ROLE"), governor.address);
        await timelock.grantRole(ethers.utils.id("PROPOSER_ROLE"), governor.address);
        await timelock.grantRole(ethers.utils.id("EXECUTOR_ROLE"), governor.address);

        await timelock.renounceRole(ethers.utils.id("TIMELOCK_ADMIN_ROLE"), ADMIN.address);
        await timelock.renounceRole(ethers.utils.id("PROPOSER_ROLE"), ADMIN.address);
        await timelock.renounceRole(ethers.utils.id("EXECUTOR_ROLE"), ADMIN.address);
    });

    it("reverts on proposal state not Succeeded", async () => {
        await enfranchise(unionToken, BOB, 40000001);
        await waitNBlocks(1);

        const targets = [unionToken.address];
        const values = ["0"];
        const signatures = ["getBalanceOf(address)"];
        const calldatas = [encodeParameters(["address"], [ADMIN.address])];

        await governor
            .connect(BOB)
            ["propose(address[],uint256[],string[],bytes[],string)"](
                targets,
                values,
                signatures,
                calldatas,
                "do nothing"
            );

        const proposalId = await governor.latestProposalIds(BOB.address);

        await waitNBlocks(2);

        await governor.connect(BOB).castVote(proposalId, 1);

        //state is pending
        await expect(governor["queue(uint256)"](proposalId)).to.be.revertedWith("Governor: proposal not successful");

        await waitNBlocks(5760);

        await governor["queue(uint256)"](proposalId);
        //state is queue
        await expect(governor["queue(uint256)"](proposalId)).to.be.revertedWith("Governor: proposal not successful");
    });
});

describe("Governor Contract State", () => {
    let governor, unionToken;
    let trivialProposal, targets, values, signatures, callDatas;
    before(async () => {
        [ADMIN, ALICE, BOB, CONTRACT] = await ethers.getSigners();

        const UnionToken = await ethers.getContractFactory("UnionTokenMock");
        const Governor = await ethers.getContractFactory("UnionGovernorMock");
        unionToken = await UnionToken.deploy("Union Token", "unionToken");
        Timelock = await ethers.getContractFactory("TimelockController");
        timelock = await Timelock.deploy(0, [ADMIN.address], [ADMIN.address]);
        governor = await Governor.deploy(unionToken.address, timelock.address);

        await unionToken.transfer(BOB.address, etherMantissa(40000000));
        await unionToken.connect(BOB).delegate(BOB.address);

        targets = [ADMIN.address];
        values = ["0"];
        signatures = ["getBalanceOf(address)"];
        callDatas = [encodeParameters(["address"], [BOB.address])];

        await unionToken.delegate(ADMIN.address);
        await governor["propose(address[],uint256[],string[],bytes[],string)"](
            targets,
            values,
            signatures,
            callDatas,
            "do nothing"
        );

        proposalId = await governor.latestProposalIds(ADMIN.address);
        trivialProposal = await governor.proposals(proposalId);
    });

    it("Invalid for proposal not found", async () => {
        await expect(governor.state("5")).to.be.revertedWith("Governor: unknown proposal id");
    });

    it("Pending", async () => {
        const res = await governor.state(trivialProposal.id);
        res.toString().should.eq("0");
    });

    it("Active", async () => {
        await waitNBlocks(2);
        const res = await governor.state(trivialProposal.id);
        res.toString().should.eq("1");
    });

    it("Canceled", async () => {
        await unionToken.transfer(ALICE.address, etherMantissa(40000000));
        await unionToken.connect(ALICE).delegate(ALICE.address);

        await waitNBlocks(1);
        let targets = [ALICE.address];
        await governor
            .connect(ALICE)
            ["propose(address[],uint256[],string[],bytes[],string)"](
                targets,
                values,
                signatures,
                callDatas,
                "do nothing"
            );
        let newProposalId = await governor.latestProposalIds(ALICE.address);

        // send away the delegates
        await unionToken.connect(ALICE).delegate(ADMIN.address);
        await governor.cancel(newProposalId);

        const res = await governor.state(newProposalId);
        res.toString().should.eq("2");
    });

    it("Defeated", async () => {
        await waitNBlocks(5760);

        const res = await governor.state(trivialProposal.id);
        res.toString().should.eq("3");
    });

    it("Succeeded", async () => {
        await waitNBlocks(1);
        let targets = [BOB.address];
        await governor
            .connect(BOB)
            ["propose(address[],uint256[],string[],bytes[],string)"](
                targets,
                values,
                signatures,
                callDatas,
                "do nothing"
            );

        const newProposalId = await governor.latestProposalIds(BOB.address);

        await waitNBlocks(2);
        await governor.castVote(newProposalId, 1);
        const votingPeriod = await governor.votingPeriod();
        await waitNBlocks(parseInt(votingPeriod));
        const res = await governor.state(newProposalId);
        res.toString().should.eq("4");
    });
});

describe("Change New Governor Contract", () => {
    let governor, unionToken;
    let targets, values, signatures, callDatas;
    before(async () => {
        [ADMIN, ALICE, BOB, CONTRACT] = await ethers.getSigners();

        const UnionToken = await ethers.getContractFactory("UnionTokenMock");
        const Governor = await ethers.getContractFactory("UnionGovernorMock");
        unionToken = await UnionToken.deploy("Union Token", "unionToken");
        Timelock = await ethers.getContractFactory("TimelockController");
        timelock = await Timelock.deploy(0, [ADMIN.address], [ADMIN.address]);
        governor = await Governor.deploy(unionToken.address, timelock.address);

        await timelock.grantRole(ethers.utils.id("TIMELOCK_ADMIN_ROLE"), governor.address);
        await timelock.grantRole(ethers.utils.id("PROPOSER_ROLE"), governor.address);
        await timelock.grantRole(ethers.utils.id("EXECUTOR_ROLE"), governor.address);
        await timelock.renounceRole(ethers.utils.id("TIMELOCK_ADMIN_ROLE"), ADMIN.address);
        await timelock.renounceRole(ethers.utils.id("PROPOSER_ROLE"), ADMIN.address);
        await timelock.renounceRole(ethers.utils.id("EXECUTOR_ROLE"), ADMIN.address);

        await unionToken.transfer(BOB.address, etherMantissa(40000000));
        await unionToken.connect(BOB).delegate(BOB.address);
        targets = [timelock.address];
        values = ["0"];
        signatures = ["updateDelay(uint256)"];
        callDatas = [encodeParameters(["uint256"], [1])];

        await unionToken.delegate(ADMIN.address);
    });

    it("Set timelock pending admin to new gov address", async () => {
        await waitNBlocks(1);
        await governor
            .connect(BOB)
            ["propose(address[],uint256[],string[],bytes[],string)"](
                targets,
                values,
                signatures,
                callDatas,
                "do nothing"
            );

        const newProposalId = await governor.latestProposalIds(BOB.address);

        await waitNBlocks(2);
        await governor.castVote(newProposalId, 1);
        const votingPeriod = await governor.votingPeriod();
        await waitNBlocks(parseInt(votingPeriod));
        let state = await governor.state(newProposalId);
        state.toString().should.eq("4");
        await governor.connect(BOB)["queue(uint256)"](newProposalId);
        state = await governor.state(newProposalId);
        state.toString().should.eq("5");

        await increaseTime(7 * 24 * 60 * 60);

        await governor.connect(BOB)["execute(uint256)"](newProposalId);
        state = await governor.state(newProposalId);
        state.toString().should.eq("7");
    });
});
