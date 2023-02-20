const MerkleTree = require('./merkle-tree');
const { utils } = require('ethers');

module.exports = class BalanceTree {
  tree;
  constructor(balances = { who, allocation }) {
    this.tree = new MerkleTree(
      balances.map(({ who, allocation }, index) => {
        return BalanceTree.toNode(who, allocation);
      }),
    );
  }

  static verifyProof(who, allocation, proof, root) {
    let pair = BalanceTree.toNode(who, allocation);
    for (const item of proof) {
      pair = MerkleTree.combinedHash(pair, item);
    }

    return pair.equals(root);
  }

  static toNode(who, allocation) {
    return Buffer.from(
      utils
        .solidityKeccak256(['address', 'uint256'], [who, allocation])
        .substr(2),
      'hex',
    );
  }

  getHexRoot() {
    return this.tree.getHexRoot();
  }

  // returns the hex bytes32 values of the proof
  getProof(who, allocation) {
    return this.tree.getHexProof(BalanceTree.toNode(who, allocation));
  }
};
