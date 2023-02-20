module.exports = {
  env: {
    browser: false,
    es2021: true,
    mocha: true,
    node: true,
  },
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: ['./node_modules/eslint-config-google/index.js'],
  parserOptions: {
    ecmaVersion: 8,
    sourceType: 'module',
  },
  rules: {
    'max-len': 'off',
    'require-jsdoc': 'off',
    'camelcase': 'off',
    'new-cap': ['error', {capIsNew: false}],
  },
};
