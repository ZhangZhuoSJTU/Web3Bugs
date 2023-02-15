class TimeTraveler {
  constructor(ethereum) {
    this.ethereum = ethereum;
  }

  async snapshot() {
    const snapshot = await this.ethereum.send('evm_snapshot', []);
    await this.mine(1);
    this.snapshotID = snapshot;
    return;
  }

  async revertSnapshot() {
    await this.ethereum.send('evm_revert', [this.snapshotID]);
    //await this.mine(1);
    await this.snapshot();
    return;
  }

  async mine(amount) {
    for (let i = 0; i < amount; i++) {
      await this.ethereum.send('evm_mine', []);
    }
  }

  async increaseTime(amount) {
    await this.ethereum.send('evm_increaseTime', [amount]);
  }

  async setNextBlockTimestamp(timestamp) {
    await this.ethereum.send('evm_setNextBlockTimestamp', [timestamp]);
  }

  async request(request) {
    await this.ethereum.request(request);
  }
}

module.exports.TimeTraveler = TimeTraveler;
