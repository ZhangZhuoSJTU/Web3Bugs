pragma solidity ^0.5.0;

import "../ownership/Ownable.sol";

/**
 * @title Package
 * @dev A package is composed by a set of versions, identified via semantic versioning,
 * where each version has a contract address that refers to a reusable implementation,
 * plus an optional content URI with metadata. Note that the semver identifier is restricted
 * to major, minor, and patch, as prerelease tags are not supported.
 */
contract Package is OpenZeppelinUpgradesOwnable {
    /**
     * @dev Emitted when a version is added to the package.
     * @param semanticVersion Name of the added version.
     * @param contractAddress Contract associated with the version.
     * @param contentURI Optional content URI with metadata of the version.
     */
    event VersionAdded(
        uint64[3] semanticVersion,
        address contractAddress,
        bytes contentURI
    );

    struct Version {
        uint64[3] semanticVersion;
        address contractAddress;
        bytes contentURI;
    }

    mapping(bytes32 => Version) internal versions;
    mapping(uint64 => bytes32) internal majorToLatestVersion;
    uint64 internal latestMajor;

    /**
     * @dev Returns a version given its semver identifier.
     * @param semanticVersion Semver identifier of the version.
     * @return Contract address and content URI for the version, or zero if not exists.
     */
    function getVersion(uint64[3] memory semanticVersion)
        public
        view
        returns (address contractAddress, bytes memory contentURI)
    {
        Version storage version =
            versions[semanticVersionHash(semanticVersion)];
        return (version.contractAddress, version.contentURI);
    }

    /**
     * @dev Returns a contract for a version given its semver identifier.
     * This method is equivalent to `getVersion`, but returns only the contract address.
     * @param semanticVersion Semver identifier of the version.
     * @return Contract address for the version, or zero if not exists.
     */
    function getContract(uint64[3] memory semanticVersion)
        public
        view
        returns (address contractAddress)
    {
        Version storage version =
            versions[semanticVersionHash(semanticVersion)];
        return version.contractAddress;
    }

    /**
     * @dev Adds a new version to the package. Only the Owner can add new versions.
     * Reverts if the specified semver identifier already exists.
     * Emits a `VersionAdded` event if successful.
     * @param semanticVersion Semver identifier of the version.
     * @param contractAddress Contract address for the version, must be non-zero.
     * @param contentURI Optional content URI for the version.
     */
    function addVersion(
        uint64[3] memory semanticVersion,
        address contractAddress,
        bytes memory contentURI
    ) public onlyOwner {
        require(contractAddress != address(0), "Contract address is required");
        require(
            !hasVersion(semanticVersion),
            "Given version is already registered in package"
        );
        require(
            !semanticVersionIsZero(semanticVersion),
            "Version must be non zero"
        );

        // Register version
        bytes32 versionId = semanticVersionHash(semanticVersion);
        versions[versionId] = Version(
            semanticVersion,
            contractAddress,
            contentURI
        );

        // Update latest major
        uint64 major = semanticVersion[0];
        if (major > latestMajor) {
            latestMajor = semanticVersion[0];
        }

        // Update latest version for this major
        uint64 minor = semanticVersion[1];
        uint64 patch = semanticVersion[2];
        uint64[3] storage latestVersionForMajor =
            versions[majorToLatestVersion[major]].semanticVersion;
        if (
            semanticVersionIsZero(latestVersionForMajor) || // No latest was set for this major
            (minor > latestVersionForMajor[1]) || // Or current minor is greater
            (minor == latestVersionForMajor[1] &&
                patch > latestVersionForMajor[2]) // Or current patch is greater
        ) {
            majorToLatestVersion[major] = versionId;
        }

        emit VersionAdded(semanticVersion, contractAddress, contentURI);
    }

    /**
     * @dev Checks whether a version is present in the package.
     * @param semanticVersion Semver identifier of the version.
     * @return true if the version is registered in this package, false otherwise.
     */
    function hasVersion(uint64[3] memory semanticVersion)
        public
        view
        returns (bool)
    {
        Version storage version =
            versions[semanticVersionHash(semanticVersion)];
        return address(version.contractAddress) != address(0);
    }

    /**
     * @dev Returns the version with the highest semver identifier registered in the package.
     * For instance, if `1.2.0`, `1.3.0`, and `2.0.0` are present, will always return `2.0.0`, regardless
     * of the order in which they were registered. Returns zero if no versions are registered.
     * @return Semver identifier, contract address, and content URI for the version, or zero if not exists.
     */
    function getLatest()
        public
        view
        returns (
            uint64[3] memory semanticVersion,
            address contractAddress,
            bytes memory contentURI
        )
    {
        return getLatestByMajor(latestMajor);
    }

    /**
     * @dev Returns the version with the highest semver identifier for the given major.
     * For instance, if `1.2.0`, `1.3.0`, and `2.0.0` are present, will return `1.3.0` for major `1`,
     * regardless of the order in which they were registered. Returns zero if no versions are registered
     * for the specified major.
     * @param major Major identifier to query
     * @return Semver identifier, contract address, and content URI for the version, or zero if not exists.
     */
    function getLatestByMajor(uint64 major)
        public
        view
        returns (
            uint64[3] memory semanticVersion,
            address contractAddress,
            bytes memory contentURI
        )
    {
        Version storage version = versions[majorToLatestVersion[major]];
        return (
            version.semanticVersion,
            version.contractAddress,
            version.contentURI
        );
    }

    function semanticVersionHash(uint64[3] memory version)
        internal
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(version[0], version[1], version[2]));
    }

    function semanticVersionIsZero(uint64[3] memory version)
        internal
        pure
        returns (bool)
    {
        return version[0] == 0 && version[1] == 0 && version[2] == 0;
    }
}
