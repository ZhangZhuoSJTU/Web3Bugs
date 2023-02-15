// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IPoolFactory {
    struct Addresses {
        address pool;
        address vault;
        address lpToken;
        address stakerVault;
    }

    struct ImplementationNames {
        bytes32 pool;
        bytes32 vault;
        bytes32 lpToken;
        bytes32 stakerVault;
    }

    struct VaultArgs {
        uint256 debtLimit;
        uint256 targetAllocation;
        uint256 bound;
    }

    struct LpTokenArgs {
        string name;
        string symbol;
        uint8 decimals;
    }

    struct DeployPoolVars {
        address lpTokenImplementation;
        address poolImplementation;
        address stakerVaultImplementation;
        address vaultImplementation;
    }

    function addPoolImplementation(bytes32 name, address implementation) external returns (bool);

    function addLpTokenImplementation(bytes32 name, address implementation) external returns (bool);

    function addVaultImplementation(bytes32 name, address implementation) external returns (bool);

    function addStakerVaultImplementation(bytes32 name, address implementation)
        external
        returns (bool);

    function deployPool(
        string calldata poolName,
        address underlying,
        LpTokenArgs calldata lpTokenArgs,
        VaultArgs calldata vaultArgs,
        ImplementationNames calldata implementationNames
    ) external returns (Addresses memory addrs);
}
