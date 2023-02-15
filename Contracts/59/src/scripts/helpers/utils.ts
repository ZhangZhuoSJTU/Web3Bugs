import { run, ethers } from "hardhat";

const salt = 2021;

const provider = ethers.getDefaultProvider();

let create2DeployerAddress = "0x54F5A04417E29FF5D7141a6d33cb286F50d5d50e";

export function buildCreate2Address(creatorAddress: string, saltHex: string, byteCode: string) {
  return `0x${ethers.utils
    .keccak256(
      `0x${["ff", creatorAddress, saltHex, ethers.utils.keccak256(byteCode)]
        .map(x => x.replace(/0x/, ""))
        .join("")}`
    )
    .slice(-40)}`.toLowerCase();
}

// encodes parameter to pass as contract argument
export function encodeParam(dataType: string[], data: any) {
  const abiCoder = ethers.utils.defaultAbiCoder;
  return abiCoder.encode(dataType, data);
}

// returns true if contract is deployed on-chain
export async function isContract(address: string) {
  const code = await provider.getCode(address);
  return code.slice(2).length > 0;
}

// converts an int to uint256
export function numberToUint256(value: number) {
  const hex = value.toString(16);
  return `0x${"0".repeat(64 - hex.length)}${hex}`;
}

export async function checkCode(bytecode: string) {
  const computedAddr = buildCreate2Address(
    create2DeployerAddress,
    numberToUint256(salt),
    bytecode
  );
  return await isContract(computedAddr);
}

export async function deterministicDeploy(contract: any, constructorTypes: string[] = [], constructorArgs: string[] = [], create2Address?: string) {
  if (!create2Address) {
    create2Address = create2DeployerAddress;
  }

  const constructorData = encodeParam(
    constructorTypes,
    constructorArgs
  ).slice(2);

  const bytecode = `${contract.bytecode}${constructorData}`;
  // First see if already deployed
  const computedAddr = buildCreate2Address(
    create2Address,
    numberToUint256(salt),
    bytecode
  );

  const isDeployed = await isContract(computedAddr);
  let deployment;
  if (!isDeployed) {
    const create2Deployer = await ethers.getContractAt("Create2Deployer", create2Address);
    deployment = await create2Deployer.deploy(bytecode, salt);
    await deployment.wait();
  }

  if (process.env.VERIFY_CONTRACTS === 'true') {
    try {
      await run("verify:verify", {
        address: computedAddr,
        constructorArguments: constructorArgs,
      });
    } catch (e) {
      console.log(`Could not verify ${computedAddr} with ${constructorArgs}`);
    }
  }

  return {
    contract: new ethers.Contract(computedAddr, contract.interface.format(), contract.signer),
    deployment,
  }
}
