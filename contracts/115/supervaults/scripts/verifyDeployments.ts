import { run, network } from "hardhat";
import { readdirSync, readFileSync } from "fs";

const verifyContracts = async () => {
  const dir = readdirSync(`deployments/${network.name === "hardhat" ? "localgost" : network.name}`);

  for (const file of dir) {
    if (file.includes(".json")) {
      const contract = JSON.parse(
        readFileSync(`deployments/${network.name === "hardhat" ? "localgost" : network.name}/${file}`).toString(),
      );
      try {
        await run("verify:verify", {
          address: contract.address,
          constructorArguments: contract.args,
          contract: contract.storageLayout.storage[0].contract,
        });
      } catch (error) {
        console.log(error);
      }
    }
  }
};

verifyContracts();
