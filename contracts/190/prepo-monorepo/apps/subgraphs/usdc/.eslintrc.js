module.exports = {
  ...require('config/eslint-server'),
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: './tsconfig.json',
  },
  rules: {
    ...require('config/eslint-server').rules,
    '@typescript-eslint/no-unused-expressions': 'off',
    // wasm assembly doesn't support these
    '@typescript-eslint/no-inferrable-types': 'off',
    'prefer-destructuring': 'off',
    'prefer-exponentiation-operator': 'off',
    'no-param-reassign': 'off',
    eqeqeq: 'off',
  },
  // Removes the jest configuration since we are using chai here
  overrides: [],
}
