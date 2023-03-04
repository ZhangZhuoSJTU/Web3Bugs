# Demystifying Exploitable Bugs in Smart Contracts

[![integrity validation](https://github.com/ZhangZhuoSJTU/Web3Bugs/actions/workflows/validate.yml/badge.svg)](https://github.com/ZhangZhuoSJTU/Web3Bugs/actions/workflows/validate.yml)

<p>
<a href="papers/icse23.pdf"> <img title="" src="resources/paper.jpg" alt="loading-ag-167" align="right" width="200"></a>

This project aims to provide a valuable resource for Web3 developers and security analysts by facilitating their understanding of exploitable bugs in smart contracts. We conduct a thorough analysis of exploitable bugs extracted from [code4rena](https://code4rena.com/) and classify each bug according to its nature.

Our initial research suggests that a notable proportion of exploitable bugs in smart contracts are functional bugs, which cannot be detected using simple and general oracles like reentrancy. We aim to raise awareness about the significance of such bugs and encourage practitioners to develop more sophisticated and nuanced automatic semantical oracles to detect them.
</p>

<br>

> 𝙰 𝚜𝚒𝚐𝚗𝚒𝚏𝚒𝚌𝚊𝚗𝚝 𝚗𝚞𝚖𝚋𝚎𝚛 𝚘𝚏 𝚎𝚡𝚙𝚕𝚘𝚒𝚝𝚊𝚋𝚕𝚎 𝚋𝚞𝚐𝚜 𝚒𝚗 𝚜𝚖𝚊𝚛𝚝 𝚌𝚘𝚗𝚝𝚛𝚊𝚌𝚝𝚜 𝚏𝚊𝚕𝚕 𝚞𝚗𝚍𝚎𝚛 𝚝𝚑𝚎 𝚌𝚊𝚝𝚎𝚐𝚘𝚛𝚢 𝚘𝚏 𝚏𝚞𝚗𝚌𝚝𝚒𝚘𝚗𝚊𝚕 𝚋𝚞𝚐𝚜, 𝚠𝚑𝚒𝚌𝚑 𝚌𝚊𝚗𝚗𝚘𝚝 𝚋𝚎 𝚍𝚎𝚝𝚎𝚌𝚝𝚎𝚍 𝚞𝚜𝚒𝚗𝚐 𝚜𝚒𝚖𝚙𝚕𝚎 𝚊𝚗𝚍 𝚐𝚎𝚗𝚎𝚛𝚊𝚕 𝚘𝚛𝚊𝚌𝚕𝚎𝚜.

<br>

Please be aware that __this repository is currently undergoing active development, and the data may change over time due to ongoing code4rena contests__.

## Dataset Description

### Folder Structure

The dataset is organized into four folders:

+ [papers/](papers/): contains our ICSE23 paper summarizing our preliminary results, as well as the supplementary material for the paper.
+ [results/](results/): contains the bug classification in [bugs.csv](results/bugs.csv) and the description for each contest in [contests.csv](results/contests.csv).
+ [contracts/](contracts/): contains all the smart contracts that we examined, using the version at the time of the contest.
+ [reports/](reports/): contains all the reports provided by code4rena.

### Bug Labels

We classify the surveyed bugs into three main categories based on their nature: 

+ Out-of-scope bugs (denoted by __O__)
+ Bugs with simple and general testing oracles (denoted by __L__)
+ Bugs that require high-level semantical oracles (denoted by __S__)

As classifying functional bugs can be ambiguous, we welcome suggestions to improve our classification standards. You can find more detailed label information in our [documentation](docs/standard.md), and we encourage you to refer to our current classification [guidelines](docs/standard.md#process) for more information.

## Recommended Security Analysis Tools

Our goal is to create a comprehensive list of vulnerability detection techniques that will be a valuable resource for Web3 developers and security analysts. We will focus on two main categories:

+ Publicly available security analysis tools that can be used for auditing
+ Vunerability detection techniques that prioritize the development of semantical oracles for smart contracts.

<span style="color:red"><strong>We warmly welcome any additional suggestions or contributions from the community to help expand and improve the list. </strong></span> 

### Publicly Available Security Analysis Techniques

We will include techniques that are publicly available and open-source, which can be used directly by Web3 developers and security analysts, or used as building blocks for other tools. Source-code level techniques are preferred given the scenarios of Web3 development and auditing.

+ [Slither, the Solidity source analyzer](https://github.com/crytic/slither)

### Vulnerability Detection with Automatic Semantical Oracles


We will include techniques that provide guidance for developing automatic semantic oracles, which can be sourced from various materials such as peer-reviewed research papers, pre-prints, industry tools, and online resources.


+ [Finding Permission Bugs in Smart Contracts with Role Mining](https://personal.ntu.edu.sg/yi_li/files/Liu2022FPB.pdf), which tries to address access control issues.
+ [AChecker: Statically Detecting Smart Contract Access Control Vulnerabilities](https://people.ece.ubc.ca/mjulia/publications/ACheckerICSE2023.pdf), which tries to address access control issues.

## Contributing

We welcome all types of contributions to our project, including but not limited to:

+ <span style="color:red"><strong>Suggesting new reference techniques for prioritizing smart contract vulnerability detection with semantical oracles.</strong></span>
+ Adding newly disclosed code4rena contest bugs.
+ Suggesting improvements to the classification standard
+ Correcting mislabeled bugs

Further details can be found in our [contribution guidelines](docs/contribution.md).

## Cite

+ Zhuo Zhang, Brian Zhang, Wen Xu, Zhiqiang Lin, "Demystifying Exploitable Bugs in Smart Contracts." In Proceedings of the 45th International Conference on Software Engineering, 2023.

## Clarification

Please refer to our classification [documentation](docs/classification.md).

## Acknowledgments

We would like to extend our sincere thanks to [code4rena](https://code4rena.com/) for making this valuable information publicly available.

