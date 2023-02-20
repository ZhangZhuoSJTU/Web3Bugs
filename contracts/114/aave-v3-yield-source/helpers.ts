import chalk from "chalk";

export const action = (message: string) => {
  if (!process.env.HIDE_DEPLOY_LOG) {
    return console.log(chalk.cyan(message));
  }
};

export const info = (message: string) => {
  if (!process.env.HIDE_DEPLOY_LOG) {
    return console.log(chalk.dim(message));
  }
};

export const success = (message: string) => {
  if (!process.env.HIDE_DEPLOY_LOG) {
    return console.log(chalk.green(message));
  }
};

export const warning = (message: string) => {
  if (!process.env.HIDE_DEPLOY_LOG) {
    return console.log(chalk.yellow(message));
  }
};

export const error = (message: string) => {
  if (!process.env.HIDE_DEPLOY_LOG) {
    return console.log(chalk.red(message));
  }
};
