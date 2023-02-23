module.exports = {
  ...require('config/eslint-frontend'),
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: './tsconfig.json',
  },
}
