import MerkleTree from './merkle-tree';
import { BigNumber, utils } from 'ethers';

export default class BalanceTree {
  private readonly tree: MerkleTree;
  constructor(balances: { who: string; allocation: BigNumber }[]) {
    this.tree = new MerkleTree(
      balances.map(({ who, allocation }, index) => {
        return BalanceTree.toNode(who, allocation);
      }),
    );
  }

  public static verifyProof(
    who: string,
    allocation: BigNumber,
    proof: Buffer[],
    root: Buffer,
  ): boolean {
    let pair = BalanceTree.toNode(who, allocation);
    for (const item of proof) {
      pair = MerkleTree.combinedHash(pair, item);
    }

    return pair.equals(root);
  }

  public static toNode(who: string, allocation: BigNumber): Buffer {
    return Buffer.from(
      utils
        .solidityKeccak256(['address', 'uint256'], [who, allocation])
        .substr(2),
      'hex',
    );
  }

  public getHexRoot(): string {
    return this.tree.getHexRoot();
  }

  // returns the hex bytes32 values of the proof
  public getProof(who: string, allocation: BigNumber): string[] {
    return this.tree.getHexProof(BalanceTree.toNode(who, allocation));
  }
}
