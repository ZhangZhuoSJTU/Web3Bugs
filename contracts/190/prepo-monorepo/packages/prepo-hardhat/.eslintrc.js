module.exports = {
  ...require('config/eslint-server'),
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: './tsconfig.json',
  },
  rules: {
    ...require('config/eslint-server').rules,
    'import/no-extraneous-dependencies': 'off',
  },
}
