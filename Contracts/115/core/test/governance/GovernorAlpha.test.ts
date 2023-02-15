import {
  AddressProviderInstance,
  GovernanceAddressProviderInstance,
  ConfigProviderInstance,
  AccessControllerInstance,
  VotingEscrowInstance,
  MockMIMOInstance,
  TestTimelockInstance,
  GovernorAlphaInstance,
  VotingMinerInstance,
  MIMOInstance,
} from "../../types/truffle-contracts";
import { buildMultiProposal, buildTestProposal, Proposal } from "./utils";
import { setupMIMO } from "../utils/helpers";

const { BN, expectEvent, expectRevert, time } = require("@openzeppelin/test-helpers");

const AddressProvider = artifacts.require("AddressProvider");
const GovernanceAddressProvider = artifacts.require("GovernanceAddressProvider");
const ConfigProvider = artifacts.require("ConfigProvider");
const AccessController = artifacts.require("AccessController");
const MockMIMO = artifacts.require("MockMIMO");
const VotingEscrow = artifacts.require("VotingEscrow");
const Timelock = artifacts.require("TestTimelock");
const GovernorAlpha = artifacts.require("GovernorAlpha");
const VotingMiner = artifacts.require("VotingMiner");

const MINT_AMOUNT = new BN("100000000000000000000"); // 100 GOV
const STAKE_AMOUNT = new BN("50000000000000000000"); // 50 GOV
const MULTI_TRANSFER_AMOUNT = new BN("500");
const ONE_YEAR = time.duration.years(1);
const BUFFER = time.duration.minutes(5);
const MIN_VOTING_PERIOD = time.duration.days(3); // 3 days
const MAX_VOTING_PERIOD = time.duration.days(14); // 14 days
const NAME = "Parallel Governance Voting Token";
const SYMBOL = "vMIMO";

/* eslint-disable no-unused-vars */
enum ProposalState {
  Active,
  Canceled,
  Defeated,
  Succeeded,
  Queued,
  Expired,
  Executed,
}
/* eslint-enable */

contract("GovernorAlpha", (accounts) => {
  const [owner, guardian, proposer, voter, nonVoter, A, B, newAdmin] = accounts;

  let a: AddressProviderInstance;
  let ga: GovernanceAddressProviderInstance;
  let config: ConfigProviderInstance;
  let controller: AccessControllerInstance;
  let stakingToken: MockMIMOInstance;
  let escrow: VotingEscrowInstance;
  let timelock: TestTimelockInstance;
  let governance: GovernorAlphaInstance;
  let miner: VotingMinerInstance;
  let startTime: any;
  let mimo: MIMOInstance;

  beforeEach(async () => {
    // Deploy gov token and escrow
    controller = await AccessController.new();
    stakingToken = await MockMIMO.new();
    timelock = await Timelock.new(owner, time.duration.days(2));
    a = await AddressProvider.new(controller.address);
    ga = await GovernanceAddressProvider.new(a.address);
    miner = await VotingMiner.new(ga.address);
    escrow = await VotingEscrow.new(stakingToken.address, controller.address, miner.address, NAME, SYMBOL);
    config = await ConfigProvider.new(a.address);

    mimo = await setupMIMO(a.address, controller, owner, [owner]);
    await ga.setMIMO(mimo.address);

    await a.setConfigProvider(config.address);
    await ga.setParallelAddressProvider(a.address);
    await ga.setVotingEscrow(escrow.address);
    await ga.setTimelock(timelock.address);

    // Deploy  governor
    governance = await GovernorAlpha.new(ga.address, guardian);
    await timelock.harnessSetAdmin(governance.address); // Transfer ownership of timelock to governance

    // Mint tokens to users and stake to accrue voting power
    startTime = await time.latest();
    // 1. Proposer
    await stakingToken.mint(proposer, MINT_AMOUNT);
    await stakingToken.approve(escrow.address, STAKE_AMOUNT, { from: proposer });
    await escrow.createLock(STAKE_AMOUNT, startTime.add(ONE_YEAR), { from: proposer });

    // 2. Voter
    await stakingToken.mint(voter, MINT_AMOUNT);
    await stakingToken.approve(escrow.address, STAKE_AMOUNT, { from: voter });
    await escrow.createLock(STAKE_AMOUNT, startTime.add(ONE_YEAR), { from: voter });
  });

  async function proposeTestProposal(): Promise<Proposal> {
    const proposal = buildTestProposal(escrow.address, proposer);
    const { targets, values, signatures, calldatas, description } = proposal;
    const endTime = (await time.latest()).add(MIN_VOTING_PERIOD).add(new BN(5));
    await governance.propose(targets, values, signatures, calldatas, description, endTime, { from: proposer });
    return proposal;
  }

  async function proposeMultiProposal(): Promise<Proposal> {
    const proposal = buildMultiProposal(stakingToken.address, MULTI_TRANSFER_AMOUNT, [A, B]);
    const { targets, values, signatures, calldatas, description } = proposal;
    const endTime = (await time.latest()).add(MIN_VOTING_PERIOD).add(new BN(5));
    await governance.propose(targets, values, signatures, calldatas, description, endTime, { from: proposer });
    return proposal;
  }

  // Advance time past proposal.endTime
  async function advancePastEndTime(proposalId: BN): Promise<BN> {
    const proposal = await governance.proposals(proposalId);
    const endTime = proposal[4];
    time.increaseTo(endTime.add(new BN(1)));
    return endTime;
  }

  // Advance time past timelock delay to execute
  async function advanceToETA(proposalId: BN): Promise<BN> {
    const proposal = await governance.proposals(proposalId);
    const eta = proposal[2];
    await time.increaseTo(eta);
    return eta;
  }

  it("GovernorAlpha should be initialized correctly", async () => {
    const minVotingPeriod = await config.minVotingPeriod();
    assert(minVotingPeriod.eq(MIN_VOTING_PERIOD));
    const maxVotingPeriod = await config.maxVotingPeriod();
    assert(maxVotingPeriod.eq(MAX_VOTING_PERIOD));

    // TO DO: check for quorum config & proposal treshold
  });

  it("should not be able to create a proposal with less time than minVotingPeriod remaining", async () => {
    const { targets, values, signatures, calldatas, description } = buildTestProposal(escrow.address, proposer);
    const endTime = (await time.latest()).add(MIN_VOTING_PERIOD).sub(new BN(5));
    await expectRevert(
      governance.propose(targets, values, signatures, calldatas, description, endTime, { from: nonVoter }),
      "Proposal end-time too early",
    );
  });

  it("should not be able to create a proposal with more voting time than maxVotingPeriod", async () => {
    const { targets, values, signatures, calldatas, description } = buildTestProposal(escrow.address, proposer);
    const endTime = (await time.latest()).add(MAX_VOTING_PERIOD).add(new BN(5));
    await expectRevert(
      governance.propose(targets, values, signatures, calldatas, description, endTime, { from: nonVoter }),
      "Proposal end-time too late",
    );
  });

  it("should NOT be able to propose if proposalThreshold is NOT met", async () => {
    const { targets, values, signatures, calldatas, description } = buildTestProposal(escrow.address, proposer);
    const voterVotingPowerBalance = await escrow.balanceOf(nonVoter);
    const proposalThreshold = await governance.proposalThreshold();
    assert(voterVotingPowerBalance.lt(proposalThreshold));

    const endTime = (await time.latest()).add(MIN_VOTING_PERIOD).add(new BN(5));
    await expectRevert(
      governance.propose(targets, values, signatures, calldatas, description, endTime, { from: nonVoter }),
      "GovernorAlpha::propose: proposer votes below proposal threshold",
    );
  });

  it("should NOT be able to propose if targets, values, signatures, calldatas have zero length", async () => {
    const { description } = buildTestProposal(escrow.address, proposer);
    const voterVotingPowerBalance = await escrow.balanceOf(proposer);
    const proposalThreshold = await governance.proposalThreshold();
    assert(voterVotingPowerBalance.gte(proposalThreshold), "Voter balance must be at least 1% totalSupply to propose");

    const endTime = (await time.latest()).add(MIN_VOTING_PERIOD).add(new BN(5));
    await expectRevert(
      governance.propose([], [], [], [], description, endTime, { from: proposer }),
      "GovernorAlpha::propose: must provide actions",
    );
  });

  it("should NOT be able to propose if targets, values, signatures, calldatas length do not match", async () => {
    const { targets, values, signatures, calldatas, description } = buildTestProposal(escrow.address, proposer);
    const voterVotingPowerBalance = await escrow.balanceOf(proposer);
    const proposalThreshold = await governance.proposalThreshold();
    assert(voterVotingPowerBalance.gte(proposalThreshold), "Voter balance must be at least 1% totalSupply to propose");

    const endTime = (await time.latest()).add(MIN_VOTING_PERIOD).add(new BN(5));
    await expectRevert(
      governance.propose(targets, [], signatures, calldatas, description, endTime, { from: proposer }),
      "GovernorAlpha::propose: proposal function information arity mismatch",
    );

    await expectRevert(
      governance.propose(targets, values, [], calldatas, description, endTime, { from: proposer }),
      "GovernorAlpha::propose: proposal function information arity mismatch",
    );

    await expectRevert(
      governance.propose(targets, values, signatures, [], description, endTime, { from: proposer }),
      "GovernorAlpha::propose: proposal function information arity mismatch",
    );
  });

  it("should NOT be able to propose if having too many actions", async () => {
    const { targets, values, signatures, calldatas, description } = buildTestProposal(escrow.address, proposer, 11);
    const voterVotingPowerBalance = await escrow.balanceOf(proposer);
    const proposalThreshold = await governance.proposalThreshold();
    assert(voterVotingPowerBalance.gte(proposalThreshold), "Voter balance must be at least 1% totalSupply to propose");

    const endTime = (await time.latest()).add(MIN_VOTING_PERIOD).add(new BN(5));
    await expectRevert(
      governance.propose(targets, values, signatures, calldatas, description, endTime, { from: proposer }),
      "GovernorAlpha::propose: too many actions",
    );
  });

  it("should be able to propose a new Proposal if proposalThreshold is met", async () => {
    const { targets, values, signatures, calldatas, description } = buildTestProposal(escrow.address, proposer);
    const voterVotingPowerBalance = await escrow.balanceOf(proposer);
    const proposalThreshold = await governance.proposalThreshold();
    assert(voterVotingPowerBalance.gte(proposalThreshold), "Voter balance must be at least 1% totalSupply to propose");

    const endTime = (await time.latest()).add(MIN_VOTING_PERIOD).add(new BN(5));
    const tx = await governance.propose(targets, values, signatures, calldatas, description, endTime, {
      from: proposer,
    });
    await expectEvent(tx, "ProposalCreated", {
      id: "1",
      proposer,
      targets,
      signatures,
      calldatas,
      description,
    });
    const proposalCount = await governance.proposalCount();
    const proposal = await governance.proposals(proposalCount);
    // @ts-expect-error
    assert.equal(proposal.endTime.toString(), endTime.toString());
    // @ts-expect-error
    assert.equal(proposal.forVotes.toString(), "0");
    // @ts-expect-error
    assert.equal(proposal.againstVotes.toString(), "0");
    // @ts-expect-error
    assert.equal(proposal.eta.toString(), "0");
    // @ts-expect-error
    assert.equal(proposal.canceled, false);
    // @ts-expect-error
    assert.equal(proposal.executed, false);

    const state = await governance.state(proposalCount);
    assert.equal(state.toNumber(), ProposalState.Active);

    const actions = await governance.getActions(proposalCount);
    assert.equal(actions[0].length, 1);
    assert.equal(actions[0][0], targets[0]);
    assert.equal(actions[1].length, 1);
    assert.equal(actions[1].map((bn) => bn.toString())[0], values[0]);
    assert.equal(actions[2].length, 1);
    assert.equal(actions[2][0], signatures[0]);
    assert.equal(actions[3].length, 1);
    assert.equal(actions[3][0], calldatas[0]);
  });

  it("should NOT be able to propose if having active proposal", async () => {
    const { targets, values, signatures, calldatas, description } = buildTestProposal(escrow.address, proposer);
    const voterVotingPowerBalance = await escrow.balanceOf(proposer);
    const proposalThreshold = await governance.proposalThreshold();
    assert(voterVotingPowerBalance.gte(proposalThreshold), "Voter balance must be at least 1% totalSupply to propose");

    const endTime = (await time.latest()).add(MIN_VOTING_PERIOD).add(new BN(5));

    await governance.propose(targets, values, signatures, calldatas, description, endTime, {
      from: proposer,
    });

    await expectRevert(
      governance.propose(targets, values, signatures, calldatas, description, endTime, { from: proposer }),
      "GovernorAlpha::propose: one live proposal per proposer, found an already active proposal",
    );
  });

  describe("After a proposal is proposed", async () => {
    let proposalId: BN;

    beforeEach(async () => {
      await proposeTestProposal();
      proposalId = await governance.proposalCount();
    });

    it("should NOT be able to cast a vote on a invalid proposal id", async () => {
      await expectRevert(governance.castVote("2", false, { from: voter }), "GovernorAlpha::state: invalid proposal id");
    });

    it("should be able to vote for a Proposal", async () => {
      const support = true;
      const tx = await governance.castVote(proposalId, support, { from: voter });
      const receipt = await governance.getReceipt(proposalId, voter);
      const proposal = await governance.proposals(proposalId);
      // @ts-expect-error
      const { endTime } = proposal;
      const votes = await escrow.balanceOfAt(voter, endTime);
      assert.equal(receipt.hasVoted, true);
      assert.equal(receipt.support, support);
      assert(receipt.votes, votes.toString());
      await expectEvent(tx, "VoteCast", {
        voter,
        proposalId,
        support,
        votes,
      });
    });

    it("should be able to vote against a Proposal", async () => {
      const support = false;
      const tx = await governance.castVote(proposalId, support, { from: voter });
      const receipt = await governance.getReceipt(proposalId, voter);
      const proposal = await governance.proposals(proposalId);
      // @ts-expect-error
      const { endTime } = proposal;
      const votes = await escrow.balanceOfAt(voter, endTime);
      assert.equal(receipt.hasVoted, true);
      assert.equal(receipt.support, support);
      assert(receipt.votes, votes.toString());
      await expectEvent(tx, "VoteCast", {
        voter,
        proposalId,
        support,
        votes,
      });
    });

    it("should NOT be able to change a vote on a Proposal", async () => {
      await governance.castVote(proposalId, true, { from: voter });
      await expectRevert(
        governance.castVote(proposalId, false, { from: voter }),
        "GovernorAlpha::_castVote: voter already voted",
      );
    });

    it("should NOT be able to cast a vote on a inactive proposal", async () => {
      await governance.cancel(proposalId, { from: guardian });

      await expectRevert(
        governance.castVote(proposalId, false, { from: voter }),
        "GovernorAlpha::_castVote: voting is closed",
      );
    });

    it("guardian should be able to cancel a non-executed Proposal", async () => {
      const governanceGuardian = await governance.guardian();
      assert.equal(governanceGuardian, guardian);

      const tx = await governance.cancel(proposalId, { from: guardian });
      await expectEvent(tx, "ProposalCanceled", {
        id: proposalId,
      });
      const proposalState = await governance.state(proposalId);
      assert.equal(proposalState.toNumber(), ProposalState.Canceled);
      const cancelledProposal = await governance.proposals(proposalId);
      const isCancelled = cancelledProposal[7];
      assert.equal(isCancelled, true);
    });

    it("non-guardians should NOT be able to cancel a non-executed Proposal", async () => {
      const governanceGuardian = await governance.guardian();
      assert(governanceGuardian !== voter);

      await expectRevert(governance.cancel(proposalId, { from: voter }), "Only Guardian can cancel");
      const proposalState = await governance.state(proposalId);
      assert.equal(proposalState.toNumber(), ProposalState.Active);
    });

    it("should NOT be able to queue an un-successful Proposal", async () => {
      await governance.castVote(proposalId, false, { from: voter });
      await advancePastEndTime(proposalId);

      // Assert proposal.forVotes < proposal.againstVotes
      const proposal = await governance.proposals(proposalId);
      const forVotes = proposal[5];
      const againstVotes = proposal[6];
      assert(forVotes.lt(againstVotes));

      // Proposal state === ProposalState.Defeated
      const proposalState = await governance.state(proposalId);
      assert.equal(proposalState.toNumber(), ProposalState.Defeated);

      await expectRevert(
        governance.queue(proposalId),
        "GovernorAlpha::queue: proposal can only be queued if it is succeeded",
      );
    });

    describe("After vote a proposal", async () => {
      beforeEach(async () => {
        await governance.castVote(proposalId, true, { from: voter });
        await advancePastEndTime(proposalId);
      });

      it("should be able to queue a successful Proposal", async () => {
        // Assert proposal.forVotes > proposal.againstVotes && proposal.forVotes > quorumVotes(proposal.startBlock)
        const proposal = await governance.proposals(proposalId);
        const quorumVotes = await governance.quorumVotes();
        const forVotes = proposal[5];
        const againstVotes = proposal[6];
        assert(forVotes.gt(againstVotes));
        assert(forVotes.gt(quorumVotes));

        // Proposal state === ProposalState.Succeeded
        const proposalState = await governance.state(proposalId);
        assert.equal(proposalState.toNumber(), ProposalState.Succeeded);

        const tx = await governance.queue(proposalId);
        await expectEvent(tx, "ProposalQueued", {
          id: proposalId,
        });
        const queuedProposalState = await governance.state(proposalId);
        assert.equal(queuedProposalState.toNumber(), ProposalState.Queued);
      });

      it("should NOT be able to execute an un-queued Proposal", async () => {
        await expectRevert(
          governance.execute(proposalId),
          "GovernorAlpha::execute: proposal can only be executed if it is queued",
        );
      });

      describe("After queue a proposal", async () => {
        beforeEach(async () => {
          await governance.queue(proposalId);
          await advanceToETA(proposalId);
        });

        it("should expire a queued Proposal after GRACE_PERIOD of 14 days", async () => {
          // Pass time beyond exucution window
          await time.increase(time.duration.days(15));
          const proposalState = await governance.state(proposalId);
          assert.equal(proposalState.toNumber(), ProposalState.Expired);
        });

        it("should be able to execute a Proposal", async () => {
          const tx = await governance.execute(proposalId);
          await expectEvent(tx, "ProposalExecuted", {
            id: proposalId,
          });
          const executedProposalState = await governance.state(proposalId);
          assert.equal(executedProposalState.toNumber(), ProposalState.Executed);
          const executedProposal = await governance.proposals(proposalId);
          const isExecuted = executedProposal[8];
          assert.equal(isExecuted, true);
        });

        it("should NOT be able to cancel a executed Proposal", async () => {
          await governance.execute(proposalId);
          await expectRevert(governance.cancel(proposalId), "GovernorAlpha::cancel: cannot cancel executed proposal");
        });
      });
    });
  });

  it("should be able to execute with multiple transactions", async () => {
    await proposeMultiProposal();
    const proposalId = await governance.proposalCount();
    await governance.castVote(proposalId, true, { from: voter });
    await advancePastEndTime(proposalId);
    await governance.queue(proposalId);
    await advanceToETA(proposalId);

    // Mint stakingToken to timelock before execution
    await stakingToken.mint(timelock.address, MULTI_TRANSFER_AMOUNT);
    const beforeTimelockBalance = await stakingToken.balanceOf(timelock.address);
    assert(beforeTimelockBalance.eq(MULTI_TRANSFER_AMOUNT));

    // Execute multi-transfer proposal
    const tx = await governance.execute(proposalId);
    await expectEvent(tx, "ProposalExecuted", {
      id: proposalId,
    });

    // Check balance of timelock, A, and B for expected fund movement
    const afterTimelockBalance = await stakingToken.balanceOf(timelock.address);
    assert.equal(afterTimelockBalance.toString(), "0");
    const aBalance = await stakingToken.balanceOf(A);
    assert.equal(aBalance.toString(), (MULTI_TRANSFER_AMOUNT / 2).toString());
    const bBalance = await stakingToken.balanceOf(B);
    assert.equal(bBalance.toString(), (MULTI_TRANSFER_AMOUNT / 2).toString());
  });

  it("executing a proposal with erronous transactions should revert all", async () => {
    await proposeMultiProposal();
    const proposalId = await governance.proposalCount();
    await governance.castVote(proposalId, true, { from: voter });
    await advancePastEndTime(proposalId);
    await governance.queue(proposalId);
    await advanceToETA(proposalId);

    // Mint INSUFFICIENT stakingToken to timelock before execution
    const INSUFFICIENT_AMOUNT = MULTI_TRANSFER_AMOUNT.sub(new BN(100));
    await stakingToken.mint(timelock.address, INSUFFICIENT_AMOUNT);
    const beforeTimelockBalance = await stakingToken.balanceOf(timelock.address);
    assert(beforeTimelockBalance.eq(INSUFFICIENT_AMOUNT));

    // Execute multi-transfer proposal which will revert because of insufficient balance
    await expectRevert(governance.execute(proposalId), "Transaction execution reverted.");

    // Check balance of timelock is unchanged
    const afterTimelockBalance = await stakingToken.balanceOf(timelock.address);
    assert(afterTimelockBalance.eq(beforeTimelockBalance));
  });

  it("guardian can abdicate", async () => {
    await governance.__abdicate({ from: guardian });
    const governanceGuardian = await governance.guardian();
    assert.equal(governanceGuardian, "0x0000000000000000000000000000000000000000");
  });

  it("guardian can accept admin from timelock", async () => {
    const otherTimelock = await Timelock.new(owner, time.duration.days(2));
    await ga.setTimelock(otherTimelock.address);

    const otherGovernance = await GovernorAlpha.new(ga.address, guardian);
    await otherTimelock.harnessSetPendingAdmin(otherGovernance.address); // Begin transfer of ownership of timelock to governance
    const timelockPendingAdmin = await otherTimelock.pendingAdmin();
    assert.equal(timelockPendingAdmin, otherGovernance.address);
    const governanceGuardian = await otherGovernance.guardian();
    assert.equal(governanceGuardian, guardian);

    await otherGovernance.__acceptAdmin({ from: guardian });
    const newTimelockAdmin = await otherTimelock.admin();
    assert.equal(newTimelockAdmin, otherGovernance.address);

    await ga.setTimelock(timelock.address);
  });

  it("guardian can queue setPendingAdmin for timelock", async () => {
    const latestTime = await time.latest();
    const delay = await timelock.delay();
    const eta = latestTime.add(delay).add(BUFFER);
    await governance.__queueSetTimelockPendingAdmin(newAdmin, eta, { from: guardian });
  });

  it("guardian can execute setPendingAdmin for timelock", async () => {
    const latestTime = await time.latest();
    const delay = await timelock.delay();
    const eta = latestTime.add(delay).add(BUFFER);
    await governance.__queueSetTimelockPendingAdmin(newAdmin, eta, { from: guardian });

    await time.increaseTo(eta);
    await governance.__executeSetTimelockPendingAdmin(newAdmin, eta, { from: guardian });
  });

  it("guardian can transfer ownership of timelock to governance", async () => {
    const latestTime = await time.latest();
    const delay = await timelock.delay();
    const eta = latestTime.add(delay).add(BUFFER); // Add buffer to reduce flakiness
    await governance.__queueSetTimelockPendingAdmin(governance.address, eta, { from: guardian });

    await time.increaseTo(eta);
    await governance.__executeSetTimelockPendingAdmin(governance.address, eta, { from: guardian });

    await governance.__acceptAdmin({ from: guardian });
    const newTimelockAdmin = await timelock.admin();
    assert.equal(newTimelockAdmin, governance.address);
  });

  it.skip("Governor should be able to update minVotingPeriod", async () => {
    assert("TODO");
  });
  it.skip("Governor should be able to update maxVotingPeriod", async () => {
    assert("TODO");
  });
  it.skip("should NOT be able to create Proposal with endBlock in the past", async () => {
    assert("TODO");
  });
  it.skip("should NOT be able to create Proposal with endBlock less than 48h remaining", async () => {
    assert("TODO");
  });
});
