import { TestTimelockInstance } from "../../types/truffle-contracts";
import { encodeParameters } from "./utils";

const { BN, expectEvent, expectRevert, time } = require("@openzeppelin/test-helpers");
const Timelock = artifacts.require("TestTimelock");

const DELAY = time.duration.days(2);
const NEW_DELAY = time.duration.days(4);
const BUFFER = time.duration.minutes(5);
const GRACE_PERIOD = time.duration.weeks(4);

contract("Timelock", (accounts) => {
  const [admin, notAdmin, newAdmin] = accounts;

  let timelock: TestTimelockInstance;

  async function buildSetDelayTransaction(newDelay = NEW_DELAY) {
    const target = timelock.address;
    const value = "0";
    const signature = "setDelay(uint256)";
    const data = encodeParameters(["uint256"], [newDelay.toNumber()]);
    const latestTime = await time.latest();
    const eta = latestTime.add(DELAY).add(BUFFER);
    const hash = web3.utils.keccak256(
      encodeParameters(
        ["address", "uint256", "string", "bytes", "uint256"],
        [target, value.toString(), signature, data, eta.toString()],
      ),
    );
    return { target, value, signature, data, eta, hash };
  }

  async function buildSetPendingAdminTransaction() {
    const target = timelock.address;
    const value = "0";
    const signature = "setPendingAdmin(address)";
    const data = encodeParameters(["address"], [newAdmin]);
    const delay = await timelock.delay();
    const latestTime = await time.latest();
    const eta = latestTime.add(delay).add(BUFFER); // BUFFER reduces local chain flakiness
    const hash = web3.utils.keccak256(
      encodeParameters(
        ["address", "uint256", "string", "bytes", "uint256"],
        [target, value.toString(), signature, data, eta.toString()],
      ),
    );
    await timelock.queueTransaction(target, value, signature, data, eta, { from: admin });
    return { target, value, signature, data, eta, hash };
  }

  async function executeTransactionHelper(buildTxFn: () => Promise<any>) {
    const { target, value, signature, data, eta } = await buildTxFn();
    await timelock.queueTransaction(target, value, signature, data, eta, { from: admin });

    const latest = await time.latest();
    await time.increaseTo(latest.add(DELAY).add(BUFFER));

    return timelock.executeTransaction(target, value, signature, data, eta, { from: admin });
  }

  beforeEach(async () => {
    timelock = await Timelock.new(admin, DELAY);
  });

  it("initializes address of admin", async () => {
    const configuredAdmin = await timelock.admin();
    assert.equal(configuredAdmin, admin);
  });

  it("initializes delay", async () => {
    const configuredDelay = await timelock.delay();
    assert(configuredDelay.eq(DELAY));
  });

  it("setDelay() requires msg.sender to be Timelock", async () => {
    await expectRevert(timelock.setDelay(DELAY, { from: admin }), "Call must come from Timelock.");
  });

  it("setPendingAdmin() requires msg.sender to be Timelock", async () => {
    await expectRevert(timelock.setPendingAdmin(newAdmin, { from: admin }), "Call must come from Timelock.");
  });

  it("setPendingAdmin() requires msg.sender to be Timelock", async () => {
    await timelock.harnessSetAdmin(newAdmin);
    await expectRevert(timelock.acceptAdmin({ from: notAdmin }), "Call must come from pendingAdmin.");
  });

  it("setPendingAdmin() sets pendingAdmin to address 0 and changes admin", async () => {
    await timelock.harnessSetPendingAdmin(newAdmin);
    const pendingAdminBefore = await timelock.pendingAdmin();
    assert.equal(pendingAdminBefore, newAdmin);

    const tx = await timelock.acceptAdmin({ from: newAdmin });
    const pendingAdminAfter = await timelock.pendingAdmin();
    assert.equal(pendingAdminAfter, "0x0000000000000000000000000000000000000000");

    const timelockAdmin = await timelock.admin();
    assert.equal(timelockAdmin, newAdmin);

    expectEvent(tx, "NewAdmin", {
      newAdmin,
    });
  });

  it("queueTransaction() requires msg.sender to be admin", async () => {
    const { target, value, signature, data, eta } = await buildSetDelayTransaction();
    await expectRevert(
      timelock.queueTransaction(target, value, signature, data, eta, { from: notAdmin }),
      "Call must come from admin.",
    );
  });

  it("queueTransaction() requires eta to exceed delay", async () => {
    const { target, value, signature, data, eta } = await buildSetDelayTransaction();
    const etaLessThanDelay = eta.sub(BUFFER).sub(new BN(1));
    await expectRevert(
      timelock.queueTransaction(target, value, signature, data, etaLessThanDelay, { from: admin }),
      "Estimated execution block must satisfy delay.",
    );
  });

  it("queueTransaction() sets hash as true in queuedTransactions mapping", async () => {
    const { target, value, signature, data, eta, hash } = await buildSetDelayTransaction();

    const queueTransactionsHashValueBefore = await timelock.queuedTransactions(hash);
    assert.equal(queueTransactionsHashValueBefore, false);

    await timelock.queueTransaction(target, value, signature, data, eta, { from: admin });

    const queueTransactionsHashValueAfter = await timelock.queuedTransactions(hash);
    assert.equal(queueTransactionsHashValueAfter, true);
  });

  it("queueTransaction() emits QueueTransaction event", async () => {
    const { target, value, signature, data, eta, hash } = await buildSetDelayTransaction();

    const tx = await timelock.queueTransaction(target, value, signature, data, eta, { from: admin });
    expectEvent(tx, "QueueTransaction", {
      data,
      signature,
      target,
      eta: eta.toString(),
      txHash: hash,
      value: value.toString(),
    });
  });

  it("cancelTransaction() requires msg.sender to be admin", async () => {
    const { target, value, signature, data, eta } = await buildSetDelayTransaction();
    await expectRevert(
      timelock.cancelTransaction(target, value, signature, data, eta, { from: notAdmin }),
      "Call must come from admin.",
    );
  });

  it("cancelTransaction() sets hash as false in queuedTransactions mapping", async () => {
    const { target, value, signature, data, eta, hash } = await buildSetDelayTransaction();

    await timelock.queueTransaction(target, value, signature, data, eta, { from: admin });
    const queueTransactionsHashValueBefore = await timelock.queuedTransactions(hash);
    assert.equal(queueTransactionsHashValueBefore, true);

    await timelock.cancelTransaction(target, value, signature, data, eta, { from: admin });
    const queueTransactionsHashValueAfter = await timelock.queuedTransactions(hash);
    assert.equal(queueTransactionsHashValueAfter, false);
  });

  it("cancelTransaction() emits CancelTransaction event", async () => {
    const { target, value, signature, data, eta, hash } = await buildSetDelayTransaction();

    const tx = await timelock.cancelTransaction(target, value, signature, data, eta, { from: admin });
    expectEvent(tx, "CancelTransaction", {
      data,
      signature,
      target,
      eta: eta.toString(),
      txHash: hash,
      value: value.toString(),
    });
  });

  it("executeTransaction() requires msg.sender to be admin", async () => {
    const { target, value, signature, data, eta } = await buildSetPendingAdminTransaction();
    await expectRevert(
      timelock.executeTransaction(target, value, signature, data, eta, { from: notAdmin }),
      "Call must come from admin.",
    );
  });

  it("executeTransaction() requires transaction to be queued", async () => {
    const { target, value, signature, data, eta } = await buildSetPendingAdminTransaction();
    const differentEta = eta.sub(new BN(10));
    await expectRevert(
      timelock.executeTransaction(target, value, signature, data, differentEta, { from: admin }),
      "Transaction hasn't been queued.",
    );
  });

  it("executeTransaction() requires timestamp to be greater than or equal to eta", async () => {
    const { target, value, signature, data, eta } = await buildSetPendingAdminTransaction();
    await expectRevert(
      timelock.executeTransaction(target, value, signature, data, eta, { from: admin }),
      "Transaction hasn't surpassed time lock.",
    );
  });

  it("executeTransaction() requires timestamp to be less than eta plus gracePeriod", async () => {
    const { target, value, signature, data, eta } = await buildSetPendingAdminTransaction();
    const latest = await time.latest();
    await time.increaseTo(latest.add(DELAY).add(GRACE_PERIOD).add(new BN(1)));
    await expectRevert(
      timelock.executeTransaction(target, value, signature, data, eta, { from: admin }),
      "Transaction is stale.",
    );
  });

  it("sets hash from true to false in queuedTransactions mapping, updates admin, and emits ExecuteTransaction event", async () => {
    const { target, value, signature, data, eta, hash } = await buildSetPendingAdminTransaction();
    const configuredPendingAdminBefore = await timelock.pendingAdmin();
    assert.equal(configuredPendingAdminBefore, "0x0000000000000000000000000000000000000000");

    const queueTransactionsHashValueBefore = await timelock.queuedTransactions(hash);
    assert.equal(queueTransactionsHashValueBefore, true);

    const latest = await time.latest();
    await time.increaseTo(latest.add(DELAY).add(BUFFER));

    const tx = await timelock.executeTransaction(target, value, signature, data, eta, {
      from: admin,
    });

    const queueTransactionsHashValueAfter = await timelock.queuedTransactions(hash);
    assert.equal(queueTransactionsHashValueAfter, false);

    const configuredPendingAdminAfter = await timelock.pendingAdmin();
    assert.equal(configuredPendingAdminAfter, newAdmin);

    expectEvent(tx, "ExecuteTransaction", {
      data,
      signature,
      target,
      eta: eta.toString(),
      txHash: hash,
      value: value.toString(),
    });
    expectEvent(tx, "NewPendingAdmin", {
      newPendingAdmin: newAdmin,
    });
  });

  it("setDelay() requires new delay exceeds minimum delay", async () => {
    await expectRevert(
      executeTransactionHelper(async () => buildSetDelayTransaction(time.duration.days(1))),
      "Transaction execution reverted",
    );
  });

  it("setDelay() requires new delay not exceeds maximum delay", async () => {
    await expectRevert(
      executeTransactionHelper(async () => buildSetDelayTransaction(time.duration.days(31))),
      "Transaction execution reverted",
    );
  });

  it("setDelay() should successfully execute", async () => {
    await executeTransactionHelper(buildSetDelayTransaction);
  });
});
