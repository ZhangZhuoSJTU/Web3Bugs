eth-mutants
===========

eth-mutants is a mutation testing tool for Solidity contracts.

## Installation

```
npm install eth-mutants
```

## Usage

```
The `preflight` command will show the number of possible mutations found
and print some compact diffs for each mutation. Use this to understand
how long it may take to visit all mutations and please report any invalid 
ones.
```

The `test` command will start applying mutations and running your tests to
check if they pass. It will report the result of each mutation.

```
eth-mutants test
```

This tools makes some important assumptions about your workspace, which should
hold true for most Truffle-based projects, but I plan on adding options to
override them soon:

 * Your contract files are in the `contracts/` directory
 * You run your tests with `npm test` which returns a non-zero error code in
   case of failure.

## Mutators

The only mutation implemented at the moment is called `boundary-condition`
and replaces `<` adn `>` for `<=` and `>=` and vice-versa. Contributions for
mutators are especially welcomed.

## Author

Federico Bond

## LICENSE

MIT
