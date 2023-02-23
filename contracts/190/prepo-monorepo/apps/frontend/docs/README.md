# prepo-docs

This website is built using [Docusaurus 2](https://docusaurus.io/), a modern static website generator.

## Installation

```
$ yarn
```

## Local Development

```
$ yarn start
```

This command starts a local development server and opens up a browser window. Most changes are reflected live without having to restart the server.

[Introduction to writing docs with Docusaurus](https://docusaurus.io/docs/docs-introduction)

## How to generate markdown files from Solidity Natspec comments

1. Install `solidity-docgen` in the project you would like to generate documentation for `yarn add solidity-docgen`

2. Install the correct compiler version for your contracts, e.g. `yarn add solc-0.8@npm:solc@0.8.7-fixed`

3. Put `contract.hbs` in a `/templates` directory under the same directory as `/contracts` you want to generate

4. Run `npx solidity-docgen --solc-module solc-0.8 -t ./templates`

Solidity docs can be generated with the command `npx solidity-docgen --solc-module solc-0.8 -i /path/to/contracts -t ./templates -o /output/path`.

## Build

```
$ yarn build
```

This command generates static content into the `build` directory and can be served using any static contents hosting service.
