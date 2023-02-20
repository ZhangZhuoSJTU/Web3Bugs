import { ethers } from "hardhat";

// Inner snapshots.The "inner" state is whatever `before` in `proc` sets up.
// Reverts to the "outer" state after:
export const describeSnapshot = (name, proc) =>
  describe(name, () => {
    let outerSnapshotId;
    before(async () => {
      outerSnapshotId = await ethers.provider.send("evm_snapshot", []);
    });

    proc();

    let snapshotId = null;
    beforeEach(async () => {
      if (snapshotId) {
        await ethers.provider.send("evm_revert", [snapshotId]);
      }
      snapshotId = await ethers.provider.send("evm_snapshot", []);
    });

    after(async () => {
      await ethers.provider.send("evm_revert", [outerSnapshotId]);
    });
  });
