import { providers } from "ethers";

export class Blockchain {
  public _provider: providers.Web3Provider | providers.JsonRpcProvider;
  private _snapshotId: number;

  constructor(_provider: providers.Web3Provider | providers.JsonRpcProvider) {
    this._provider = _provider;

    this._snapshotId = 0;
  }

  public async saveSnapshotAsync(): Promise<string> {
    const response = await this.sendJSONRpcRequestAsync("evm_snapshot", []);

    this._snapshotId = response;
    return response;
  }

  public async revertAsync(): Promise<void> {
    await this.sendJSONRpcRequestAsync("evm_revert", [this._snapshotId]);
  }

  public async revertByIdAsync(id: string): Promise<void> {
    await this.sendJSONRpcRequestAsync("evm_revert", [id]);
  }

  public async resetAsync(): Promise<void> {
    await this.sendJSONRpcRequestAsync("evm_revert", ["0x1"]);
  }

  public async increaseTimeAsync(duration: number): Promise<any> {
    await this.sendJSONRpcRequestAsync("evm_increaseTime", [duration]);
  }

  public async getCurrentTimestamp(): Promise<any> {
    return await this._provider.getBlock(await this._provider.getBlockNumber());
  }

  public async setNextBlockTimestamp(timestamp: number): Promise<any> {
    await this.sendJSONRpcRequestAsync("evm_setNextBlockTimestamp", [timestamp]);
  }

  public async waitBlocksAsync(count: number) {
    for (let i = 0; i < count; i++) {
      await this.sendJSONRpcRequestAsync("evm_mine", []);
    }
  }

  private async sendJSONRpcRequestAsync(method: string, params: any[]): Promise<any> {
    return this._provider.send(method, params);
  }
}
