# prePO Core dApp Frontend

[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-yellow.svg)](https://conventionalcommits.org)

## What is this?

Frontend of the Core dApp of prePO

## How it was built

The project is built with the following stack:

- React using [NextJS](https://nextjs.org/) as framework together with Typescript.
- State management. [MobX](https://mobx.js.org/).
- [Ant Design](https://ant.design/) for the components.
- [Jest](https://jestjs.io/) for writing and running unitests.
- [Typechain](https://github.com/ethereum-ts/TypeChain), [prettier](https://github.com/prettier/prettier), [eslint](https://eslint.org/), [husky](https://github.com/typicode/husky) and [conventional commits](https://www.conventionalcommits.org/en/v1.0.0/) for improving development experience and maintaining code quality.

## Installation

```bash
$ yarn
```

## Running the app

Please have a look at .env.sample to get started

```bash
# development
$ yarn dev

# production mode
$ yarn start
```

## Building the app (static HTML files)

```bash
# build
$ yarn build
```

This command will generate a folder `out` which will include all the static HTML files. That folder is the one that should be deployed to hosting provider.

## Test

```bash
# unit tests
$ yarn test
```

## Folder structure guideliness

```
/abi
/components
/lib
/features
/hooks
/pages
/types
/utils
```

### /abi

Contains all the abis that will be used for the project

### /components

- All the components that will be re-usable across the application to build features
- The components should have export default
- Example of components: Buttons, Inputs, Icons.
- If the component is a composition of more than 1 components, then the folder structure should be:

```
/ComponentName
    ComponentPart1.tsx
    ComponentPart2.tsx
    index.tsx // Exports the ComponentName
```

### /lib

- Constants and configuration files for the application

### /features

- Feature folders should be lowercase
- Features should be as encapsulated as possible. The way of thinking is that everything needed for that function to work, should live inside that folder. Then it makes it very easy to get read of a whole function and clean code in the future.
- Sometimes a feature shares utility functions across other features. In that case, those utility functions should live on the global `/utils` folder.
- A feature example folder structure should look like

```
/features
    /connect-wallet
        ConnectWalletButton.tsx
        ConnectWalletProvider.tsx
        /utils
            connect-wallet-utils.ts
```

### /hooks

- All the re-usable hooks across the application

### /pages

- NextJS default structure for exporting new pages in the application

### /types

- Auto generated types
- Typechain factories, etc.

### /utils

- All the re-usable utilities that can be shared across more than one feature or component
- The utility functions should include the following nomenclature `{util-name}-utils.ts`
- Depending of the complexity of the utility function, tests should be added under `/utils/__tests__/`

## Tests

- The tests will be located inside their scope. Example:

```
/utils
    account-utils.ts
    another-utils.ts
    /__tests__
        account-utils.test.ts
        another-utils.test.ts

```
