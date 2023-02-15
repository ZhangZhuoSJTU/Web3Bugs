import chalk from 'chalk';
import { HardhatRuntimeEnvironment, Network } from 'hardhat/types';

const displayLogs = !process.env.HIDE_DEPLOY_LOG;

export const action = (message: string) => {
  if (displayLogs) {
    console.log(chalk.cyan(message));
  }
};

export const alert = (message: string) => {
  if (displayLogs) {
    console.log(chalk.yellow(message));
  }
};

export const info = (message: string) => {
  if (displayLogs) {
    console.log(chalk.dim(message));
  }
};

export const success = (message: string) => {
  if (displayLogs) {
    console.log(chalk.green(message));
  }
};

export const increaseTime = async (hre: HardhatRuntimeEnvironment, time: number) => {
  let provider = hre.ethers.provider;
  await provider.send('evm_increaseTime', [time]);
  await provider.send('evm_mine', []);
};

export const isTestEnvironment = (network: Network) =>
  network?.config ? network.config?.tags?.[0] === 'test' : network?.tags?.test;
