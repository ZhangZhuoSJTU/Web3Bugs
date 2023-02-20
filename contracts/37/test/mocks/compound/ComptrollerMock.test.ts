import { expect } from "chai";
import { Comptroller } from "../../utils/Comptroller";
import { Signer } from "../../utils/ContractBase";
import { expectRevert } from "../../utils/Utils";
import { PoolType } from "../../utils/TempusPool";
import { ITestPool } from "../../pool-utils/ITestPool";
import { describeForEachPool } from "../../pool-utils/MultiPoolTestSuite";

describeForEachPool.type("Compound Mock", [PoolType.Compound], async (testPool:ITestPool) =>
{
  let owner:Signer, user:Signer;
  let pool:Comptroller;

  describe("Compound CErc20", async () =>
  {
    beforeEach(async () =>
    {
      await testPool.create({ initialRate:0.02, poolDuration:60*60, yieldEst:0.1 });
      pool = (testPool as any).compound;

      [owner, user] = testPool.signers;
      await pool.asset.transfer(owner, user, 10); // give user 10 asset coins
    });

    it("Should have 0.02 rate at initial deposit", async () =>
    {
      expect(await pool.exchangeRate()).to.equal(0.02);
      expect(await pool.isParticipant(user)).to.be.false;

      await pool.enterMarkets(user);
      expect(await pool.isParticipant(user)).to.be.true;
      await pool.mint(user, 4);

      expect(await pool.assetBalance(user)).to.equal(6);
      expect(await pool.yieldBalance(user)).to.equal(200);
    });

    it("Should receive 0.5x yield tokens if rate is 0.04", async () =>
    {
      await pool.setExchangeRate(0.04);
      expect(await pool.exchangeRate()).to.equal(0.04);

      // with 0.04 rate, user deposits 4 asset tokens and receives 4/0.04=100 yield tokens
      await pool.enterMarkets(user);
      await pool.mint(user, 4);

      expect(await pool.assetBalance(user)).to.equal(6);
      expect(await pool.yieldBalance(user)).to.equal(100);
    });

    it("Should receive 2.0x yield tokens if rate is 0.01", async () =>
    {
      await pool.setExchangeRate(0.01);
      expect(await pool.exchangeRate()).to.equal(0.01);

      // with 0.01 rate, user deposits 4 asset tokens and receives 4/0.01=400 yield tokens
      await pool.enterMarkets(user);
      await pool.mint(user, 4);

      expect(await pool.assetBalance(user)).to.equal(6);
      expect(await pool.yieldBalance(user)).to.equal(400);
    });

    it("Should receive different amount of yield tokens if rate changes", async () =>
    {
      // with default 0.02 rate, user deposits 4 assets and receives 4/0.02=200 yield tokens
      await pool.enterMarkets(user);
      await pool.mint(user, 4);
      expect(await pool.yieldBalance(user)).to.equal(200);
      
      // with 0.04 rate, user deposits 4 asset tokens and receives 4/0.04=100 yield tokens
      await pool.setExchangeRate(0.04);
      await pool.mint(user, 4);
      expect(await pool.yieldBalance(user)).to.equal(200 + 100);
    });
    
    it("Should be non-participant after exitMarket was called", async () =>
    {
        await pool.enterMarkets(user);
        await pool.enterMarkets(user); // allowed to be called twice
        expect(await pool.isParticipant(user)).to.be.true;
        expect(await pool.mintAllowed(user, 10)).to.be.true;
        await pool.exitMarket(user);
        (await expectRevert(pool.exitMarket(user))).to.not.equal('success'); // calling it twice should revert
        expect(await pool.isParticipant(user)).to.be.false;
        expect(await pool.mintAllowed(user, 10)).to.be.false;
        (await expectRevert(pool.mint(user, 4))).to.equal("mint is not allowed");
    });
  });
});
