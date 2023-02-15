// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.6;

// Based on https://github.com/compound-finance/compound-protocol/blob/v2.8.1/contracts/ComptrollerInterface.sol
// and documentation at https://compound.finance/docs/comptroller
interface IComptroller {
    /// Enter into a list of markets - it is not an error to enter the same market more than once.
    /// In order to supply collateral or borrow in a market, it must be entered first.
    /// @param cTokens The list of addresses of the cToken markets to be enabled
    /// @return For each market, returns an error code indicating whether or not it was entered.
    ///         Each is 0 on success, otherwise an Error code.
    function enterMarkets(address[] calldata cTokens) external returns (uint[] memory);
}
