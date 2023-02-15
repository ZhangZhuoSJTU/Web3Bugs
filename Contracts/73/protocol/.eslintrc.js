module.exports = {
    "parser": "@typescript-eslint/parser",
    "plugins": [
        "@typescript-eslint"
    ],
    "extends": [
        "./node_modules/eslint-config-google/index.js"
    ],
    "parserOptions": {
        "ecmaVersion": 8,
        "sourceType": "module"
    },
    "rules": {
        "arrow-parens": ["error", "as-needed"],
        "max-len": "off",
        "new-cap": ["error", {"capIsNew": false}],
        "require-jsdoc": "off",
        "semi": ["error", "never"],
        "quotes": ["error", "double"],
        "comma-dangle": ["error", "never"],
        "indent": ["error", 4],
        "space-infix-ops": ["error"],
        "camelcase": "off"
    }
}
