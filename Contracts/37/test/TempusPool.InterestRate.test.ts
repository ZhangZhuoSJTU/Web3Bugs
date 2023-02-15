
import { ethers } from "hardhat";
import { expect } from "chai";
import { Signer } from "./utils/ContractBase";
import { ITestPool } from "./pool-utils/ITestPool";
import { describeForEachPool } from "./pool-utils/MultiPoolTestSuite";

describeForEachPool("TempusPool InterestRate", (pool:ITestPool) =>
{
  it("Should give correct Interest Rate and token amounts with Rate=1.0", async () =>
  {
    await pool.createDefault();
    let interestRate = await pool.tempus.currentInterestRate();
    let numAssetTokens = await pool.tempus.numAssetsPerYieldToken(2, interestRate);
    let numYieldTokens = await pool.tempus.numYieldTokensPerAsset(3, interestRate);
    expect(interestRate).to.equal(1.0);
    expect(numAssetTokens).to.equal(2);
    expect(numYieldTokens).to.equal(3);
  });

  it("Should give correct Interest Rate and token amounts with Rate=2.0", async () =>
  {
    await pool.create({ initialRate:2.0, poolDuration:60*60, yieldEst:0.1 });
    let interestRate = await pool.tempus.currentInterestRate();
    let numAssetTokens = await pool.tempus.numAssetsPerYieldToken(2, interestRate);
    let numYieldTokens = await pool.tempus.numYieldTokensPerAsset(2, interestRate);
    expect(interestRate).to.equal(2.0);

    if (pool.yieldPeggedToAsset)
    {
      expect(numAssetTokens).to.equal(2);
      expect(numYieldTokens).to.equal(2);
      expect(numAssetTokens).to.equal(numYieldTokens, "yield must be pegged to asset");
    }
    else
    {
      expect(numAssetTokens).to.equal(4);
      expect(numYieldTokens).to.equal(1);
    }
  });
});
