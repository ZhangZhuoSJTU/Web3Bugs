import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { time } from "@openzeppelin/test-helpers";
import { Contract } from "ethers";

import type {
  Vault,
  TestERC20,
  MockStrategy,
  Depositors,
  Claimers,
  USTStrategy,
} from "../typechain";
import { Claimers__factory, Depositors__factory } from "../typechain";

import { ethers } from "hardhat";
import { expect } from "chai";

import { depositParams, claimParams } from "./shared/factories";
import {
  getLastBlockTimestamp,
  moveForwardTwoWeeks,
  SHARES_MULTIPLIER,
  generateNewAddress,
} from "./shared";

const { utils, BigNumber } = ethers;
const { parseUnits } = ethers.utils;

describe("Vault", () => {
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let carol: SignerWithAddress;

  let mockEthAnchorRouter: Contract;
  let mockExchangeRateFeeder: Contract;

  let underlying: TestERC20;
  let aUstToken: Contract;
  let vault: Vault;
  let depositors: Depositors;
  let claimers: Claimers;
  let strategy: USTStrategy;
  const treasury = generateNewAddress();

  beforeEach(async () => {
    [owner, alice, bob, carol] = await ethers.getSigners();

    let TestERC20 = await ethers.getContractFactory("TestERC20");
    let Vault = await ethers.getContractFactory("Vault");
    let MockStrategy = await ethers.getContractFactory("MockStrategy");

    underlying = (await TestERC20.deploy(0)) as TestERC20;
    aUstToken = await TestERC20.deploy(utils.parseEther("1000000000"));

    const MockEthAnchorRouterFactory = await ethers.getContractFactory(
      "MockEthAnchorRouter"
    );
    mockEthAnchorRouter = await MockEthAnchorRouterFactory.deploy(
      underlying.address,
      aUstToken.address
    );

    const MockExchangeRateFeederFactory = await ethers.getContractFactory(
      "MockExchangeRateFeeder"
    );
    mockExchangeRateFeeder = await MockExchangeRateFeederFactory.deploy();

    vault = (await Vault.deploy(
      underlying.address,
      1209600,
      0,
      owner.address
    )) as Vault;
    strategy = (await MockStrategy.deploy(
      vault.address,
      treasury,
      mockEthAnchorRouter.address,
      mockExchangeRateFeeder.address,
      underlying.address,
      aUstToken.address,
      BigNumber.from("200")
    )) as USTStrategy;

    depositors = Depositors__factory.connect(await vault.depositors(), owner);
    claimers = Claimers__factory.connect(await vault.claimers(), owner);
  });

  describe("setInvestPerc", () => {
    it("changes the investment percentage", async () => {
      expect(await vault.investPerc()).to.equal(0);

      await vault.connect(owner).setInvestPerc(1);

      expect(await vault.investPerc()).to.equal(1);
    });
  });

  describe("updateInvested", () => {
    it("moves the funds to the strategy", async () => {
      await vault.connect(owner).setStrategy(strategy.address);
      await vault.connect(owner).setInvestPerc("8000");
      await addYieldToVault("100");

      await vault.connect(owner).updateInvested();

      expect(await underlying.balanceOf(strategy.address)).to.eq(
        parseUnits("80")
      );
    });
  });

  describe("investableAmount", () => {
    it("returns the amount available to invest", async () => {
      await vault.connect(owner).setStrategy(strategy.address);
      await vault.connect(owner).setInvestPerc("9000");
      await addYieldToVault("100");

      expect(await vault.investableAmount()).to.equal(parseUnits("90"));
    });

    it("takes into account the invested amount", async () => {
      await vault.connect(owner).setStrategy(strategy.address);
      await vault.connect(owner).setInvestPerc("9000");
      await addYieldToVault("100");
      await underlying.mint(strategy.address, parseUnits("100"));

      expect(await vault.investableAmount()).to.equal(parseUnits("80"));
    });
  });

  describe("setStrategy", () => {
    it("changes the strategy", async () => {
      expect(await vault.strategy()).to.equal(
        "0x0000000000000000000000000000000000000000"
      );

      await vault.connect(owner).setStrategy(strategy.address);

      expect(await vault.strategy()).to.equal(strategy.address);
    });
  });

  describe("sponsor", () => {
    it("adds a sponsor to the vault", async () => {
      await addUnderlyingBalance(alice, "1000");

      await vault.connect(alice).sponsor(parseUnits("500"), 0);
      await vault.connect(alice).sponsor(parseUnits("500"), 0);

      expect(await vault.totalSponsored()).to.eq(parseUnits("1000"));
    });

    it("emits an event", async () => {
      await addUnderlyingBalance(alice, "1000");
      const lockedUntil = (await getLastBlockTimestamp()).add(
        time.duration.days(15).toNumber()
      );

      const tx = vault.connect(alice).sponsor(parseUnits("500"), lockedUntil);

      await expect(tx)
        .to.emit(vault, "Sponsored")
        .withArgs(0, parseUnits("500"), alice.address, lockedUntil);
    });

    it("fails if the lock duration is less than the minimum", async () => {
      await addUnderlyingBalance(alice, "1000");
      const lockedUntil = (await getLastBlockTimestamp()).add(
        time.duration.days(13).toNumber()
      );

      await expect(
        vault.connect(alice).sponsor(parseUnits("500"), lockedUntil)
      ).to.be.revertedWith("Vault: lock time is too small");
    });
  });

  ["unsponsor", "forceUnsponsor"].map((action) => {
    describe(action, () => {
      it("removes a sponsor from the vault", async () => {
        await addUnderlyingBalance(alice, "1000");
        await vault.connect(alice).sponsor(parseUnits("500"), 0);
        await vault.connect(alice).sponsor(parseUnits("500"), 0);

        await moveForwardTwoWeeks();
        await vault.connect(alice)[action](bob.address, [0]);

        expect(await vault.totalSponsored()).to.eq(parseUnits("500"));
        expect(await underlying.balanceOf(bob.address)).to.eq(
          parseUnits("500")
        );
      });

      it("emits an event", async () => {
        await addUnderlyingBalance(alice, "1000");
        await vault.connect(alice).sponsor(parseUnits("500"), 0);

        await moveForwardTwoWeeks();
        const tx = await vault.connect(alice)[action](bob.address, [0]);

        await expect(tx).to.emit(vault, "Unsponsored").withArgs(0);
      });

      it("fails if the caller is not the owner", async () => {
        await addUnderlyingBalance(alice, "1000");
        await vault.connect(alice).sponsor(parseUnits("500"), 0);

        await expect(
          vault.connect(bob)[action](alice.address, [0])
        ).to.be.revertedWith("Vault: you are not the owner of a sponsor");
      });

      it("fails if the amount is still locked", async () => {
        await addUnderlyingBalance(alice, "1000");
        await vault.connect(alice).sponsor(parseUnits("500"), 0);

        await expect(
          vault.connect(alice)[action](alice.address, [0])
        ).to.be.revertedWith("Vault: amount is locked");
      });

      it("fails if token id belongs to a withdraw", async () => {
        await addUnderlyingBalance(alice, "1000");

        await vault.connect(alice).deposit(
          depositParams.build({
            amount: parseUnits("500"),
            claims: [claimParams.percent(100).to(alice.address).build()],
          })
        );
        await vault.connect(alice).sponsor(parseUnits("500"), 0);

        await moveForwardTwoWeeks();

        await expect(
          vault.connect(alice)[action](alice.address, [0, 1])
        ).to.be.revertedWith("Vault: token id is not a sponsor");
      });
    });
  });

  describe("unsponsor", () => {
    it("fails if there are not enough funds", async () => {
      await addUnderlyingBalance(alice, "1000");
      await vault.connect(alice).sponsor(parseUnits("1000"), 0);
      await moveForwardTwoWeeks();

      await removeUnderlyingFromVault("500");

      await expect(
        vault.connect(alice).unsponsor(alice.address, [0])
      ).to.be.revertedWith("Vault: not enough funds to unsponsor");
    });
  });

  describe("forceUnsponsor", () => {
    it("works if there are not enough funds", async () => {
      await addUnderlyingBalance(alice, "1000");
      await vault.connect(alice).sponsor(parseUnits("1000"), 0);
      await moveForwardTwoWeeks();
      await removeUnderlyingFromVault("500");

      await vault.connect(alice).forceUnsponsor(alice.address, [0]);

      expect(await underlying.balanceOf(alice.address)).to.eq(
        parseUnits("500")
      );
      expect(await vault.totalSponsored()).to.eq(parseUnits("0"));
    });
  });

  describe("deposit", () => {
    it("emits events", async () => {
      await addUnderlyingBalance(alice, "1000");
      const lockedUntil = (await getLastBlockTimestamp()).add(
        time.duration.days(15).toNumber()
      );

      const params = depositParams.build({
        lockedUntil,
        amount: parseUnits("100"),
        claims: [
          claimParams.percent(50).to(carol.address).build(),
          claimParams.percent(50).to(bob.address).build(),
        ],
      });

      const tx = await vault.connect(alice).deposit(params);

      await expect(tx)
        .to.emit(vault, "DepositMinted")
        .withArgs(
          0,
          0,
          parseUnits("50"),
          parseUnits("50").mul(SHARES_MULTIPLIER),
          alice.address,
          carol.address,
          1,
          lockedUntil
        );

      await expect(tx)
        .to.emit(vault, "DepositMinted")
        .withArgs(
          1,
          0,
          parseUnits("50"),
          parseUnits("50").mul(SHARES_MULTIPLIER),
          alice.address,
          bob.address,
          2,
          lockedUntil
        );
    });

    it("emits events with a different groupId per deposit", async () => {
      await addUnderlyingBalance(alice, "1000");
      const lockedUntil = (await getLastBlockTimestamp()).add(
        time.duration.days(15).toNumber()
      );

      const params = depositParams.build({
        lockedUntil,
        amount: parseUnits("100"),
        claims: [
          claimParams.percent(50).to(carol.address).build(),
          claimParams.percent(50).to(bob.address).build(),
        ],
      });

      await vault.connect(alice).deposit(params);
      const tx = await vault.connect(alice).deposit(params);

      await expect(tx)
        .to.emit(vault, "DepositMinted")
        .withArgs(
          2,
          1,
          parseUnits("50"),
          parseUnits("50").mul(SHARES_MULTIPLIER),
          alice.address,
          carol.address,
          1,
          lockedUntil
        );

      await expect(tx)
        .to.emit(vault, "DepositMinted")
        .withArgs(
          3,
          1,
          parseUnits("50"),
          parseUnits("50").mul(SHARES_MULTIPLIER),
          alice.address,
          bob.address,
          2,
          lockedUntil
        );
    });

    it("sets a timelock of at least 2 weeks by default", async () => {
      await addUnderlyingBalance(alice, "1000");

      const params = depositParams.build({
        amount: parseUnits("100"),
        claims: [
          claimParams.percent(50).to(carol.address).build(),
          claimParams.percent(50).to(bob.address).build(),
        ],
      });

      await vault.connect(alice).deposit(params);

      const deposit = await depositors.deposits(0);

      expect(deposit.lockedUntil.toNumber()).to.be.at.least(
        (await getLastBlockTimestamp()).add(time.duration.weeks(2).toNumber())
      );
    });

    it("fails if the timelock is less than 2 weeks", async () => {
      await addUnderlyingBalance(alice, "1000");

      const params = depositParams.build({
        amount: parseUnits("100"),
        lockedUntil: (await getLastBlockTimestamp()).add(
          time.duration.days(13).toNumber()
        ),
        claims: [claimParams.percent(100).to(bob.address).build()],
      });

      const action = vault.connect(alice).deposit(params);

      await expect(action).to.be.revertedWith("Vault: lock time is too small");
    });
  });

  ["withdraw", "forceWithdraw"].map((vaultAction) => {
    describe(vaultAction, () => {
      it("emits events", async () => {
        await addUnderlyingBalance(alice, "1000");

        const params = depositParams.build({
          amount: parseUnits("100"),
          claims: [
            claimParams.percent(50).to(carol.address).build(),
            claimParams.percent(50).to(bob.address).build(),
          ],
        });

        await vault.connect(alice).deposit(params);

        await moveForwardTwoWeeks();
        const tx = await vault
          .connect(alice)
          [vaultAction](alice.address, [0, 1]);

        await expect(tx)
          .to.emit(vault, "DepositBurned")
          .withArgs(0, parseUnits("50").mul(SHARES_MULTIPLIER), alice.address);
        await expect(tx)
          .to.emit(vault, "DepositBurned")
          .withArgs(1, parseUnits("50").mul(SHARES_MULTIPLIER), alice.address);
      });

      it("withdraws the principal of a deposit", async () => {
        await addUnderlyingBalance(alice, "1000");

        const params = depositParams.build({
          amount: parseUnits("100"),
          claims: [
            claimParams.percent(50).to(carol.address).build(),
            claimParams.percent(50).to(bob.address).build(),
          ],
        });

        await vault.connect(alice).deposit(params);

        expect(await underlying.balanceOf(alice.address)).to.eq(
          parseUnits("900")
        );

        await moveForwardTwoWeeks();
        await vault.connect(alice)[vaultAction](alice.address, [0, 1]);

        expect(await underlying.balanceOf(alice.address)).to.eq(
          parseUnits("1000")
        );
      });

      it("withdraws funds to a different address", async () => {
        await addUnderlyingBalance(alice, "1000");

        const params = depositParams.build({
          amount: parseUnits("100"),
          claims: [claimParams.percent(100).to(bob.address).build()],
        });

        await vault.connect(alice).deposit(params);
        await moveForwardTwoWeeks();
        await vault.connect(alice)[vaultAction](carol.address, [0]);

        expect(await underlying.balanceOf(carol.address)).to.eq(
          parseUnits("100")
        );
      });

      it("burns the NFTs of the deposits", async () => {
        await addUnderlyingBalance(alice, "1000");

        const params = depositParams.build({
          amount: parseUnits("100"),
          claims: [
            claimParams.percent(50).to(carol.address).build(),
            claimParams.percent(50).to(bob.address).build(),
          ],
        });

        await vault.connect(alice).deposit(params);
        await moveForwardTwoWeeks();
        await vault.connect(alice)[vaultAction](alice.address, [1, 0]);

        expect(await depositors.exists(1)).to.false;
        expect(await depositors.exists(2)).to.false;
      });

      it("removes the shares from the claimers", async () => {
        await addUnderlyingBalance(alice, "1000");

        const params = depositParams.build({
          amount: parseUnits("100"),
          claims: [
            claimParams.percent(50).to(carol.address).build(),
            claimParams.percent(50).to(bob.address).build(),
          ],
        });

        await vault.connect(alice).deposit(params);

        expect(await claimers.sharesOf(1)).to.eq(
          parseUnits("50").mul(SHARES_MULTIPLIER)
        );
        expect(await claimers.sharesOf(2)).to.eq(
          parseUnits("50").mul(SHARES_MULTIPLIER)
        );

        await moveForwardTwoWeeks();
        await vault.connect(alice)[vaultAction](alice.address, [0]);

        expect(await claimers.sharesOf(1)).to.eq(0);
        expect(await claimers.sharesOf(2)).to.eq(
          parseUnits("50").mul(SHARES_MULTIPLIER)
        );
      });

      it("fails if the caller doesn't own the deposit", async () => {
        await addUnderlyingBalance(alice, "1000");
        await addUnderlyingBalance(bob, "1000");

        const params = depositParams.build({
          amount: parseUnits("100"),
          claims: [claimParams.percent(100).to(carol.address).build()],
        });

        await vault.connect(alice).deposit(params);
        await vault.connect(bob).deposit(params);

        await moveForwardTwoWeeks();
        const action = vault.connect(bob)[vaultAction](bob.address, [0, 1]);

        await expect(action).to.be.revertedWith(
          "Vault: you are not the owner of a deposit"
        );
      });

      it("fails if the deposit is locked", async () => {
        await addUnderlyingBalance(alice, "1000");

        const params = depositParams.build({
          amount: parseUnits("100"),
          claims: [claimParams.percent(100).to(bob.address).build()],
        });

        await vault.connect(alice).deposit(params);

        const action = vault.connect(alice)[vaultAction](alice.address, [0]);

        await expect(action).to.be.revertedWith("Vault: deposit is locked");
      });

      it("fails if token id belongs to a sponsor", async () => {
        await addUnderlyingBalance(alice, "1000");

        await vault.connect(alice).deposit(
          depositParams.build({
            amount: parseUnits("500"),
            claims: [claimParams.percent(100).to(alice.address).build()],
          })
        );
        await vault.connect(alice).sponsor(parseUnits("500"), 0);

        await moveForwardTwoWeeks();

        await expect(
          vault.connect(alice)[vaultAction](alice.address, [0, 1])
        ).to.be.revertedWith("Vault: token id is not a withdraw");
      });
    });
  });

  describe("forceWithdraw", () => {
    it("works if the vault doesn't have enough funds", async () => {
      await addUnderlyingBalance(alice, "1000");

      const params = depositParams.build({
        amount: parseUnits("1000"),
        claims: [claimParams.percent(100).to(carol.address).build()],
      });

      await vault.connect(alice).deposit(params);
      await moveForwardTwoWeeks();
      await removeUnderlyingFromVault("500");

      await vault.connect(alice).forceWithdraw(alice.address, [0]);

      expect(await underlying.balanceOf(alice.address)).to.eq(
        parseUnits("500")
      );
    });
  });

  describe("withdraw", () => {
    it("fails if the vault doesn't have enough funds", async () => {
      await addUnderlyingBalance(alice, "1000");

      const params = depositParams.build({
        amount: parseUnits("100"),
        claims: [claimParams.percent(100).to(carol.address).build()],
      });

      await vault.connect(alice).deposit(params);

      await moveForwardTwoWeeks();
      await removeUnderlyingFromVault("50");

      const action = vault.connect(alice).withdraw(alice.address, [0]);

      await expect(action).to.be.revertedWith(
        "Vault: cannot withdraw more than the available amount"
      );
    });
  });

  describe("claimYield", () => {
    it("emits an event", async () => {
      await addUnderlyingBalance(alice, "1000");

      const params = depositParams.build({
        amount: parseUnits("100"),
        claims: [
          claimParams.percent(50).to(carol.address).build(),
          claimParams.percent(50).to(bob.address).build(),
        ],
      });

      await vault.connect(alice).deposit(params);
      await addYieldToVault("100");
      const tx = await vault.connect(carol).claimYield(carol.address);

      await expect(tx)
        .to.emit(claimers, "YieldClaimed")
        .withArgs(
          1,
          carol.address,
          parseUnits("50"),
          parseUnits("25").mul(SHARES_MULTIPLIER)
        );
    });

    it("claims the yield of a user", async () => {
      await addUnderlyingBalance(alice, "1000");

      const params = depositParams.build({
        amount: parseUnits("100"),
        claims: [
          claimParams.percent(50).to(carol.address).build(),
          claimParams.percent(50).to(bob.address).build(),
        ],
      });

      await vault.connect(alice).deposit(params);
      await addYieldToVault("100");
      await vault.connect(carol).claimYield(carol.address);

      expect(await vault.yieldFor(carol.address)).to.eq(parseUnits("0"));
      expect(await underlying.balanceOf(carol.address)).to.eq(parseUnits("50"));
      expect(await vault.yieldFor(bob.address)).to.eq(parseUnits("50"));
    });

    it("claims the yield to a different address", async () => {
      await addUnderlyingBalance(alice, "1000");

      const params = depositParams.build({
        amount: parseUnits("100"),
        claims: [claimParams.percent(100).to(bob.address).build()],
      });

      await vault.connect(alice).deposit(params);
      await addYieldToVault("100");
      await vault.connect(bob).claimYield(carol.address);

      expect(await underlying.balanceOf(carol.address)).to.eq(
        parseUnits("100")
      );
    });
  });

  describe("yieldFor", () => {
    it("returns the amount of yield claimable by a user", async () => {
      await addUnderlyingBalance(alice, "1000");

      const params = depositParams.build({
        amount: parseUnits("100"),
        claims: [
          claimParams.percent(50).to(alice.address).build(),
          claimParams.percent(50).to(bob.address).build(),
        ],
      });

      await vault.connect(alice).deposit(params);
      await addYieldToVault("100");

      expect(await vault.yieldFor(alice.address)).to.eq(parseUnits("50"));
      expect(await vault.yieldFor(bob.address)).to.eq(parseUnits("50"));
    });
  });

  describe("deposit", () => {
    it("works with valid parameters", async () => {
      await addUnderlyingBalance(alice, "1000");

      const params = depositParams.build();

      await vault.connect(alice).deposit(params);
    });

    it("works with multiple claims", async () => {
      await addUnderlyingBalance(alice, "1000");

      const params = depositParams.build({
        claims: [
          claimParams.percent(50).build(),
          claimParams.percent(50).build(),
        ],
      });

      await vault.connect(alice).deposit(params);
    });

    it("calculates correct number of shares for first deposit", async () => {
      await addUnderlyingBalance(alice, "1000");

      const amount = parseUnits("1");
      const params = depositParams.build({ amount });

      await vault.connect(alice).deposit(params);

      expect(await vault.totalShares()).to.equal(amount.mul(SHARES_MULTIPLIER));
    });

    it("calculates correct number of shares for second deposit of equal size", async () => {
      await addUnderlyingBalance(alice, "1000");
      await addUnderlyingBalance(bob, "1000");

      const amount = parseUnits("1");
      const params = depositParams.build({ amount });

      // deposit 1 unit
      await vault.connect(alice).deposit(params);

      // deposit 1 unit
      await vault.connect(bob).deposit(params);

      // total shares must be 2 units
      expect(await vault.totalShares()).to.equal(
        amount.mul(2).mul(SHARES_MULTIPLIER)
      );
    });

    it("calculates correct number of shares for second deposit of different size", async () => {
      await addUnderlyingBalance(alice, "1000");
      await addUnderlyingBalance(bob, "1000");
      const amount = parseUnits("1");

      // deposit 1 unit
      const params1 = depositParams.build({ amount });
      await vault.connect(alice).deposit(params1);

      // deposit 2 unit
      const params2 = depositParams.build({ amount: amount.mul(2) });
      await vault.connect(bob).deposit(params2);

      // total shares must be 3 units
      expect(await vault.totalShares()).to.equal(
        amount.mul(3).mul(SHARES_MULTIPLIER)
      );
    });

    it("fails if pct does not add up to 100%", async () => {
      await addUnderlyingBalance(alice, "1000");

      const params = depositParams.build({
        claims: [
          claimParams.percent(49).build(),
          claimParams.percent(50).build(),
        ],
      });

      const action = vault.connect(alice).deposit(params);

      await expect(action).to.be.revertedWith(
        "Vault: claims don't add up to 100%"
      );
    });
  });

  function addYieldToVault(amount: string) {
    return underlying.mint(vault.address, parseUnits(amount));
  }

  async function addUnderlyingBalance(
    account: SignerWithAddress,
    amount: string
  ) {
    await underlying.mint(account.address, parseUnits(amount));
    return underlying
      .connect(account)
      .approve(vault.address, parseUnits(amount));
  }

  function removeUnderlyingFromVault(amount: string) {
    return underlying.burn(vault.address, parseUnits(amount));
  }
});
