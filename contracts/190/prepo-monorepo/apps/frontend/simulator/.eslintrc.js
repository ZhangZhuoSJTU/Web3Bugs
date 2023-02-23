module.exports = {
  ...require('config/eslint-frontend'),
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: './tsconfig.json',
  },
  rules: {
    ...require('config/eslint-frontend').rules,
    'no-param-reassign': 'off',
  },
  settings: {
    ...require('config/eslint-frontend').settings,
    'import/resolver': {
      node: {
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
      },
    },
  },
}
