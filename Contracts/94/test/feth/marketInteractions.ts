import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ContractTransaction } from "ethers";
import { ethers } from "hardhat";
import { FETH, FETHMarketMock, FETHMarketMock__factory } from "../../typechain-types";
import { deployFETH } from "../helpers/deploy";
import { getFethExpectedExpiration } from "../helpers/feth";

describe("FETH / marketInteractions", function () {
  let feth: FETH;
  let mockMarket: FETHMarketMock;
  let deployer: SignerWithAddress;
  let user: SignerWithAddress;
  let rando: SignerWithAddress;
  let tx: ContractTransaction;
  const amount = ethers.utils.parseEther("1");
  let expiry: number;

  beforeEach(async () => {
    [deployer, user, rando] = await ethers.getSigners();
    const MarketMock = new FETHMarketMock__factory(deployer);
    mockMarket = await MarketMock.deploy();
    feth = await deployFETH({ deployer, marketAddress: mockMarket.address });
    await mockMarket.setFeth(feth.address);
  });

  // This demonstrates how you can use the mock to test FETH directly.
  // The other calls are available in a similar fashion.
  describe("`marketLockupFor`", () => {
    beforeEach(async () => {
      tx = await mockMarket.connect(user).marketLockupFor(user.address, amount, { value: amount });
      expiry = await getFethExpectedExpiration(tx);
    });

    it("Emits BalanceLocked", async () => {
      await expect(tx).to.emit(feth, "BalanceLocked").withArgs(user.address, expiry, amount, amount);
    });

    it("Has no available balance", async () => {
      const balance = await feth.balanceOf(user.address);
      expect(balance).to.eq(0);
    });

    it("Has total balance", async () => {
      const balance = await feth.totalBalanceOf(user.address);
      expect(balance).to.eq(amount);
    });

    it("Has lockup", async () => {
      const lockups = await feth.getLockups(user.address);
      expect(lockups.amounts[0]).to.eq(amount);
      expect(lockups.expiries[0]).to.eq(expiry);
    });

    it("Transfers ETH", async () => {
      await expect(tx).to.changeEtherBalances([feth, user], [amount, amount.mul(-1)]);
    });
  });
});
