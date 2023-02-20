// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "../Interfaces/IOracle.sol";
import "../Interfaces/IChainlinkOracle.sol";
import "../lib/LibMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * The Chainlink oracle adapter allows you to wrap a Chainlink oracle feed
 * and ensure that the price is always returned in a wad format.
 * The upstream feed may be changed (Eg updated to a new Chainlink feed) while
 * keeping price consistency for the actual Tracer perp market.
 */
contract OracleAdapter is IOracle, Ownable {
    using LibMath for uint256;
    IChainlinkOracle public oracle;
    uint256 private constant MAX_DECIMALS = 18;
    uint256 public scaler;

    constructor(address _oracle) {
        setOracle(_oracle);
    }

    /**
     * @notice Gets the latest anwser from the oracle
     * @dev converts the price to a WAD price before returning
     */
    function latestAnswer() external view override returns (uint256) {
        return toWad(uint256(oracle.latestAnswer()));
    }

    function decimals() external pure override returns (uint8) {
        return uint8(MAX_DECIMALS);
    }

    /**
     * @notice converts a raw value to a WAD value.
     * @dev this allows consistency for oracles used throughout the protocol
     *      and allows oracles to have their decimals changed withou affecting
     *      the market itself
     */
    function toWad(uint256 raw) internal view returns (uint256) {
        return raw * scaler;
    }

    /**
     * @notice Change the upstream feed address.
     */
    function changeOracle(address newOracle) public onlyOwner {
        setOracle(newOracle);
    }

    /**
     * @notice sets the upstream oracle
     * @dev resets the scalar value to ensure WAD values are always returned
     */
    function setOracle(address newOracle) internal {
        oracle = IChainlinkOracle(newOracle);
        // reset the scaler for consistency
        uint8 _decimals = oracle.decimals();
        require(_decimals <= MAX_DECIMALS, "COA: too many decimals");
        scaler = uint256(10**(MAX_DECIMALS - _decimals));
    }
}
