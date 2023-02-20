import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ContractTransaction } from "ethers";
import { ethers } from "hardhat";
import { FoundationTreasury } from "../typechain-types";
import { deployContracts } from "./helpers/deploy";

describe("Treasury", function () {
  const value = ethers.utils.parseEther("1");

  let treasury: FoundationTreasury;
  let deployer: SignerWithAddress;
  let admin: SignerWithAddress;
  let operator: SignerWithAddress;
  let withdrawToWallet: SignerWithAddress;
  let user: SignerWithAddress;
  let tx: ContractTransaction;

  beforeEach(async () => {
    [deployer, admin, operator, withdrawToWallet, user] = await ethers.getSigners();
    ({ treasury } = await deployContracts({ deployer, defaultAdmin: admin, defaultOperator: operator }));

    // Deposit funds, typically they come from the market contract
    await user.sendTransaction({
      to: treasury.address,
      value,
    });
  });

  describe("Admins can withdraw funds", () => {
    beforeEach(async () => {
      tx = await treasury.connect(admin).withdrawFunds(withdrawToWallet.address, value);
    });

    it("Changes balances", async () => {
      await expect(tx).to.changeEtherBalances([treasury, withdrawToWallet], [value.mul(-1), value]);
    });

    it("Emits FundsWithdrawn", async () => {
      await expect(tx).to.emit(treasury, "FundsWithdrawn").withArgs(withdrawToWallet.address, value);
    });
  });

  it("Other users cannot withdraw", async () => {
    await expect(treasury.connect(user).withdrawFunds(withdrawToWallet.address, value)).to.be.revertedWith(
      "AdminRole: caller does not have the Admin role",
    );
  });
});
