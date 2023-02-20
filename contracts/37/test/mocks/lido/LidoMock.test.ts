import { expect } from "chai";
import { Lido } from "../../utils/Lido";
import { Signer } from "../../utils/ContractBase";
import { expectRevert } from "../../utils/Utils";
import { PoolType } from "../../utils/TempusPool";
import { ITestPool } from "../../pool-utils/ITestPool";
import { describeForEachPool } from "../../pool-utils/MultiPoolTestSuite";

describeForEachPool.type("Lido Mock", [PoolType.Lido], (testPool:ITestPool) =>
{
  let owner:Signer, user:Signer;
  let lido:Lido;

  beforeEach(async () =>
  {
    await testPool.createDefault();
    lido = (testPool as any).lido;

    [owner, user] = testPool.signers;
  });

  describe("Deploy", () =>
  {
    it("Should have correct initial values", async () =>
    {
      expect(await lido.totalSupply()).to.equal(0.0); // alias to getTotalPooledEther()
      expect(await lido.getTotalShares()).to.equal(0.0);
      expect(await lido.getPooledEthByShares(1.0)).to.equal(1.0);
      expect(await lido.getSharesByPooledEth(1.0)).to.equal(1.0);
    });
  });

  describe("Submit", () =>
  {
    it("Should store and track balance similar to ERC20 tokens BEFORE buffer deposit", async () =>
    {
      await lido.sendToContract(owner, 4.0); // join Lido
      await lido.submit(user, 2.0); // join Lido

      expect(await lido.totalSupply()).to.equal(6.0); // alias to getTotalPooledEther()
      expect(await lido.getTotalShares()).to.equal(6.0);

      expect(await lido.balanceOf(owner)).to.equal(4.0);
      expect(await lido.balanceOf(user)).to.equal(2.0);

      expect(await lido.sharesOf(owner)).to.equal(4.0);
      expect(await lido.sharesOf(user)).to.equal(2.0);
    });

    it("Should reject ZERO deposit", async () =>
    {
      (await expectRevert(lido.submit(user, 0.0))).to.equal("ZERO_DEPOSIT");
    });

    it("Should deposit in 32eth chunks", async () =>
    {
      await lido.submit(owner, 8.0);
      await lido.depositBufferedEther2(1);
      expect(await lido.totalSupply()).to.equal(8.0);
      expect(await lido.sharesOf(owner)).to.equal(8.0);
      
      await lido.submit(owner, 32.0);
      await lido.depositBufferedEther();
      expect(await lido.totalSupply()).to.equal(40.0);
      expect(await lido.sharesOf(owner)).to.equal(40.0);
    });

    it("Should increase account balances after rewards in fixed proportion", async () =>
    {
      const initial = 50.0;
      await lido.submit(owner, initial*0.2);
      await lido.submit(user, initial*0.8);
      await lido.depositBufferedEther();

      const rewards = 1.0;
      const minted = 0.098231827111984282;
      await lido.pushBeaconRewards(owner, 1, rewards);
      //await lido.printState("after pushBeaconRewards (1 eth)");

      expect(await lido.totalSupply()).to.equal(initial + rewards);
      expect(await lido.getTotalShares()).to.equal('50.098231827111984282');

      const ownerBalance = await lido.balanceOf(owner);
      const userBalance  = await lido.balanceOf(user);
      expect(ownerBalance).to.equal(10.18);
      expect(userBalance).to.equal(40.72);
    });
  });

  describe("Withdraw", async () =>
  {
    it("Should be allowed to withdraw original deposit", async () =>
    {
      await lido.submit(owner, 32.0);
      await lido.depositBufferedEther();
      await lido.submit(user, 33.0);
      await lido.submit(user, 33.0);

      // Three validators and total balance of 34, i.e accrued 2 eth of yield
      await lido.pushBeacon(owner, 1, 34.0);
      expect(await lido.sharesOf(owner)).to.equal(32.0);
      expect(await lido.sharesOf(user)).to.equal(66.0);

      // Withdraw some ether
      await lido.withdraw(owner, 32.0);
      expect(await lido.sharesOf(owner)).to.equal(0.0);
      expect(await lido.sharesOf(user)).to.equal(66.0);

      (await expectRevert(lido.withdraw(owner, 100.0)))
        .to.equal("Can only withdraw up to the buffered ether.");

      (await expectRevert(lido.withdraw(owner, 1.0)))
        .to.equal("BURN_AMOUNT_EXCEEDS_BALANCE");
    });

    it("Should have different redeemable ETH with exchangeRate 1.25", async () =>
    {
      await lido.submit(user, 32.0);
      expect(await lido.sharesOf(user)).to.equal(32.0);
      
      await lido.setInterestRate(1.25);
      expect(await lido.interestRate()).to.equal(1.25);

      const redeemable = await lido.getPooledEthByShares(10);
      expect(redeemable).to.equal(12.5, "redeemable ETH should increase by 1.25x with interestRate 1.25x");
    });

    it("Should revert if underlying pool has a random error", async () =>
    {
      await lido.submit(owner, 32.0);
      await lido.contract.setFailNextDepositOrRedeem(true);
      (await expectRevert(lido.withdraw(owner, 32.0))).to.not.equal('success');
    });
  });
});
