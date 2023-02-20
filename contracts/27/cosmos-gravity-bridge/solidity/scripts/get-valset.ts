import commandLineArgs from "command-line-args";
import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from "axios";

const args = commandLineArgs([
  // the bloc to get the height at
  { name: "block", type: Number },
  // the cosmos node that will be used to grab the validator set via RPC
  { name: "cosmos-node", type: String },
]);


type ValsetTypeWrapper = {
  type: string;
  value: Valset;
};
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
};
type ABCIResult = {
  code: number
  log: string,
  info: string,
  index: string,
  value: string,
  height: string,
  codespace: string,
};
type Validator = {
  power: number;
  ethereum_address: string;
};

const decode = (str: string):string => Buffer.from(str, 'base64').toString('binary');

async function getValset(): Promise<Valset> {
  console.log("Starting")
  let request_string = args["cosmos-node"] + "/abci_query"
  let response = await axios.get(request_string, {params: {
    path: "\"/custom/gravity/currentValset/\"",
    height: args["block"],
    prove: "false",
  }});
  let valsets: ABCIWrapper = await response.data;
  console.log(valsets)
  console.log(decode(valsets.result.response.value));
  let valset: ValsetTypeWrapper = JSON.parse(decode(valsets.result.response.value))
  return valset.value;
}


async function main() {
  await getValset();
}

main();
