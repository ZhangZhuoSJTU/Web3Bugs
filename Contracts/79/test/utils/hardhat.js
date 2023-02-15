const HARDHAT_FORK_CURRENT_PARAMS = [
  {
    forking: {
      jsonRpcUrl: "https://api.avax.network/ext/bc/C/rpc",
    },
    live: false,
    saveDeployments: true,
    tags: ["test", "local"],
  },
];

module.exports = {
  HARDHAT_FORK_CURRENT_PARAMS,
};
