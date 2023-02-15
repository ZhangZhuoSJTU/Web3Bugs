const { expect } = require('chai');
const { ethers } = require('hardhat');

const {
  WITHDRAW_FUNCTION,
  WITHDRAW_INTERFACE,
  SUBMISSION_EVENT,
  SUBMISSION_EVENT_NAME,
} = require("./Constants");
const {
  getParamFromEvent,
  deployContract,
} = require("./utils");

const ABI = [WITHDRAW_FUNCTION, SUBMISSION_EVENT];

describe("CoreMultiSig", () => {
  let alice, bob, jack, maria;
  let aliceAddr, bobAddr, jackAddr, mariaAddr;
  let coreMultiSig, token;
  let iface;
  let withdrawEncoded;
  const withdrawAmount = 500;

  before(async () => {
    [alice, bob, jack, maria] = await ethers.getSigners();
    [aliceAddr, bobAddr, jackAddr, mariaAddr] = await Promise.all(
      [alice, bob, jack, maria].map((x) => x.getAddress()),
    );

    // deploying contracts
    token = await deployContract("MockERC20");
    coreMultiSig = await deployContract("CoreMultiSig", [[aliceAddr, bobAddr, jackAddr], 2]);

    await token.transfer(coreMultiSig.address, 4000);

    // creating CoreMultiSig interface
    iface = new ethers.utils.Interface(ABI);

    withdrawEncoded = iface.encodeFunctionData(WITHDRAW_INTERFACE, [
      token.address,
      bobAddr,
      withdrawAmount,
    ]);
  });

  it('withdraw 500 tokens to Bob by confirming from Alice and Jack', async () => {
    // submit transaction from alice
    const submitTx = await coreMultiSig.submitTransaction(
      coreMultiSig.address,
      0,
      withdrawEncoded,
    );
    const transaction = await submitTx.wait();

    // get transactionId from Submission event
    const transactionId = getParamFromEvent(
      transaction,
      iface,
      SUBMISSION_EVENT_NAME,
      0,
    );

    // confirm transaction from jack
    const confirmTx = await coreMultiSig
      .connect(jack)
      .confirmTransaction(transactionId);
    await confirmTx.wait();

    let balance = await token.balanceOf(bobAddr);
    expect(balance).to.eq(withdrawAmount);
  });

  it("can't access withdraw directly", async () => {
    const args = [token.address, bobAddr, withdrawAmount];

    expect(coreMultiSig.withdraw(...args)).to.be.reverted;
    expect(coreMultiSig.connect(bob).withdraw(...args)).to.be.reverted;
    expect(coreMultiSig.connect(jack).withdraw(...args)).to.be.reverted;
  });

  it('only owner can confirm transaction', async () => {
    // submit transaction from alice
    const submitTx = await coreMultiSig.submitTransaction(
      coreMultiSig.address,
      0,
      withdrawEncoded,
    );
    const transaction = await submitTx.wait();

    // get transactionId from Submission event
    const transactionId = getParamFromEvent(
      transaction,
      iface,
      SUBMISSION_EVENT_NAME,
      0,
    );

    expect(coreMultiSig.connect(bob).confirmTransaction(transactionId)).to.be
      .reverted;
  });
});
