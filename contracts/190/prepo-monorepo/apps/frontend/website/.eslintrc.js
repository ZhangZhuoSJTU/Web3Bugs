module.exports = {
  ...require('config/eslint-frontend'),
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: './tsconfig.json',
  },
  rules: {
    ...require('config/eslint-frontend').rules,
    // disabled until they support the specific value pattern ex : text-color-opacity-[63%]
    'tailwindcss/no-custom-classname': 'off',
  },
}
