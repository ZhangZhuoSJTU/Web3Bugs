// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.10;

import "./ComptrollerInterface.sol";
import "./CTokenInterfaces.sol";
import "./ErrorReporter.sol";

/**
 * @title Compound's CToken Contract
 * @notice Abstract base for CTokens
 * @author Compound
 */
abstract contract CToken is CTokenInterface, CErc20Interface, TokenErrorReporter {

}

abstract contract CEthToken is CTokenInterface, CEthInterface, TokenErrorReporter {}
