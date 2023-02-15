import { expect } from "chai";
import { ITestPool } from "./pool-utils/ITestPool";
import { describeForEachPool } from "./pool-utils/MultiPoolTestSuite";

describeForEachPool("TempusPool YieldShare", (pool:ITestPool) =>
{
  it("Should have correct rates for Yields and Principals before Maturity", async () =>
  {
    await pool.createDefault();
    // we move 10% of time forward, and add up 10% of expected yield
    const interestRate:number = 1.01;
    await pool.setInterestRate(interestRate);
    await pool.setNextBlockTimestampRelativeToPoolStart(0.1);
    let principalPrice:number = +await pool.tempus.principalShare.getPricePerFullShareStored();
    let yieldsPrice:number = +await pool.tempus.yieldShare.getPricePerFullShareStored();
    expect(principalPrice).to.be.within(0.9099, 0.911);
    expect(yieldsPrice).to.be.within(0.0998, 0.1001);
    expect(principalPrice + yieldsPrice).to.be.within(interestRate-0.001, interestRate+0.001);
  });

  it("Should have correct rates for Yields and Principals in the middle of the pool", async () => {
    await pool.createDefault();
    await pool.setTimeRelativeToPoolStart(0.5);
    const midRate = 1 + pool.yieldEst / 2;
    await pool.setInterestRate(midRate);

    let principalPrice:number = +await pool.tempus.principalShare.getPricePerFullShareStored();
    let yieldsPrice:number = +await pool.tempus.yieldShare.getPricePerFullShareStored();
    expect(principalPrice).to.be.within(0.0954, 0.955);
    expect(yieldsPrice).to.be.within(0.00954, 0.0955);
    expect(principalPrice + yieldsPrice).to.within(midRate-0.001, midRate+0.001);
  });

  it("Should have correct rates for Yields and Principals after Maturity", async () =>
  {
    await pool.createDefault();
    await pool.setInterestRate(1.5); // set the final interest rate
    await pool.fastForwardToMaturity();

    let principalPrice:number = +await pool.tempus.principalShare.getPricePerFullShareStored();
    let yieldsPrice:number = +await pool.tempus.yieldShare.getPricePerFullShareStored();
    expect(principalPrice).to.be.within(1.0, 1.0);
    expect(yieldsPrice).to.be.within(0.5, 0.5);
    expect(principalPrice + yieldsPrice).to.be.equal(1.5);
  });

  it("Should have correct rates on negative yield - still estimates positive yield at maturity", async () => 
  {
    await pool.createDefault();
    // set current interest rate to be under 1.0 (it implies negative yield)
    await pool.setInterestRate(0.95);
    await pool.setNextBlockTimestampRelativeToPoolStart(0.1);

    let principalPrice:number = +await pool.tempus.principalShare.getPricePerFullShareStored();
    let yieldsPrice:number = +await pool.tempus.yieldShare.getPricePerFullShareStored();
    expect(principalPrice).to.be.within(0.9047, 0.9052);
    expect(yieldsPrice).to.be.within(0.0448, 0.0453);
    expect(principalPrice + yieldsPrice).to.be.within(0.94000009, 0.95000001);
  });

  it("Should have correct rates on negative yield - if estimated is negative as well", async () => 
  {
    await pool.createDefault();
    // set current interest rate to be low enough to make yield estimate under 1.0
    await pool.setInterestRate(0.8);

    let principalPrice:number = +await pool.tempus.principalShare.getPricePerFullShareStored();
    let yieldsPrice:number = +await pool.tempus.yieldShare.getPricePerFullShareStored();
    expect(principalPrice).to.be.equal(0.8);
    expect(yieldsPrice).to.be.equal(0);
    expect(principalPrice + yieldsPrice).to.be.equal(principalPrice);
  });

  it("Should have correct rates on negative yield - at maturity", async () => 
  {
    await pool.createDefault();
    await pool.setInterestRate(0.9);
    await pool.fastForwardToMaturity();

    let principalPrice:number = +await pool.tempus.principalShare.getPricePerFullShareStored();
    let yieldsPrice:number = +await pool.tempus.yieldShare.getPricePerFullShareStored();
    expect(principalPrice).to.be.equal(0.9);
    expect(yieldsPrice).to.be.equal(0);
    expect(principalPrice + yieldsPrice).to.be.equal(principalPrice);
  });
});
