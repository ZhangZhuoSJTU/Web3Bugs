import { providers, BigNumber, Signer } from "ethers";

import {
  Vault,
  Registry
} from "../contracts/yearn";
import DeployHelper from "../deploys";
import { Address } from "../types";

export class YearnFixture {
  private _deployer: DeployHelper;
  private _ownerAddress: Address;
  private _ownerSigner: Signer;

  public registry: Registry;

  constructor(provider: providers.Web3Provider | providers.JsonRpcProvider, ownerAddress: Address) {
    this._ownerAddress = ownerAddress;
    this._ownerSigner = provider.getSigner(ownerAddress);
    this._deployer = new DeployHelper(this._ownerSigner);
  }

  public async initialize(): Promise<void> {
    this.registry = await this._deployer.external.deployRegistry();  // self.governance = msg.sender == ownerAddress
  }

  public async createAndEnableVaultWithStrategyMock(
    underlying: Address,
    governance: Address,
    guardian: Address,
    rewards: Address,
    name: string,
    symbol: string,
    depositLimit: BigNumber
  ): Promise<Vault> {
    // https://github.com/yearn/yearn-vaults/blob/master/docs/OPERATIONS.md
    const emptyVault = await this._deployer.external.deployVault();
    await emptyVault["initialize(address,address,address,string,string,address)"]
    (underlying, governance, rewards, name, symbol, guardian);

    await emptyVault.setGovernance(this._ownerAddress);
    await emptyVault.acceptGovernance();

    await this.registry.newRelease(emptyVault.address);
    await this.registry["newVault(address,address,address,string,string)"](underlying, guardian, rewards, name, symbol);

    const vaultAddress = await this.registry.latestVault(underlying);

    const vault = await this._deployer.external.getVault(vaultAddress);
    await vault.setDepositLimit(depositLimit);
    await vault.setManagementFee(0);

    const strategy = await this._deployer.mocks.deployYearnStrategyMock(vault.address);

    await vault.addStrategy(strategy.address, 9800, 0, 1000, 0);

    await strategy.setKeeper(this._ownerAddress);
    await strategy.setRewards(rewards);


    return vault;
  }
}
