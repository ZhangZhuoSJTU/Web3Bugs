import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { time } from "@openzeppelin/test-helpers";
import { ethers } from "hardhat";
import { expect } from "chai";

import type { Vault, TestERC20, Depositors, Claimers } from "../typechain";
import { Claimers__factory, Depositors__factory } from "../typechain";
import { depositParams, claimParams } from "./shared/factories";
import {
  getLastBlockTimestamp,
  moveForwardTwoWeeks,
  SHARES_MULTIPLIER,
} from "./shared";
import { BigNumber } from "ethers";

const { parseUnits } = ethers.utils;
const BN = ethers.BigNumber;

describe("Integration", () => {
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let carol: SignerWithAddress;

  let underlying: TestERC20;
  let vault: Vault;
  let depositors: Depositors;
  let claimers: Claimers;

  beforeEach(async () => {
    [owner, alice, bob, carol] = await ethers.getSigners();

    let TestERC20 = await ethers.getContractFactory("TestERC20");
    let Vault = await ethers.getContractFactory("Vault");

    underlying = (await TestERC20.deploy(0)) as TestERC20;
    vault = (await Vault.deploy(
      underlying.address,
      1209600,
      0,
      owner.address
    )) as Vault;
    depositors = Depositors__factory.connect(await vault.depositors(), owner);
    claimers = Claimers__factory.connect(await vault.claimers(), owner);
  });

  describe("single deposit, single sponsor and single claimer", () => {
    it("ensures everyone gets their expected amounts", async () => {
      await addUnderlyingBalance(alice, "1000");
      await addUnderlyingBalance(bob, "1000");

      await vault.connect(bob).sponsor(parseUnits("500"), 0);

      await vault.connect(alice).deposit(
        depositParams.build({
          amount: parseUnits("500"),
          claims: [claimParams.percent(100).to(carol.address).build()],
        })
      );

      await addYieldToVault("2000");
      await moveForwardTwoWeeks();

      await vault.connect(carol).claimYield(carol.address);
      await vault.connect(alice).withdraw(alice.address, [1]);
      await vault.connect(bob).unsponsor(bob.address, [0]);

      expect(await underlyingBalanceOf(bob)).to.eq(parseUnits("1000"));
      expect(await underlyingBalanceOf(alice)).to.eq(parseUnits("1000"));
      expect(await underlyingBalanceOf(carol)).to.eq(parseUnits("2000"));
    });

    it("ensures the sponsored amount is protected when the vault is underperforming", async () => {
      await addUnderlyingBalance(alice, "1000");
      await addUnderlyingBalance(bob, "1000");

      await vault.connect(bob).sponsor(parseUnits("500"), 0);

      await vault.connect(alice).deposit(
        depositParams.build({
          amount: parseUnits("500"),
          claims: [claimParams.percent(100).to(carol.address).build()],
        })
      );

      await addYieldToVault("2000");
      await moveForwardTwoWeeks();
      await removeUnderlyingFromVault("2500");

      await vault.connect(carol).claimYield(carol.address);
      // we expect the withdraw to fail because there are not enough funds in the vault
      await expect(
        vault.connect(alice).withdraw(alice.address, [1])
      ).to.be.revertedWith(
        "Vault: cannot compute shares when there's no principal"
      );
      await vault.connect(bob).unsponsor(bob.address, [0]);

      expect(await underlyingBalanceOf(bob)).to.eq(parseUnits("1000"));
      expect(await underlyingBalanceOf(alice)).to.eq(parseUnits("500"));
      expect(await underlyingBalanceOf(carol)).to.eq(parseUnits("0"));
    });

    it("ensures the sponsored amount and the deposit are protected when the vault has no yield", async () => {
      await addUnderlyingBalance(alice, "1000");
      await addUnderlyingBalance(bob, "1000");

      await vault.connect(bob).sponsor(parseUnits("500"), 0);

      await vault.connect(alice).deposit(
        depositParams.build({
          amount: parseUnits("500"),
          claims: [claimParams.percent(100).to(carol.address).build()],
        })
      );

      await moveForwardTwoWeeks();

      await vault.connect(carol).claimYield(carol.address);
      await vault.connect(alice).withdraw(alice.address, [1]);
      await vault.connect(bob).unsponsor(bob.address, [0]);

      expect(await underlyingBalanceOf(bob)).to.eq(parseUnits("1000"));
      expect(await underlyingBalanceOf(alice)).to.eq(parseUnits("1000"));
      expect(await underlyingBalanceOf(carol)).to.eq(parseUnits("0"));
    });
  });

  describe("single deposit, two sponsors and two claimers", () => {
    it("ensures the sponsored amount is divided according to their proportion of each claimer's shares", async () => {
      await addUnderlyingBalance(alice, "1500");
      await addUnderlyingBalance(bob, "1000");

      // alice and bob sponsor
      await vault.connect(alice).sponsor(parseUnits("500"), 0);
      await vault.connect(bob).sponsor(parseUnits("500"), 0);

      // alice deposits with yield to herself and to carol
      await vault.connect(alice).deposit(
        depositParams.build({
          amount: parseUnits("1000"),
          claims: [
            claimParams.percent(50).to(alice.address).build(),
            claimParams.percent(50).to(carol.address).build(),
          ],
        })
      );

      // the vault generates yield
      await addYieldToVault("1000");
      await moveForwardTwoWeeks();

      // alice claims her share
      await vault.connect(alice).claimYield(alice.address);
      expect(await underlyingBalanceOf(alice)).to.eq(parseUnits("500"));

      // the vault generates yield
      await addYieldToVault("1500");

      // alice withdraws the deposit
      await vault.connect(alice).withdraw(alice.address, [2, 3]);
      expect(await underlyingBalanceOf(alice)).to.eq(parseUnits("1500"));

      // alice and bob unsponsor
      await vault.connect(alice).unsponsor(alice.address, [0]);
      expect(await underlyingBalanceOf(alice)).to.eq(parseUnits("2000"));

      await vault.connect(bob).unsponsor(bob.address, [1]);
      expect(await underlyingBalanceOf(bob)).to.eq(parseUnits("1000"));

      // the vault generates yield
      await addYieldToVault("2000");

      // alice and carol claim the remaning yield
      await vault.connect(alice).claimYield(alice.address);
      expect(await underlyingBalanceOf(alice)).to.eq(parseUnits("3000"));

      await vault.connect(carol).claimYield(carol.address);
      expect(await underlyingBalanceOf(carol)).to.eq(parseUnits("3000"));
    });
  });

  describe("single deposit, single claimer", () => {
    it("creates a deposit and updates the claimer", async () => {
      await addUnderlyingBalance(alice, "1000");
      const params = depositParams.build({
        amount: parseUnits("100"),
        claims: [claimParams.percent(100).to(bob.address).build()],
      });

      await vault.connect(alice).deposit(params);

      expect(await depositors.ownerOf(0)).to.equal(alice.address);

      const deposit = await depositors.deposits(0);

      expect(deposit.amount).to.equal(parseUnits("100"));
      expect(deposit.claimerId).to.equal(1);

      expect(await vault.totalShares()).to.equal(
        parseUnits("100").mul(SHARES_MULTIPLIER)
      );

      const tokenId = await claimers.addressToTokenID(bob.address);
      expect(await claimers.principalOf(tokenId)).to.equal(parseUnits("100"));
    });
  });

  describe("single deposit, multiple claimers", () => {
    it("creates two deposit and updates the claimers", async () => {
      await addUnderlyingBalance(alice, "1000");
      const amount = BN.from("100");
      const params = depositParams.build({
        amount,
        claims: [
          claimParams.percent(25).to(bob.address).build(),
          claimParams.percent(75).to(carol.address).build(),
        ],
      });

      await vault.connect(alice).deposit(params);

      expect(await depositors.ownerOf(0)).to.equal(alice.address);
      const part0 = await depositors.deposits(0);
      expect(part0.amount).to.equal(amount.div("4"));
      expect(part0.claimerId).to.equal(1);

      const part1 = await depositors.deposits(1);
      expect(part1.amount).to.equal(amount.div("4").mul("3"));
      expect(part1.claimerId).to.equal(2);

      expect(await vault.totalShares()).to.equal(
        BigNumber.from("100").mul(SHARES_MULTIPLIER)
      );

      const bobTokenId = await claimers.addressToTokenID(bob.address);
      expect(await claimers.principalOf(bobTokenId)).to.equal(25);

      const carolTokenId = await claimers.addressToTokenID(carol.address);
      expect(await claimers.principalOf(carolTokenId)).to.equal(75);
    });

    it("allows claiming the yield after the principal is withdrawn", async () => {
      await addUnderlyingBalance(alice, "1000");
      const params = depositParams.build({
        amount: parseUnits("100"),
        claims: [
          claimParams.percent(50).to(bob.address).build(),
          claimParams.percent(50).to(carol.address).build(),
        ],
      });

      await vault.connect(alice).deposit(params);

      await addYieldToVault("100");
      await moveForwardTwoWeeks();
      await vault.connect(alice).withdraw(alice.address, [1, 0]);
      await addYieldToVault("100");
      await vault.connect(carol).claimYield(carol.address);
      await vault.connect(bob).claimYield(bob.address);

      expect(await underlyingBalanceOf(bob)).to.eq(parseUnits("100"));
      expect(await underlyingBalanceOf(carol)).to.eq(parseUnits("100"));
    });

    it("allows the yield to value after the principal is claiemd", async () => {
      await addUnderlyingBalance(alice, "1000");
      const params = depositParams.build({
        amount: parseUnits("100"),
        claims: [
          claimParams.percent(50).to(bob.address).build(),
          claimParams.percent(50).to(carol.address).build(),
        ],
      });

      await vault.connect(alice).deposit(params);
      await addYieldToVault("100");
      await moveForwardTwoWeeks();
      await vault.connect(alice).withdraw(alice.address, [0]);
      await addYieldToVault("150");
      await vault.connect(carol).claimYield(carol.address);
      await vault.connect(bob).claimYield(bob.address);

      expect(await underlyingBalanceOf(bob)).to.eq(parseUnits("100"));
      expect(await underlyingBalanceOf(carol)).to.eq(parseUnits("150"));
    });
  });

  describe("two deposits, two claimers", () => {
    it("withdraws only one of the deposits", async () => {
      await addUnderlyingBalance(alice, "1000");

      await vault.connect(alice).deposit(
        depositParams.build({
          lockedUntil: (
            await getLastBlockTimestamp()
          ).add(time.duration.days(20).toNumber()),
          amount: parseUnits("100"),
          claims: [claimParams.percent(100).to(carol.address).build()],
        })
      );

      await vault.connect(alice).deposit(
        depositParams.build({
          amount: parseUnits("100"),
          claims: [
            claimParams.percent(75).to(carol.address).build(),
            claimParams.percent(25).to(bob.address).build(),
          ],
        })
      );

      await moveForwardTwoWeeks();
      await vault.connect(alice).withdraw(alice.address, [1]);

      expect(await underlyingBalanceOf(alice)).to.eq(parseUnits("875"));
    });

    it("allows withdraws at different times", async () => {
      await addUnderlyingBalance(alice, "1000");

      await vault.connect(alice).deposit(
        depositParams.build({
          amount: parseUnits("100"),
          claims: [claimParams.percent(100).to(carol.address).build()],
        })
      );

      await addYieldToVault("100");

      await vault.connect(carol).claimYield(carol.address);

      await vault.connect(alice).deposit(
        depositParams.build({
          amount: parseUnits("100"),
          claims: [
            claimParams.percent(50).to(carol.address).build(),
            claimParams.percent(50).to(bob.address).build(),
          ],
        })
      );

      await addYieldToVault("200");

      await vault.connect(carol).claimYield(carol.address);
      await vault.connect(bob).claimYield(bob.address);

      expect(await underlyingBalanceOf(bob)).to.eq(parseUnits("50"));
      expect(await underlyingBalanceOf(carol)).to.eq(parseUnits("250"));
    });

    it("compounds the yield of the first deposit", async () => {
      await addUnderlyingBalance(alice, "1000");

      await vault.connect(alice).deposit(
        depositParams.build({
          amount: parseUnits("100"),
          claims: [claimParams.percent(100).to(carol.address).build()],
        })
      );

      await addYieldToVault("100");

      await vault.connect(alice).deposit(
        depositParams.build({
          amount: parseUnits("100"),
          claims: [
            claimParams.percent(50).to(carol.address).build(),
            claimParams.percent(50).to(bob.address).build(),
          ],
        })
      );

      await addYieldToVault("300");

      await vault.connect(carol).claimYield(carol.address);
      await vault.connect(bob).claimYield(bob.address);

      expect(await underlyingBalanceOf(bob)).to.eq(parseUnits("50"));
      expect(await underlyingBalanceOf(carol)).to.eq(parseUnits("350"));
    });
  });

  function addYieldToVault(amount: string) {
    return underlying.mint(vault.address, parseUnits(amount));
  }

  function removeUnderlyingFromVault(amount: string) {
    return underlying.burn(vault.address, parseUnits(amount));
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

  function underlyingBalanceOf(account: SignerWithAddress) {
    return underlying.balanceOf(account.address);
  }
});
