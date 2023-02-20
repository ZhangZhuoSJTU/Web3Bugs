module.exports = {
  ...require("@sushiswap/prettier-config"),
  // TODO: If a non-default solidity config is needed, we could add this to our
  // config repo and import as @sushiswap/prettier-config/solidity. Also, feel
  // free to add to the default config which is required above.
  overrides: [
    {
      files: "*.sol",
      options: {
        printWidth: 140,
        tabWidth: 4,
        singleQuote: false,
        bracketSpacing: false,
        explicitTypes: "always",
      },
    },
    {
      files: "*.ts",
      options: {
        printWidth: 140
      }
    }
  ],
};
