# prepo-react-boilerplate

## What is this?

This is a Web3 frontend react boilerplate.

Things that are implemented

- [x] Wallet connect
- [x] Some get started Components and Theme in place
- [x] Tests
- [x] Development tools
- [x] State management library
- [x] GraphQL Tooling

## How it was built

The boilerplate is built with the following stack:

- React using [NextJS](https://nextjs.org/) as framework together with Typescript.
- State management using [mobx](https://mobx.js.org/)
- GraphQL (and The Graph) integration with [mst-gql](https://github.com/mobxjs/mst-gql)
- Web3 read/write with [custom mobx stores](https://github.com/prepo-io/prepo-packages/tree/master/packages/stores)
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

Read more about the [Definition of Components](#defcomponents)

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

## SEO configuration

Uses `next-sitemap` package to generate `sitemap.xml` and `robots.txt`
Can be configured by updating the `next-sitemap.js` file. Update the `SITE_URL` in the `.env` file before building for production.
Read more on the package [here](https://github.com/iamvishnusankar/next-sitemap).

## <a id="defcomponents"></a>Definition of components

All the custom components inside our `/components` folder should be seen as our component library API. We will use and re-use these components to build features or to build new components. It is important to ask yourself the question:
`Will we re-use this component in any other place or application?`
If the answer is yes, then this component should definitely be inside the `/components` folder.

With that said, that a component can be:

- Non divisible. This means, that the component can be the smallest unit of itself. Example: a Button
- A combination of two or more. You might require two components to build one. Usually mixing a Label component together with an Input field for example.

`/components/layout` folder should contain all different layouts that can be on the application and things related to it. Example: Header, Footer. These ones could potentially be re-used across other applications which is why they can remain in the components folder as well.

## Using GraphQL

We use [mst-gql](https://github.com/mobxjs/mst-gql) to manage GraphQL queries & state.

### Setting up a new model

1. Write a `.graphql` schema for the model to the `graphql/` directory ([get-graphql-schema](https://github.com/prisma-labs/get-graphql-schema))

2. Add a line to `internals/mst-gql-generate.bash` to generate the scaffold based on the schema

3. Create an `...GraphStore.ts` file in `stores/`, and add it to the RootStore. See `stores/UniswapV3GraphStore.ts` for an example.

### Defining a query

Define a query using `gql` and [auto-generated `selectFromXXX()` query builders](https://github.com/mobxjs/mst-gql#models).

Define the return type for the query using the [auto-generated `xxxModelType`](https://github.com/mobxjs/mst-gql#models) types.

### Calling a query

Call `this.graph.query(query, { fetchPolicy: ... })` in the Adaptor to execute the query.

### Caching

`mst-gql` caches the results made to `.query` internally. Cache mechanisms can be selected by setting the `fetchPolicy` option when calling `.query()`. Avaliable fetch policies can be reviewed [here](https://github.com/mobxjs/mst-gql#query-caching).

The default fetch policy `cache-and-network` is not always desirable as it can result in redundent refetches, so devs may consider using the `cache-first` policy instead and manually refetching data (e.g. every new block) by calling the `.refetch()` method on a query.

### Examples

An example of using the Uniswap V3 subgraph is implemented in this boilerplate which demonstrates

- Defining an Adaptor that keeps an `mst-gql` store for the currently selected network
- Defining a custom query that
  - Uses auto-generated querybuilders
  - Uses auto-generated return types
  - Uses state from the Web3Store
  - Refetches state on every new block
- Displays GraphQL state in a component
