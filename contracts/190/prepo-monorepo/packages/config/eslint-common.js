module.exports = {
  plugins: ['@typescript-eslint', 'import'],
  settings: {
    next: {
      rootDir: ['apps/*/', 'packages/*/'],
    },
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,
        project: ['apps/*/tsconfig.json'],
      },
    },
  },
  rules: {
    // Include .prettierrc.js rules
    'prettier/prettier': ['error', {}, { usePrettierrc: true }],

    // Common
    'arrow-body-style': ['error', 'as-needed'],
    'lines-between-class-members': 'off',
    'import/no-cycle': 'off',
    'import/no-extraneous-dependencies': 'off',

    'import/extensions': 'off',
    'import/order': [
      'error',
      { groups: ['external', 'index', 'sibling', 'parent', 'internal', 'builtin', 'object'] },
    ],
    'no-plusplus': ['error', { allowForLoopAfterthoughts: true }],
    'no-underscore-dangle': 'off',
    camelcase: 'off',
    'no-shadow': 'off',
    'lines-between-class-members': 'off',
    'no-restricted-properties': 'off',
    'require-await': ['error'],

    // Typescript
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/explicit-function-return-type': 'error',
    '@typescript-eslint/no-shadow': ['error'],
    '@typescript-eslint/lines-between-class-members': 'off',
    'import/prefer-default-export': 'off',
  },
  overrides: [
    {
      // We enable eslint-plugin-testing-library rules or preset only for matching files!
      env: {
        jest: true,
      },
      files: ['**/__tests__/**/*.[jt]s?(x)', '**/?(*.)+(spec|test).[jt]s?(x)'],
      extends: ['plugin:testing-library/react', 'plugin:jest/recommended'],
      rules: {
        'import/no-extraneous-dependencies': [
          'off',
          { devDependencies: ['**/?(*.)+(spec|test).[jt]s?(x)'] },
        ],
      },
    },
  ],
  ignorePatterns: [
    '**/*.js',
    '**/*.json',
    'node_modules',
    'public',
    'styles',
    '.next',
    'coverage',
    'dist',
    '.turbo',
  ],
}
