module.exports = {
  env: {
    node: true,
  },
  extends: [
    'eslint:recommended',
    'airbnb-base',
    'airbnb-typescript/base',
    'plugin:import/errors',
    'plugin:import/warnings',
    'plugin:@typescript-eslint/recommended',
    'plugin:import/typescript',
    'plugin:import/recommended',
    'plugin:prettier/recommended',
  ],
  plugins: [...require('./eslint-common').plugins],
  parserOptions: {
    project: ['./tsconfig.json'],
  },
  settings: {
    ...require('./eslint-common').settings,
    'import/parsers': {
      '@typescript-eslint/parser': ['.ts'],
    },
  },
  rules: {
    ...require('./eslint-common').rules,
  },
  overrides: require('./eslint-common').overrides,
  ignorePatterns: require('./eslint-common').ignorePatterns,
}
