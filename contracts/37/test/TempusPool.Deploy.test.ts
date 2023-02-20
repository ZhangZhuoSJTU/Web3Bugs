import { utils } from "ethers";
import { expect } from "chai";
import { ITestPool } from "./pool-utils/ITestPool";
import { describeForEachPool } from "./pool-utils/MultiPoolTestSuite";
import { TempusPool } from "./utils/TempusPool";
import { expectRevert, blockTimestamp } from "./utils/Utils";

describeForEachPool("TempusPool Deploy", (testPool:ITestPool) =>
{
  let pool:TempusPool;

  beforeEach(async () =>
  {
    pool = await testPool.createDefault();
  });

  it("Version is correct", async () =>
  {
    expect(await pool.version()).to.equal(1);
  });

  it("Underlying protocol name is correct", async () => 
  {
    const protocol:string = utils.parseBytes32String(await pool.protocolName());
    expect(protocol).to.equal(testPool.type);
  });

  it("Start and maturity time", async () =>
  {
    expect(await pool.startTime()).to.lte(await blockTimestamp());
    expect(await pool.maturityTime()).to.equal(testPool.maturityTime);
  });

  it("Maturity should not be set", async () =>
  {
    expect(await pool.matured()).to.equal(false);
  });

  it("Interest Rates should be set", async () =>
  {
    expect(await pool.initialInterestRate()).to.equal(1.0);
    expect(await pool.currentInterestRate()).to.equal(1.0);
    expect(await pool.maturityInterestRate()).to.equal(0.0);
  });

  it("Finalize prior to maturity", async () =>
  {
    (await expectRevert(testPool.finalize())).to.equal("Maturity not been reached yet.");
  });

  it("Finalize on/after maturity", async () =>
  {
    await testPool.fastForwardToMaturity();
    expect(await pool.matured()).to.equal(true);
  });

  it("Finalizing multiple times", async () =>
  {
    (await expectRevert(testPool.finalize())).to.equal("Maturity not been reached yet.");
    await testPool.fastForwardToMaturity();
    expect(await pool.matured()).to.equal(true);
    await testPool.finalize();
    await testPool.finalize();
    await testPool.finalize();
    expect(await pool.matured()).to.equal(true);
  });

  it("Principal shares initial details", async () =>
  {
    expect(await pool.principalShare.totalSupply()).to.equal(0);
    expect(await pool.principalShare.name()).to.equal(testPool.names.principalName);
    expect(await pool.principalShare.symbol()).to.equal(testPool.names.principalSymbol);
  });

  it("Yield shares initial details", async () =>
  {
    expect(await pool.yieldShare.totalSupply()).to.equal(0);
    expect(await pool.yieldShare.name()).to.equal(testPool.names.yieldName);
    expect(await pool.yieldShare.symbol()).to.equal(testPool.names.yieldSymbol);
  });

  it("Should not revert on collecting fees as there is no fees", async () =>
  {
    let [owner] = testPool.signers;
    await pool.controller.transferFees(testPool, owner, owner);
    expect(await pool.yieldBearing.balanceOf(owner)).to.equal(0);
    expect(await pool.totalFees()).to.equal(0);
  });

  it("Should revert if maturity is less than current time", async () =>
  {
    (await expectRevert(testPool.create({ initialRate:1.0, poolDuration:-60, yieldEst:0.1 })))
      .to.equal("maturityTime is after startTime");
  });
});
