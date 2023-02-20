import fs from "fs-extra";

import {
  TASK_COMPILE_SOLIDITY_GET_ARTIFACT_FROM_COMPILATION_OUTPUT,
} from "hardhat/builtin-tasks/task-names";

import { TASK_TYPECHAIN_GENERATE_TYPES } from "@typechain/hardhat/dist/constants";

import { subtask } from "hardhat/config";
import { addGasToAbiMethods, removeGasFromAbiMethods } from "../utils/tasks";

// Injects network block limit (minus 1 million) in the abi so
// ethers uses it instead of running gas estimation.
subtask(TASK_COMPILE_SOLIDITY_GET_ARTIFACT_FROM_COMPILATION_OUTPUT)
  .setAction(async (_, { network }, runSuper) => {
    const artifact = await runSuper();

    // These changes should be skipped when publishing to npm.
    // They override ethers' gas  estimation
    if (!process.env.SKIP_ABI_GAS_MODS) {
      artifact.abi = addGasToAbiMethods(network.config, artifact.abi);
    }

    return artifact;
  }
  );

// Hooks into the typechain task to inject hardcoded gas into external ABIs (and run them fast)
// ABIs picked up by this task need their location listed in the externalGasMods array
// in `hardhat.config.json`. Temporarily rewrites artifact so typechain picks up the network
// specific gas requirement without introducing any git changes.
subtask(TASK_TYPECHAIN_GENERATE_TYPES)
  .setAction(async (_, env, runSuper) => {
    const artifacts: any[] = [];

    for (const project of (env.config as any).externalGasMods) {
      const files = fs.readdirSync(project);

      for (const file of files) {
        const artifactPath = `${process.cwd()}/${project}/${file}`;
        const artifact = require(artifactPath);

        artifact.abi = addGasToAbiMethods(env.network.config, artifact.abi);
        fs.outputFileSync(artifactPath, JSON.stringify(artifact, undefined, "  "));
        artifacts.push({artifact, artifactPath});
      }
    }

    await runSuper();

    for (const item of artifacts) {
      item.artifact.abi = removeGasFromAbiMethods(item.artifact.abi);
      fs.outputFileSync(item.artifactPath, JSON.stringify(item.artifact, undefined, "  "));
    }
  }
  );

export {};
