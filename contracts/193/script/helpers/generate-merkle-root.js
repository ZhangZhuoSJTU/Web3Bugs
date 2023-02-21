const fs = require("fs");
const path = require("path");
const { MerkleTree } = require("merkletreejs");
const keccak256 = require("keccak256");
const { defaultAbiCoder } = require("ethers/lib/utils");

const generateMerkleRoot = (rankingFile) => {
  const { tokenIds } = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../rankings", rankingFile), {
      encoding: "utf8",
    })
  );

  const leaves = tokenIds.map((v) =>
    keccak256(defaultAbiCoder.encode(["uint256"], [v]))
  );

  const tree = new MerkleTree(leaves, keccak256, { sort: true });
  const root = tree.getHexRoot();

  return root;
};

const main = async () => {
  const rankingFile = process.argv[2];
  const merkleRoot = generateMerkleRoot(rankingFile);

  process.stdout.write(merkleRoot);
  process.exit();
};

main();
