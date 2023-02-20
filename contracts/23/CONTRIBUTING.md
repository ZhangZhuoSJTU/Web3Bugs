# Contributing to Notional

:+1: Thanks for taking interest in Notional! Your contribution (big or small) will help build an open financial system for all. It's a massive undertaking and we're glad you're a part of it. :fire:

#### Table of Contents

[Code of Conduct](#code-of-conduct)

[What should I know before I get started?](#what-should-i-know-before-i-get-started)

- [Development Environment](#development-environment)
- [Design Decisions](#design-decisions)

[How Can I Contribute?](#how-can-i-contribute)

- [Reporting Bugs and Vulnerabilities](#reporting-bugs)
- [Participate in Governance](#participate-in-governance)
- [Suggesting Enhancements](#suggesting-enhancements)

[Styleguides](#styleguides)

- [Solidity Styleguide](#solidity-styleguide)
- [Python Styleguide](#python-styleguide)
- [Documentation Styleguide](#documentation-styleguide)

## Code of Conduct

This project and everyone participating in it is governed by the [Notional Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to [support@notional.finance](mailto:support@notional.finance).


## How Can I Contribute?

### Report Bugs

Critical security issues should be reported privately to security@notional.finance or via Immunefi. In both cases they will be eligible for our bug bounty program. Gas optimizations or feature enhancements can be reported via Github issues.

### Improve Test Coverage and Documentation

Writing additional unit tests or helping improve documentation is a great way to get started in any open source project. Feel free to reach out in the "Development" channel on [Discord](https://discord.notional.finance) if you want help getting started.

### Participate in Governance

Notional V2 requires sophisticated and involved governors. If you're interested in contributing, consider participating in governance in the [Notional V2 forum](https://forum.notional.finance).

## Styleguides

### Solidity Styleguide

All Solidity code is formatted using [Prettier](https://prettier.io/) and [Prettier Plugin Solidity](https://github.com/prettier-solidity/prettier-plugin-solidity)

- Deployable system contracts are **only** allowed in the `contracts/external` folder.
- All other contracts **must** be non-deployable library contracts.
- Shared structs **must** be declared in the `global/Types.sol` file.
- Internal constants **must** be declared in the `global/Constants.sol` file.
- Natspec docstrings **must** use the `///` comment format.
- All `external` and `public` methods **must** have natspec docstrings.
- All methods **should** have at least a `@dev` docstring.
- Private methods **should** be declared near the methods that they are related to.
- Private methods **must** be prefixed with an underscore.

### Documentation Styleguide

TODO
