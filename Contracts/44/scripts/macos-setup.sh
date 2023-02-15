#!/bin/bash
set -e

echo "Installing node..."
brew list node@12 &>/dev/null || brew install node@12

echo "Installing yarn..."
npm i -g yarn

echo "Installing precommit requirements..."
brew list pre-commit &>/dev/null || brew install pre-commit

echo "Installing pre-commit hooks..."
pre-commit install --install-hooks

echo "Installing dependencies..."
yarn install

echo "Ready to rock! See above for any extra environment-related instructions."
echo "You can now run yarn build, yarn lint, or yarn test."
