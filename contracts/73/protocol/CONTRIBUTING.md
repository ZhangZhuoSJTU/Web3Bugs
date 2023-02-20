# Contributing to the Livepeer Protocol

## Style Guidelines

We use [Solium](https://github.com/duaraghav8/Solium) to enforce Solidity coding conventions and [ESLint](https://eslint.org/) to enforce Javascript coding conventions.
Below are a few style guidelines to be used when contributing to the Livepeer Protocol.

#### Solidity

##### Explicit Function Visibility Specifiers

Always define an explicit visibility specifier for all functions. Public functions should have
an explicit `public` visibility specifier even though functions currently default to `public` if
an explicit visibility specifier is not provided. This guideline might change in the future if the
Solidity compiler is updated such that functions default to either `internal` or `private` if an explicit visibility
specifier is not provided.

##### Public Vs. External Function Visibility Specifier

Prefer `external` to `public` if you know a function will only be called externally. If there is a possibility
of a function being called internally as well as externally, the function should be `public`. `external` functions can be more
efficient when a function parameter is a large array of data.
