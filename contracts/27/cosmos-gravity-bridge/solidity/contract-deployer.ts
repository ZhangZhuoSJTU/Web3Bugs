import { Gravity } from "./typechain/Gravity";
import { TestERC20A } from "./typechain/TestERC20A";
import { TestERC20B } from "./typechain/TestERC20B";
import { TestERC20C } from "./typechain/TestERC20C";
import { TestUniswapLiquidity } from "./typechain/TestUniswapLiquidity";
import { ethers } from "ethers";
import fs from "fs";
import commandLineArgs from "command-line-args";
import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from "axios";
import { exit } from "process";
import { start } from "node:repl";
import { SSL_OP_EPHEMERAL_RSA } from "node:constants";

const args = commandLineArgs([
  // the ethernum node used to deploy the contract
  { name: "eth-node", type: String },
  // the cosmos node that will be used to grab the validator set via RPC (TODO),
  { name: "cosmos-node", type: String },
  // the Ethereum private key that will contain the gas required to pay for the contact deployment
  { name: "eth-privkey", type: String },
  // the gravity contract .json file
  { name: "contract", type: String },
  // test mode, if enabled this script deploys three ERC20 contracts for testing
  { name: "test-mode", type: String },
]);

// 4. Now, the deployer script hits a full node api, gets the Eth signatures of the valset from the latest block, and deploys the Ethereum contract.
//     - We will consider the scenario that many deployers deploy many valid gravity eth contracts.
// 5. The deployer submits the address of the gravity contract that it deployed to Ethereum.
//     - The gravity module checks the Ethereum chain for each submitted address, and makes sure that the gravity contract at that address is using the correct source code, and has the correct validator set.
type Validator = {
  power: number;
  ethereum_address: string;
};
type ValsetTypeWrapper = {
  type: string;
  value: Valset;
}
type Valset = {
  members: Validator[];
  nonce: number;
};
type ABCIWrapper = {
  jsonrpc: string;
  id: string;
  result: ABCIResponse;
};
type ABCIResponse = {
  response: ABCIResult
}
type ABCIResult = {
  code: number
  log: string,
  info: string,
  index: string,
  value: string,
  height: string,
  codespace: string,
};
type StatusWrapper = {
  jsonrpc: string,
  id: string,
  result: NodeStatus
};
type NodeInfo = {
  protocol_version: JSON,
  id: string,
  listen_addr: string,
  network: string,
  version: string,
  channels: string,
  moniker: string,
  other: JSON,
};
type SyncInfo = {
  latest_block_hash: string,
  latest_app_hash: string,
  latest_block_height: Number
  latest_block_time: string,
  earliest_block_hash: string,
  earliest_app_hash: string,
  earliest_block_height: Number,
  earliest_block_time: string,
  catching_up: boolean,
}
type NodeStatus = {
  node_info: NodeInfo,
  sync_info: SyncInfo,
  validator_info: JSON,
};

// sets the gas price for all contract deployments
const overrides = {
  //gasPrice: 100000000000
}

async function deploy() {
  var startTime = new Date();
  const provider = await new ethers.providers.JsonRpcProvider(args["eth-node"]);
  let wallet = new ethers.Wallet(args["eth-privkey"], provider);


  if (args["test-mode"] == "True" || args["test-mode"] == "true") {
    var success = false;
    while(!success) {
      var present = new Date();
      var timeDiff: number = present.getTime() - startTime.getTime();
      timeDiff = timeDiff / 1000
      provider.getBlockNumber().then(_ => success = true).catch(_ => console.log("Ethereum RPC error, trying again"))

      if (timeDiff > 600) {
        console.log("Could not contact Ethereum RPC after 10 minutes, check the URL!")
        exit(1)
      }
      await sleep(1000);
    }
  }

  if (args["test-mode"] == "True" || args["test-mode"] == "true") {
    console.log("Test mode, deploying ERC20 contracts");

    // this handles several possible locations for the ERC20 artifacts
    var erc20_a_path: string
    var erc20_b_path: string
    var erc20_c_path: string
    const main_location_a = "/gravity/solidity/artifacts/contracts/TestERC20A.sol/TestERC20A.json"
    const main_location_b = "/gravity/solidity/artifacts/contracts/TestERC20B.sol/TestERC20B.json"
    const main_location_c = "/gravity/solidity/artifacts/contracts/TestERC20C.sol/TestERC20C.json"
    const alt_location_1_a = "/solidity/TestERC20A.json"
    const alt_location_1_b = "/solidity/TestERC20B.json"
    const alt_location_1_c = "/solidity/TestERC20C.json"
    const alt_location_2_a = "TestERC20A.json"
    const alt_location_2_b = "TestERC20B.json"
    const alt_location_2_c = "TestERC20C.json"
    if (fs.existsSync(main_location_a)) {
      erc20_a_path = main_location_a
      erc20_b_path = main_location_b
      erc20_c_path = main_location_c
    } else if (fs.existsSync(alt_location_1_a)) {
      erc20_a_path = alt_location_1_a
      erc20_b_path = alt_location_1_b
      erc20_c_path = alt_location_1_c
    } else if (fs.existsSync(alt_location_2_a)) {
      erc20_a_path = alt_location_2_a
      erc20_b_path = alt_location_2_b
      erc20_c_path = alt_location_2_c
    } else {
      console.log("Test mode was enabled but the ERC20 contracts can't be found!")
      exit(1)
    }


    const { abi, bytecode } = getContractArtifacts(erc20_a_path);
    const erc20Factory = new ethers.ContractFactory(abi, bytecode, wallet);
    const testERC20 = (await erc20Factory.deploy(overrides)) as TestERC20A;
    await testERC20.deployed();
    const erc20TestAddress = testERC20.address;
    console.log("ERC20 deployed at Address - ", erc20TestAddress);
    const { abi: abi1, bytecode: bytecode1 } = getContractArtifacts(erc20_b_path);
    const erc20Factory1 = new ethers.ContractFactory(abi1, bytecode1, wallet);
    const testERC201 = (await erc20Factory1.deploy(overrides)) as TestERC20B;
    await testERC201.deployed();
    const erc20TestAddress1 = testERC201.address;
    console.log("ERC20 deployed at Address - ", erc20TestAddress1);
    const { abi: abi2, bytecode: bytecode2 } = getContractArtifacts(erc20_c_path);
    const erc20Factory2 = new ethers.ContractFactory(abi2, bytecode2, wallet);
    const testERC202 = (await erc20Factory2.deploy(overrides)) as TestERC20C;
    await testERC202.deployed();
    const erc20TestAddress2 = testERC202.address;
    console.log("ERC20 deployed at Address - ", erc20TestAddress2);


    const arbitrary_logic_path = "/gravity/solidity/artifacts/contracts/TestUniswapLiquidity.sol/TestUniswapLiquidity.json"
    if (fs.existsSync(arbitrary_logic_path)) { 
      const { abi, bytecode } = getContractArtifacts(arbitrary_logic_path);
      const liquidityFactory = new ethers.ContractFactory(abi, bytecode, wallet);
      const testUniswapLiquidity = (await liquidityFactory.deploy(erc20TestAddress)) as TestUniswapLiquidity;
      await testUniswapLiquidity.deployed();
      const testAddress = testUniswapLiquidity.address;
      console.log("Uniswap Liquidity test deployed at Address - ", testAddress);
    }
  }
  const gravityIdString = await getGravityId();
  const gravityId = ethers.utils.formatBytes32String(gravityIdString);

  console.log("Starting Gravity contract deploy");
  const { abi, bytecode } = getContractArtifacts(args["contract"]);
  const factory = new ethers.ContractFactory(abi, bytecode, wallet);

  console.log("About to get latest Gravity valset");
  const latestValset = await getLatestValset();

  let eth_addresses = [];
  let powers = [];
  let powers_sum = 0;
  // this MUST be sorted uniformly across all components of Gravity in this
  // case we perform the sorting in module/x/gravity/keeper/types.go to the
  // output of the endpoint should always be sorted correctly. If you're
  // having strange problems with updating the validator set you should go
  // look there.
  for (let i = 0; i < latestValset.members.length; i++) {
    if (latestValset.members[i].ethereum_address == null) {
      continue;
    }
    eth_addresses.push(latestValset.members[i].ethereum_address);
    powers.push(latestValset.members[i].power);
    powers_sum += latestValset.members[i].power;
  }

  // 66% of uint32_max
  let vote_power = 2834678415;
  if (powers_sum < vote_power) {
    console.log("Refusing to deploy! Incorrect power! Please inspect the validator set below")
    console.log("If less than 66% of the current voting power has unset Ethereum Addresses we refuse to deploy")
    console.log(latestValset)
    exit(1)
  }

  const gravity = (await factory.deploy(
    // todo generate this randomly at deployment time that way we can avoid
    // anything but intentional conflicts
    gravityId,
    vote_power,
    eth_addresses,
    powers,
    overrides
  )) as Gravity;

  await gravity.deployed();
  console.log("Gravity deployed at Address - ", gravity.address);
  await submitGravityAddress(gravity.address);
}

function getContractArtifacts(path: string): { bytecode: string; abi: string } {
  var { bytecode, abi } = JSON.parse(fs.readFileSync(path, "utf8").toString());
  return { bytecode, abi };
}
const decode = (str: string):string => Buffer.from(str, 'base64').toString('binary');

async function getLatestValset(): Promise<Valset> {
  let block_height_request_string = args["cosmos-node"] + '/status';
  let block_height_response = await axios.get(block_height_request_string);
  let info: StatusWrapper = await block_height_response.data;
  let block_height = info.result.sync_info.latest_block_height;
  if (info.result.sync_info.catching_up) {
    console.log("This node is still syncing! You can not deploy using this validator set!");
    exit(1);
  }
  let request_string = args["cosmos-node"] + "/abci_query"
  let response = await axios.get(request_string, {params: {
    path: "\"/custom/gravity/currentValset/\"",
    height: block_height,
    prove: "false",
  }});
  let valsets: ABCIWrapper = await response.data;
  console.log(decode(valsets.result.response.value));
  let valset: ValsetTypeWrapper = JSON.parse(decode(valsets.result.response.value))
  return valset.value;
}
async function getGravityId(): Promise<string> {
  let block_height_request_string = args["cosmos-node"] + '/status';
  let block_height_response = await axios.get(block_height_request_string);
  let info: StatusWrapper = await block_height_response.data;
  let block_height = info.result.sync_info.latest_block_height;
  if (info.result.sync_info.catching_up) {
    console.log("This node is still syncing! You can not deploy using this gravityID!");
    exit(1);
  }
  let request_string = args["cosmos-node"] + "/abci_query"
  let response = await axios.get(request_string, {params: {
    path: "\"/custom/gravity/gravityID/\"",
    height: block_height,
    prove: "false",
  }});
  let gravityIDABCIResponse: ABCIWrapper = await response.data;
  let gravityID: string = JSON.parse(decode(gravityIDABCIResponse.result.response.value))
  return gravityID;

}

async function submitGravityAddress(address: string) {}

async function main() {
  await deploy();
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main();
