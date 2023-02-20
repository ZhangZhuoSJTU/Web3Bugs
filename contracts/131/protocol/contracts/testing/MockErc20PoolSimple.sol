// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "../../interfaces/IStakerVault.sol";
import "../../interfaces/IVault.sol";

import "../pool/Erc20Pool.sol";

// This is a simple mock pool contract that makes it easier for tests which involve multiple pools

contract MockErc20PoolSimple {
    address public vault;
    address public lpToken;
    address public underlying;

    function setLpToken(address _lpToken) external {
        lpToken = _lpToken;
    }

    function setVault(address _vault) external {
        vault = _vault;
    }

    function setUnderlying(address _underlying) external {
        underlying = _underlying;
    }

    function getUnderlying() external view returns (address) {
        return underlying;
    }

    function getLpToken() external view returns (address) {
        return lpToken;
    }

    function getVault() external view returns (address) {
        return vault;
    }
}
