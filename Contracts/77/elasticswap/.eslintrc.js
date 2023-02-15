module.exports = {
  env: {
    browser: true,
    es6: true,
    mocha: true,
  },
  extends: ["airbnb-base", "plugin:mocha/recommended", "prettier"],
  globals: {
    Atomics: "readonly",
    SharedArrayBuffer: "readonly",
  },
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: "module",
  },
  plugins: ["mocha", "prettier"],
  rules: {
    "mocha/no-mocha-arrows": 0,
    "no-console": 0,
    "no-underscore-dangle": 0,
    "no-use-before-define": "warn",
    "no-undef": "warn",
    "object-curly-newline": 0,
    "quotes": [2, "double"],
    "operator-linebreak" : 0,
    "prettier/prettier": ["error"]
  },
};
