import { EthereumProvider } from "hardhat/types";

class TimeTraveler {
  private snapshotID: any;
  private ethereum: EthereumProvider;

  constructor(ethereum: EthereumProvider) {
    this.ethereum = ethereum;
  }

  public async snapshot() {
    const snapshot = await this.ethereum.send("evm_snapshot", []);
    await this.mine_blocks(1);
    this.snapshotID = snapshot;
    return;
  }

  public async revertSnapshot() {
    await this.ethereum.send("evm_revert", [this.snapshotID]);
    await this.mine_blocks(1);
    await this.snapshot();
    return;
  }

  public async mine_blocks(amount: number) {
    for (let i = 0; i < amount; i++) {
      await this.ethereum.send("evm_mine", []);
    }
  }

  public async increaseTime(amount: number) {
    await this.ethereum.send("evm_increaseTime", [amount]);
  }

  public async setNextBlockTimestamp(timestamp: number) {
    await this.ethereum.send("evm_setNextBlockTimestamp", [timestamp]);
  }
}

export default TimeTraveler;