// SPDX-License-Identifier: GPL-3.0-or-later

pragma solidity >=0.8.0;

import "./IndexPool.sol";
import "./PoolDeployer.sol";

/// @notice Contract for deploying Trident exchange Index Pool with configurations.
/// @author Mudit Gupta
contract IndexPoolFactory is PoolDeployer {
    constructor(address _masterDeployer) PoolDeployer(_masterDeployer) {}

    function deployPool(bytes memory _deployData) external returns (address pool) {
        (address[] memory tokens, , ) = abi.decode(_deployData, (address[], uint256[], uint256));

        // @dev Salt is not actually needed since `_deployData` is part of creationCode and already contains the salt.
        bytes32 salt = keccak256(_deployData);
        pool = address(new IndexPool{salt: salt}(_deployData, masterDeployer));
        _registerPool(pool, tokens, salt);
    }
}
