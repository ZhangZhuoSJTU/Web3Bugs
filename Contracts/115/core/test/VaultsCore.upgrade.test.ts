import {
  VaultsCoreInstance,
  VaultsCoreStateInstance,
  MockWETHInstance,
  USDXInstance,
  ConfigProviderInstance,
  AddressProviderInstance,
} from "../types/truffle-contracts/index";
import { assert } from "chai";

const { BN, expectRevert } = require("@openzeppelin/test-helpers");
import { basicSetup, constants } from "./utils/helpers";

const VaultsCore = artifacts.require("VaultsCore");
const VaultsCoreState = artifacts.require("VaultsCoreState");

const WETH_AMOUNT = constants.AMOUNT_ACCURACY.mul(new BN("100")); // 100 ETH
const MAX_INT = new BN("115792089237316195423570985008687907853269984665640564039457584007913129639935");

contract("VaultsCore upgrade", (accounts) => {
  const [alice, test] = accounts;

  let v1: {
    addresses: AddressProviderInstance;
    weth: MockWETHInstance;
    stablex: USDXInstance;
    core: VaultsCoreInstance;
    coreState: VaultsCoreStateInstance;
    config: ConfigProviderInstance;
  };

  let v2: {
    addresses: AddressProviderInstance;
    weth: MockWETHInstance;
    stablex: USDXInstance;
    core: VaultsCoreInstance;
    coreState: VaultsCoreStateInstance;
    config: ConfigProviderInstance;
  };

  beforeEach(async () => {
    v1 = await basicSetup();

    v2 = { ...v1 }; // Clone v1 variables
    v2.coreState = await VaultsCoreState.new(v1.addresses.address);
    v2.core = await VaultsCore.new(v1.addresses.address, v1.weth.address, v2.coreState.address);
    await v1.weth.mint(alice, WETH_AMOUNT); // Mint some test WETH
  });

  it("upgrading to new vaultscore should approve tokentranfers for both stablex and collateral types", async () => {
    await v1.core.upgrade(test);
    const allowanceWeth = await v1.weth.allowance(v1.core.address, test);
    assert.equal(allowanceWeth.toString(), MAX_INT.toString());
    const allowanceStableX = await v1.stablex.allowance(v1.core.address, test);
    assert.equal(allowanceStableX.toString(), MAX_INT.toString());
  });

  it("vaultscore acceptUpgrade should correcly transfer all tokens", async () => {
    const STABLEX_AMOUNT = WETH_AMOUNT.mul(new BN(2));
    await v1.weth.mint(v1.core.address, WETH_AMOUNT); // Mint some test WETH
    await v1.stablex.mint(v1.core.address, STABLEX_AMOUNT); // Mint some test PAR

    await v1.core.upgrade(v2.core.address);

    await v2.core.acceptUpgrade(v1.core.address);

    const wethBalance = await v1.weth.balanceOf(v2.core.address);
    assert.equal(wethBalance.toString(), WETH_AMOUNT.toString());

    const stableXBalance = await v1.stablex.balanceOf(v2.core.address);
    assert.equal(stableXBalance.toString(), STABLEX_AMOUNT.toString());
  });

  it("vaultscore state should allow syncing of internal state", async () => {
    await v2.coreState.syncState(v1.coreState.address);
    const cumulativeRateV1 = await v1.coreState.cumulativeRates(v1.weth.address);
    const cumulativeRateV2 = await v2.coreState.cumulativeRates(v1.weth.address);
    assert.equal(cumulativeRateV1.toString(), cumulativeRateV2.toString());
    const lastRefreshV1 = await v1.coreState.lastRefresh(v1.weth.address);
    const lastRefreshV2 = await v2.coreState.lastRefresh(v1.weth.address);
    assert.equal(lastRefreshV1.toString(), lastRefreshV2.toString());
  });

  it("sync state can only be called once", async () => {
    await v2.coreState.syncState(v1.coreState.address);

    await expectRevert.unspecified(v2.coreState.syncState(v1.coreState.address));
  });
});
