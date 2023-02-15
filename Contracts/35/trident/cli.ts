import { BENTOBOX_ADDRESS, ChainId } from "@sushiswap/core-sdk";
import { BigNumber, constants } from "ethers";
import { task, types } from "hardhat/config";

// import { bytecode } from "./artifacts/contracts/pool/ConstantProductPool.sol/ConstantProductPool.json";

const { MaxUint256 } = constants;

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (args, { ethers }) => {
  const accounts = await ethers.getSigners();

  for (const account of accounts) {
    console.log(await account.address);
  }
});

task("erc20:approve", "ERC20 approve")
  .addParam("token", "Token")
  .addParam("spender", "Spender")
  .setAction(async function ({ token, spender }, { ethers }, runSuper) {
    const dev = await ethers.getNamedSigner("dev");
    const erc20 = await ethers.getContractFactory("ERC20Mock");

    const slp = erc20.attach(token);

    await (await slp.connect(dev).approve(spender, MaxUint256)).wait();
  });

task("constant-product-pool:deploy", "Constant Product Pool deploy")
  .addOptionalParam(
    "tokenA",
    "Token A",
    "0xd0A1E359811322d97991E03f863a0C30C2cF029C", // kovan weth
    types.string
  )
  .addOptionalParam(
    "tokenB",
    "Token B",
    "0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa", // kovan dai
    types.string
  )
  .addOptionalParam("fee", "Fee tier", 30, types.int)
  .addOptionalParam("twap", "Twap enabled", true, types.boolean)
  .setAction(async function ({ tokenA, tokenB, fee, twap }, { ethers }, runSuper) {
    const masterDeployer = await ethers.getContract("MasterDeployer");

    const constantProductPoolFactory = await ethers.getContract("ConstantProductPoolFactory");

    const deployData = ethers.utils.defaultAbiCoder.encode(
      ["address", "address", "uint256", "bool"],
      [...[tokenA, tokenB].sort(), fee, twap]
    );

    const { events } = await (await masterDeployer.deployPool(constantProductPoolFactory.address, deployData)).wait();

    console.log(events);
  });

task("constant-product-pool:address", "Constant Product Pool deploy")
  .addOptionalParam(
    "tokenA",
    "Token A",
    "0xd0A1E359811322d97991E03f863a0C30C2cF029C", // kovan weth
    types.string
  )
  .addOptionalParam(
    "tokenB",
    "Token B",
    "0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa", // kovan dai
    types.string
  )
  .addOptionalParam("fee", "Fee tier", 30, types.int)
  .addOptionalParam("twap", "Twap enabled", true, types.boolean)
  .setAction(async function ({ tokenA, tokenB, fee, twap }, { ethers }) {
    const master = (await ethers.getContract("MasterDeployer")).address;
    const factory = (await ethers.getContract("ConstantProductPoolFactory")).address;

    const deployData = ethers.utils.defaultAbiCoder.encode(
      ["address", "address", "uint256", "bool"],
      [...[tokenA, tokenB].sort(), fee, twap]
    );
    const salt = ethers.utils.keccak256(deployData);
    const constructorParams = ethers.utils.defaultAbiCoder.encode(["bytes", "address"], [deployData, master]).substring(2);
    const Pool = await ethers.getContractFactory("ConstantProductPool");
    const initCodeHash = ethers.utils.keccak256(Pool.bytecode + constructorParams);
    const poolAddress = ethers.utils.getCreate2Address(factory, salt, initCodeHash);

    // console.log(
    //   "is pool.bytecode identical to artifact bytecode?",
    //   Pool.bytecode === bytecode
    // );

    console.log({ initCodeHash, poolAddress });
  });

task("whitelist", "Whitelist Router on BentoBox").setAction(async function (_, { ethers, getChainId }) {
  const dev = await ethers.getNamedSigner("dev");

  const chainId = await getChainId();

  const router = await ethers.getContract("TridentRouter");

  const BentoBox = await ethers.getContractFactory("BentoBoxV1");

  let bentoBox;
  try {
    const _bentoBox = await ethers.getContract("BentoBoxV1");
    bentoBox = BentoBox.attach(_bentoBox.address);
  } catch ({}) {
    bentoBox = BentoBox.attach(BENTOBOX_ADDRESS[chainId]);
  }

  await (await bentoBox.connect(dev).whitelistMasterContract(router.address, true)).wait();

  console.log(`Router successfully whitelisted on BentoBox (BentoBox: ${bentoBox.address})`);
});

task("router:add-liquidity", "Router add liquidity")
  .addOptionalParam(
    "tokenA",
    "Token A",
    "0xd0A1E359811322d97991E03f863a0C30C2cF029C", // kovan weth
    types.string
  )
  .addOptionalParam(
    "tokenB",
    "Token B",
    "0x4F96Fe3b7A6Cf9725f59d353F723c1bDb64CA6Aa", // kovan dai
    types.string
  )
  .addOptionalParam(
    "pool",
    "Pool",
    "0x34DC0c3fff06EF015a2135444A33B12c0C5A3A71", // dai/weth
    types.string
  )
  .addParam("tokenADesired", "Token A Desired", BigNumber.from(10).pow(18).toString(), types.string)
  .addParam("tokenBDesired", "Token B Desired", BigNumber.from(10).pow(18).toString(), types.string)
  // .addParam("tokenAMinimum", "Token A Minimum")
  // .addParam("tokenBMinimum", "Token B Minimum")
  // .addParam("to", "To")
  // .addOptionalParam("deadline", "Deadline", MaxUint256)
  .setAction(async function ({ tokenA, tokenB, pool }, { ethers, run, getChainId }, runSuper) {
    const chainId = await getChainId();

    const router = await ethers.getContract("TridentRouter");

    const BentoBox = await ethers.getContractFactory("BentoBoxV1");
    let bentoBox;
    try {
      const _bentoBox = await ethers.getContract("BentoBoxV1");
      bentoBox = BentoBox.attach(_bentoBox.address);
    } catch ({}) {
      bentoBox = BentoBox.attach(BENTOBOX_ADDRESS[chainId]);
    }

    const dev = await ethers.getNamedSigner("dev");

    let liquidityInput = [
      {
        token: tokenA,
        native: false,
        amount: ethers.BigNumber.from(10).pow(12),
      },
      {
        token: tokenB,
        native: false,
        amount: ethers.BigNumber.from(10).pow(12),
      },
    ];

    await (await bentoBox.connect(dev).whitelistMasterContract(router.address, true)).wait();
    console.log("Whitelisted master contract");

    await run("erc20:approve", {
      token: liquidityInput[0].token,
      spender: bentoBox.address,
    });

    await run("erc20:approve", {
      token: liquidityInput[1].token,
      spender: bentoBox.address,
    });

    console.log("Approved both tokens");

    await (await bentoBox.connect(dev).deposit(liquidityInput[0].token, dev.address, dev.address, 0, liquidityInput[0].amount)).wait();
    await (await bentoBox.connect(dev).deposit(liquidityInput[1].token, dev.address, dev.address, 0, liquidityInput[1].amount)).wait();

    console.log("Deposited");

    await (
      await bentoBox
        .connect(dev)
        .setMasterContractApproval(
          dev.address,
          router.address,
          true,
          "0",
          "0x0000000000000000000000000000000000000000000000000000000000000000",
          "0x0000000000000000000000000000000000000000000000000000000000000000"
        )
    ).wait();

    console.log("Set master contract approval");

    const data = ethers.utils.defaultAbiCoder.encode(["address"], [dev.address]);

    await (await router.connect(dev).addLiquidity(liquidityInput, pool, 1, data)).wait();

    console.log("Added liquidity");
  });

// misc helpers for testing purposes

task("strategy:add", "Add strategy to BentoBox")
  .addParam("token", "Token of strategy", "0xd0A1E359811322d97991E03f863a0C30C2cF029C") // weth
  .addParam("strategy", "Strategy", "0x65E58C475e6f9CeF0d79371cC278E7827a72b19b")
  .setAction(async function ({ bento, token, strategy }, { ethers, getChainId }) {
    const dev = await ethers.getNamedSigner("dev");
    const chainId = await getChainId();
    const BentoBox = await ethers.getContractFactory("BentoBoxV1");

    let bentoBox;
    try {
      const _bentoBox = await ethers.getContract("BentoBoxV1");
      bentoBox = BentoBox.attach(_bentoBox.address);
    } catch ({}) {
      bentoBox = BentoBox.attach(BENTOBOX_ADDRESS[chainId]);
    }

    await bentoBox.connect(dev).setStrategy(token, strategy);
    await bentoBox.connect(dev).setStrategy(token, strategy); // testing version of bentobox has a strategy delay of 0
    await bentoBox.connect(dev).setStrategyTargetPercentage(token, "70");
  });
