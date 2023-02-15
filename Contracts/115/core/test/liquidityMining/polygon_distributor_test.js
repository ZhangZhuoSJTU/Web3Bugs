const MIMO = artifacts.require("MIMO");
const PolygonDistributor = artifacts.require("PolygonDistributor");

const { BN } = require("@openzeppelin/test-helpers");

global.web3 = web3;

const MIMO_ADDRESS = "0xEe25795fDbe6c14f898a59D92BF0268a9C424B5B";

const AMOUNT_ACCURACY = new BN(String(1e18));

// To run the script
// truffle exec test/liquidityMining/polygon_distributor_test.js --network

async function deploy(callback) {
  try {
    const polygonDistributor = await PolygonDistributor.at("0x2Af8Ac2862Edd49906863F6bc4e20419605FBb57");
    console.log("PolygonDistributor: ", polygonDistributor.address);

    const mimo = await MIMO.at(MIMO_ADDRESS);
    console.log("MIMO: ", mimo.address);

    await mimo.mint(polygonDistributor.address, AMOUNT_ACCURACY);
    await polygonDistributor.changePayees(["0xBe403e01eCF95e11dD02885f56f951b30eC8201d"], [100]);
    await polygonDistributor.release();
  } catch (error) {
    console.log(error);
  }

  callback();
}

module.exports = deploy;
