const fs = require("fs");
const path = require("path");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");
const { defaultAbiCoder } = require("ethers/lib/utils");

const generateMerkleProof = (tokenId, tokenIds) => {
  const leaves = tokenIds.map((v) =>
    keccak256(defaultAbiCoder.encode(["uint256"], [v]))
  );
  const tree = new MerkleTree(leaves, keccak256, { sort: true });
  const proof = tree.getHexProof(
    keccak256(defaultAbiCoder.encode(["uint256"], [tokenId]))
  );

  return proof;
};

const main = async () => {
  const rankingFile = process.argv[2];
  const tokenId = process.argv[3];

  const { tokenIds } = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../rankings", rankingFile), {
      encoding: "utf8",
    })
  );

  const merkleProof = generateMerkleProof(tokenId, tokenIds);

  process.stdout.write(defaultAbiCoder.encode(["bytes32[]"], [merkleProof]));
  process.exit();
};

main();

module.exports = { generateMerkleProof };
