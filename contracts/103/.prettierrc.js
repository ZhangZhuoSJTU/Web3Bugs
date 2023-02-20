module.exports = {
  singleQuote: true,
  bracketSpacing: true,
  semi: false,
  overrides: [
    {
      files: '*.sol',
      options: {
        printWidth: 120,
        tabWidth: 4,
        singleQuote: false,
        explicitTypes: 'always',
      },
    },
  ],
}
