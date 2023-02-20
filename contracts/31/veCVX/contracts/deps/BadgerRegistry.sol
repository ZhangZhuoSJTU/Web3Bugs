// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.6.0 <0.7.0;
pragma experimental ABIEncoderV2;

import "deps/@openzeppelin/contracts/utils/EnumerableSet.sol";

contract BadgerRegistry {
    using EnumerableSet for EnumerableSet.AddressSet;

    //@dev is the vault at the experimental, guarded or open stage? Only for Prod Vaults
    enum VaultStatus {experimental, guarded, open}

    struct VaultData {
        string version;
        VaultStatus status;
        address[] list;
    }

    //@dev Multisig. Vaults from here are considered Production ready
    address public governance;
    address public devGovernance; //@notice an address with some powers to make things easier in development

    //@dev Given an Author Address, and Token, Return the Vault
    mapping(address => mapping(string => EnumerableSet.AddressSet))
        private vaults;
    mapping(string => address) public addresses;

    //@dev Given Version and VaultStatus, returns the list of Vaults in production
    mapping(string => mapping(VaultStatus => EnumerableSet.AddressSet))
        private productionVaults;

    // Known constants you can use
    string[] public keys; //@notice, you don't have a guarantee of the key being there, it's just a utility
    string[] public versions; //@notice, you don't have a guarantee of the key being there, it's just a utility

    event NewVault(address author, string version, address vault);
    event RemoveVault(address author, string version, address vault);
    event PromoteVault(
        address author,
        string version,
        address vault,
        VaultStatus status
    );
    event DemoteVault(
        address author,
        string version,
        address vault,
        VaultStatus status
    );

    event Set(string key, address at);
    event AddKey(string key);
    event AddVersion(string version);

    function initialize(address newGovernance) public {
        require(governance == address(0));
        governance = newGovernance;
        devGovernance = address(0);

        versions.push("v1"); //For v1
        versions.push("v2"); //For v2
    }

    function setGovernance(address _newGov) public {
        require(msg.sender == governance, "!gov");
        governance = _newGov;
    }

    function setDev(address newDev) public {
        require(
            msg.sender == governance || msg.sender == devGovernance,
            "!gov"
        );
        devGovernance = newDev;
    }

    //@dev Utility function to add Versions for Vaults,
    //@notice No guarantee that it will be properly used
    function addVersions(string memory version) public {
        require(msg.sender == governance, "!gov");
        versions.push(version);

        emit AddVersion(version);
    }

    //@dev Anyone can add a vault to here, it will be indexed by their address
    function add(string memory version, address vault) public {
        bool added = vaults[msg.sender][version].add(vault);
        if (added) {
            emit NewVault(msg.sender, version, vault);
        }
    }

    //@dev Remove the vault from your index
    function remove(string memory version, address vault) public {
        bool removed = vaults[msg.sender][version].remove(vault);
        if (removed) {
            emit RemoveVault(msg.sender, version, vault);
        }
    }

    //@dev Promote a vault to Production
    //@dev Promote just means indexed by the Governance Address
    function promote(
        string memory version,
        address vault,
        VaultStatus status
    ) public {
        require(
            msg.sender == governance || msg.sender == devGovernance,
            "!gov"
        );

        VaultStatus actualStatus = status;
        if (msg.sender == devGovernance) {
            actualStatus = VaultStatus.experimental;
        }

        bool added = productionVaults[version][actualStatus].add(vault);

        // If added remove from old and emit event
        if (added) {
            // also remove from old prod
            if (uint256(actualStatus) == 2) {
                // Remove from prev2
                productionVaults[version][VaultStatus(0)].remove(vault);
                productionVaults[version][VaultStatus(1)].remove(vault);
            }
            if (uint256(actualStatus) == 1) {
                // Remove from prev1
                productionVaults[version][VaultStatus(0)].remove(vault);
            }

            emit PromoteVault(msg.sender, version, vault, actualStatus);
        }
    }

    function demote(
        string memory version,
        address vault,
        VaultStatus status
    ) public {
        require(
            msg.sender == governance || msg.sender == devGovernance,
            "!gov"
        );

        VaultStatus actualStatus = status;
        if (msg.sender == devGovernance) {
            actualStatus = VaultStatus.experimental;
        }

        bool removed = productionVaults[version][actualStatus].remove(vault);

        if (removed) {
            emit DemoteVault(msg.sender, version, vault, status);
        }
    }

    /** KEY Management */

    //@dev Set the value of a key to a specific address
    //@notice e.g. controller = 0x123123
    function set(string memory key, address at) public {
        require(msg.sender == governance, "!gov");
        _addKey(key);
        addresses[key] = at;
        emit Set(key, at);
    }

    //@dev Retrieve the value of a key
    function get(string memory key) public view returns (address) {
        return addresses[key];
    }

    //@dev Add a key to the list of keys
    //@notice This is used to make it easier to discover keys,
    //@notice however you have no guarantee that all keys will be in the list
    function _addKey(string memory key) internal {
        //If we find the key, skip
        bool found = false;
        for (uint256 x = 0; x < keys.length; x++) {
            // Compare strings via their hash because solidity
            if (keccak256(bytes(key)) == keccak256(bytes(keys[x]))) {
                found = true;
            }
        }

        if (found) {
            return;
        }

        // Else let's add it and emit the event
        keys.push(key);

        emit AddKey(key);
    }

    //@dev Retrieve a list of all Vault Addresses from the given author
    function getVaults(string memory version, address author)
        public
        view
        returns (address[] memory)
    {
        uint256 length = vaults[author][version].length();

        address[] memory list = new address[](length);
        for (uint256 i = 0; i < length; i++) {
            list[i] = vaults[author][version].at(i);
        }
        return list;
    }

    //@dev Retrieve a list of all Vaults that are in production, based on Version and Status
    function getFilteredProductionVaults(
        string memory version,
        VaultStatus status
    ) public view returns (address[] memory) {
        uint256 length = productionVaults[version][status].length();

        address[] memory list = new address[](length);
        for (uint256 i = 0; i < length; i++) {
            list[i] = productionVaults[version][status].at(i);
        }
        return list;
    }

    function getProductionVaults() public view returns (VaultData[] memory) {
        uint256 versionsCount = versions.length;

        VaultData[] memory data = new VaultData[](versionsCount * 3);

        for (uint256 x = 0; x < versionsCount; x++) {
            for (uint256 y = 0; y < 3; y++) {
                uint256 length =
                    productionVaults[versions[x]][VaultStatus(y)].length();
                address[] memory list = new address[](length);
                for (uint256 z = 0; z < length; z++) {
                    list[z] = productionVaults[versions[x]][VaultStatus(y)].at(
                        z
                    );
                }
                data[x * (versionsCount - 1) + y * 2] = VaultData({
                    version: versions[x],
                    status: VaultStatus(y),
                    list: list
                });
            }
        }

        return data;
    }
}
