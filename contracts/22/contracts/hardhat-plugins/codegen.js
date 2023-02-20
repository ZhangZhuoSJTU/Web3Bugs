const fs = require('fs');
const path = require('path');
const { extendConfig } = require('hardhat/config');

const { HardhatPluginError } = require('hardhat/plugins');

const {
  TASK_COMPILE_SOLIDITY_RUN_SOLCJS,
  TASK_COMPILE_SOLIDITY_RUN_SOLC
} = require('hardhat/builtin-tasks/task-names');

extendConfig(function (config, userConfig) {
  config.codeGen = Object.assign(
    {
      ast: {
        path: './ast',
        spacing: 2,
        files: [
          {
            contractName: "LongShort",
            fullPath: "contracts/LongShort.sol"
          },
          {
            contractName: "Staker",
            fullPath: "contracts/Staker.sol"
          }
        ],
      }
      // filesToGenerateMocksFor: [], //TODO
    },
    userConfig.codeGen
  );
});


const handleCompilation = async function (args, hre, runSuper) {
  const compileResult = await runSuper();

  const config = hre.config.codeGen;
  const astConfig = config.ast;

  const outputDirectory = path.resolve(hre.config.paths.root, astConfig.path);

  if (!outputDirectory.startsWith(hre.config.paths.root)) {
    throw new HardhatPluginError('resolved path must be inside of project directory');
  }

  if (outputDirectory === hre.config.paths.root) {
    throw new HardhatPluginError('resolved path must not be root directory');
  }

  if (!fs.existsSync(outputDirectory)) {
    fs.mkdirSync(outputDirectory, { recursive: true });
  }

  astConfig.files.map((fileToPrintAst) => {
    const result = compileResult.sources[fileToPrintAst.fullPath]

    if (!result) {
      console.log(`AvailableFiles: \n${Object.keys(compileResult.sources).join("\n")}`);
      return
      // throw new HardhatPluginError(`Could not find a contract with the name ${fileToPrintAst.contractName} at ${fileToPrintAst.fullPath} - please check your config carefully. \n\nAvailableFiles: \n${Object.keys(compileResult.sources).join("\n")}`);
    }

    const destination = path.resolve(
      outputDirectory,
      fileToPrintAst.contractName
    ) + '.json';

    if (!fs.existsSync(path.dirname(destination))) {
      fs.mkdirSync(path.dirname(destination), { recursive: true });
    }

    fs.writeFileSync(destination, `${JSON.stringify(result.ast, null, astConfig.spacing)}\n`, { flag: 'w' });
  })

  return compileResult;
}

task(TASK_COMPILE_SOLIDITY_RUN_SOLCJS, handleCompilation)
task(TASK_COMPILE_SOLIDITY_RUN_SOLC, handleCompilation)
