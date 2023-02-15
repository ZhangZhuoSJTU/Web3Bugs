import chai from "chai";
import { ethers, network } from "hardhat";
import { solidity } from "ethereum-waffle";
import { TestUniswapLiquidity } from "../typechain/TestUniswapLiquidity";
import { SimpleLogicBatchMiddleware } from "../typechain/SimpleLogicBatchMiddleware";
import { IUniswapV2Pair__factory } from "../typechain/factories/IUniswapV2Pair__factory";
import { TestLogicContract } from "../typechain/TestLogicContract";


import {IUniswapV2Router02__factory} from "../typechain/factories/IUniswapV2Router02__factory";

import { deployContracts } from "../test-utils";
import {
  getSignerAddresses,
  signHash,
  ZeroAddress,
  examplePowers,
} from "../test-utils/pure";
import { assert } from "console";

chai.use(solidity);
const { expect } = chai;

async function runTest() {
  //Take over the largest liquidity provider for USDC

  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: ["0x0c731fb0d03211dd32a456370ad2ec3ffad46520"],
  });

  let lp_signer = await ethers.provider.getSigner(
    "0x0c731fb0d03211dd32a456370ad2ec3ffad46520"
  );

  let starting_lp_eth_balance = await ethers.provider.getBalance(await lp_signer.getAddress());

  console.log(`Starting LP eth balance ${starting_lp_eth_balance}`);

  let uniswap_router_address = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";

  let uniswap_router_contact = await IUniswapV2Pair__factory.connect(uniswap_router_address,lp_signer);


  let usdc_eth_lp =await IUniswapV2Pair__factory.connect("0xb4e16d0168e52d35cacd2c6185b44281ec28c9dc",lp_signer)



  let total_lp_supply = (await usdc_eth_lp.functions.totalSupply())[0]

  let lp_provider_balance = (await usdc_eth_lp.functions.balanceOf(await lp_signer.getAddress()))[0];

  let [reserve0,reserve1,_] = await usdc_eth_lp.functions.getReserves()

  console.log(`TotalSupply:${total_lp_supply} Whale Balance:${lp_provider_balance} Reserve0:${reserve0} Reserve1:${reserve1}`);

  let lp_balance_to_send = 2_000_000_000_000;

  let eth_per_lp_unit = reserve1.div(total_lp_supply); 

  console.log(`Eth per lp token:${eth_per_lp_unit}`)

  // USDC ethereum address
  let usdc_address = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";

  let wrapped_eth_address ="0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";


  // Prep and deploy contract
  // ========================
  const signers = await ethers.getSigners();
  const gravityId = ethers.utils.formatBytes32String("foo");
  // This is the power distribution on the Cosmos hub as of 7/14/2020
  let powers = examplePowers();
  let validators = signers.slice(0, powers.length);
  const powerThreshold = 6666;
  const {
    gravity,
    testERC20,
    checkpoint: deployCheckpoint,
  } = await deployContracts(gravityId, powerThreshold, validators, powers);

  // First we deploy the logic batch middleware contract. This makes it easy to call a logic
  // contract a bunch of times in a batch.
  const SimpleLogicBatchMiddleware = await ethers.getContractFactory(
    "SimpleLogicBatchMiddleware"
  );
  const logicBatch = (await SimpleLogicBatchMiddleware.deploy()) as SimpleLogicBatchMiddleware;
  // We set the ownership to gravity so that nobody else can call it.
  await logicBatch.transferOwnership(gravity.address);

  // Then we deploy the actual logic contract.
  const TestUniswapLiquidityContract = await ethers.getContractFactory(
    "TestUniswapLiquidity"
  );
  const logicContract = (await TestUniswapLiquidityContract.deploy(
    uniswap_router_address
  )) as TestUniswapLiquidity;
  // We set its owner to the batch contract.
  await logicContract.transferOwnership(logicBatch.address);


  let logic_contract_balance_start = await usdc_eth_lp.balanceOf(logicContract.address)


  console.log(`Logic Contract Balance ${logic_contract_balance_start}`);


  // Transfer out to Cosmos, locking coins
  // =====================================
  await usdc_eth_lp.functions.approve(gravity.address, lp_provider_balance);

  // Swap the signer of Gravity to the whale liqudity provider.
  let gravity_lp_signer = gravity.connect(lp_signer);

  await gravity_lp_signer.functions.sendToCosmos(
    usdc_eth_lp.address,
    ethers.utils.formatBytes32String("myCosmosAddress"),
    lp_balance_to_send *500
  );

  let post_gas_balance = await ethers.provider.getBalance(await lp_signer.getAddress());

  console.log(`Post_gas_balance ${post_gas_balance}`);


  // Prepare batch
  // ===============================
  // This code prepares the batch of transactions by encoding the arguments to the logicContract.
  // This batch contains 10 transactions which each:
  // - Transfer 5 coins to the logic contract
  // - Call transferTokens on the logic contract, transferring 2+2 coins to signer 20
  //
  // After the batch runs, signer 20 should have 40 coins, Gravity should have 940 coins,
  // and the logic contract should have 10 coins
  const numTxs = 3;
  const txPayloads = new Array(numTxs);

  const txAmounts = new Array(numTxs);
  for (let i = 0; i < numTxs; i++) {
    txAmounts[i] =lp_balance_to_send;
    txPayloads[
      i
    ] = logicContract.interface.encodeFunctionData("redeemLiquidityETH", [
      usdc_address,
      lp_balance_to_send,
      0,
      0,
      await lp_signer.getAddress(),
      4766922941000,
    ]);
  }
  
  // txAmounts.push(5);
  // txPayloads.push(logicContract.interface.encodeFunctionData("transferTokens", [await signers[20].getAddress(), 2, 3,usdc_eth_lp.address]));

  // txAmounts.push(5);
  // txPayloads.push(logicContract.interface.encodeFunctionData("transferTokens", [await signers[20].getAddress(), 3, 2,usdc_eth_lp.address]));


  let invalidationNonce = 1;

  let timeOut = 4766922941000;

  // Call method
  // ===========
  // We have to give the logicBatch contract 5 coins for each tx, since it will transfer that
  // much to the logic contract.
  // We give msg.sender 1 coin in fees for each tx.
  const methodName = ethers.utils.formatBytes32String("logicCall");

  let logicCallArgs = {
    transferAmounts: [lp_balance_to_send * 400], // transferAmounts
    transferTokenContracts: [usdc_eth_lp.address], // transferTokenContracts
    feeAmounts: [numTxs], // feeAmounts
    feeTokenContracts: [usdc_eth_lp.address], // feeTokenContracts
    logicContractAddress: logicBatch.address, // logicContractAddress
    payload: logicBatch.interface.encodeFunctionData("logicBatch", [
      txAmounts,
      txPayloads,
      logicContract.address,
      usdc_eth_lp.address,
    ]), // payloads
    timeOut,
    invalidationId: ethers.utils.hexZeroPad(testERC20.address, 32), // invalidationId
    invalidationNonce: invalidationNonce, // invalidationNonce
  };

  const digest = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      [
        "bytes32", // gravityId
        "bytes32", // methodName
        "uint256[]", // transferAmounts
        "address[]", // transferTokenContracts
        "uint256[]", // feeAmounts
        "address[]", // feeTokenContracts
        "address", // logicContractAddress
        "bytes", // payload
        "uint256", // timeOut
        "bytes32", // invalidationId
        "uint256", // invalidationNonce
      ],
      [
        gravityId,
        methodName,
        logicCallArgs.transferAmounts,
        logicCallArgs.transferTokenContracts,
        logicCallArgs.feeAmounts,
        logicCallArgs.feeTokenContracts,
        logicCallArgs.logicContractAddress,
        logicCallArgs.payload,
        logicCallArgs.timeOut,
        logicCallArgs.invalidationId,
        logicCallArgs.invalidationNonce,
      ]
    )
  );

  const sigs = await signHash(validators, digest);

  let currentValsetNonce = 0;

  let valset = {
    validators: await getSignerAddresses(validators),
    powers,
    valsetNonce: currentValsetNonce,
    rewardAmount: 0,
    rewardToken: ZeroAddress
  }

  await gravity.submitLogicCall(
    valset,

    sigs.v,
    sigs.r,
    sigs.s,
    logicCallArgs
  );

  //TODO Design the asserts correctly

  let ending_lp_eth_balance = await ethers.provider.getBalance(await lp_signer.getAddress());

  console.log(`Ending LP eth balance ${ending_lp_eth_balance}`);

  let balance_difference = ending_lp_eth_balance.sub(post_gas_balance);

  console.log(`Ending LP eth balance difference ${balance_difference}`);

  let exepect_gains = eth_per_lp_unit.mul(lp_balance_to_send * numTxs);

  console.log(`Expected LP eth balance difference ${exepect_gains}`);

  let logic_contract_balance_end = await usdc_eth_lp.balanceOf(logicContract.address)

  console.log(`Logic Contract Balance ${logic_contract_balance_end}`);


  expect(logic_contract_balance_end.toNumber()).to.equal(0)

  expect(balance_difference.sub(exepect_gains).toNumber()).to.be.greaterThan(0);

}

describe("uniswap logic happy path tests", function () {
  it("runs", async function () {
    await runTest();
  });
});
