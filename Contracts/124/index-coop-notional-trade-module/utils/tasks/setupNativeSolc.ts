import { execSync } from "child_process";

let isFirstRun = true;

// @ts-ignore
export async function setupNativeSolc({ input }, { config }, runSuper) {
  let solcVersionOutput = "";
  try {
    solcVersionOutput = execSync("solc --version").toString();
  } catch (error) {
    // Probably failed because solc wasn"t installed. We do nothing here.
  }

  isFirstRun && console.log("Local native solc version: ", solcVersionOutput);

  if (!solcVersionOutput.includes(config.solidity.version)) {
    isFirstRun && console.log("Using solcjs");
    isFirstRun = false;
    return runSuper();
  }

  isFirstRun && console.log("Using native solc");
  isFirstRun = false;

  const output = execSync("solc --standard-json", {
    input: JSON.stringify(input, undefined, 2),
  });

  return JSON.parse(output.toString("utf8"));
}
