import "module-alias/register";
import { BigNumber } from "ethers/utils";
import { ethers } from "hardhat";

import { Address, Account } from "@utils/types";
import {} from "@utils/constants";
import {} from "@utils/contracts";
import DeployHelper from "@utils/deploys";
import {
  addSnapshotBeforeRestoreAfterEach,
  ether,
  getAccounts,
  getSystemFixture,
  getWaffleExpect,
} from "@utils/index";
import { SystemFixture } from "@utils/fixtures";
import { ContractTransaction } from "ethers";

const expect = getWaffleExpect();

describe("SPEC TITLE", () => {
  let owner: Account;
  let deployer: DeployHelper;
  let setup: SystemFixture;

  before(async () => {
    [
      owner,
    ] = await getAccounts();

    deployer = new DeployHelper(owner.wallet);
    setup = getSystemFixture(owner.address);
    await setup.initialize();
  });

  addSnapshotBeforeRestoreAfterEach();

  describe("#FUNCTION_NAME", async () => {
    let subjectArgument: Address;

    beforeEach(async () => {
    });

    async function subject(): Promise<any> {
    }

    it("should do something", async () => {
    });
  });
});
