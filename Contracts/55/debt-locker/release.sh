#!/usr/bin/env bash
set -e

version=$(cat ./package.yaml | grep "version: " | sed -r 's/.{9}//')
name=$(cat ./package.yaml | grep "name: " | sed -r 's/.{6}//')
customDescription=$(cat ./package.yaml | grep "customDescription: " | sed -r 's/.{19}//')

./build.sh -c ./config/prod.json

rm -rf ./package
mkdir -p package

echo "{
  \"name\": \"@maplelabs/${name}\",
  \"version\": \"${version}\",
  \"description\": \"${customDescription}\",
  \"author\": \"Maple Labs\",
  \"license\": \"AGPLv3\",
  \"repository\": {
    \"type\": \"git\",
    \"url\": \"https://github.com/maple-labs/${name}.git\"
  },
  \"bugs\": {
    \"url\": \"https://github.com/maple-labs/${name}/issues\"
  },
  \"homepage\": \"https://github.com/maple-labs/${name}\"
}" > package/package.json

mkdir -p package/artifacts
mkdir -p package/abis

paths=($(cat ./package.yaml | grep "  - path:" | sed -r 's/.{10}//'))
names=($(cat ./package.yaml | grep "    contractName:" | sed -r 's/.{18}//'))

for i in "${!paths[@]}"; do
  cat ./out/dapp.sol.json | jq ".contracts | .\"${paths[i]}\" | .${names[i]}" > package/artifacts/${names[i]}.json
  cat ./out/dapp.sol.json | jq ".contracts | .\"${paths[i]}\" | .${names[i]} | .abi" > package/abis/${names[i]}.json
done

npm publish ./package --access public

rm -rf ./package
