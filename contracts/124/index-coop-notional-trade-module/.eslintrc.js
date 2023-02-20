module.exports = {
  "env": {
    "browser": true,
    "node": true
  },
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "project": "tsconfig.json",
    "sourceType": "module"
  },
  "plugins": [
    "eslint-plugin-no-null",
    "eslint-plugin-jsdoc",
    "@typescript-eslint",
    "@typescript-eslint/tslint"
  ],
  "rules": {
    "@typescript-eslint/indent": [
      "error",
      2
    ],
    "@typescript-eslint/member-delimiter-style": [
      "error",
      {
        "multiline": {
          "delimiter": "semi",
          "requireLast": true
        },
        "singleline": {
          "delimiter": "semi",
          "requireLast": false
        }
      }
    ],
    "@typescript-eslint/prefer-namespace-keyword": "error",
    "@typescript-eslint/quotes": [
      "error",
      "double",
      {
        "avoidEscape": true
      }
    ],
    "@typescript-eslint/semi": [
      "error",
      "always"
    ],
    "@typescript-eslint/type-annotation-spacing": "error",
    "arrow-parens": [
      "error",
      "as-needed"
    ],
    "brace-style": [
      "error",
      "1tbs"
    ],
    "comma-dangle": [
      "error",
      {
        "objects": "only-multiline",
        "arrays": "only-multiline",
        "imports": "only-multiline",
        "exports": "only-multiline",
        "functions": "only-multiline"
      }
    ],
    "jsdoc/check-alignment": "error",
    "jsdoc/check-indentation": "error",
    "jsdoc/newline-after-description": "error",
    "max-len": [
      "error",
      {
        "code": 150
      }
    ],
    "no-null/no-null": "error",
    "no-trailing-spaces": "error",
    "no-unused-vars": "error",
    "no-var": "error",
    "prefer-const": "error",
    "quotes": "error",
    "semi": "error",
    "spaced-comment": [
      "error",
      "always",
      {
        "markers": [
          "/"
        ]
      }
    ],
  }
};
