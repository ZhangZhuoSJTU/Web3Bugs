// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import 'forge-std/Test.sol';
import '../../Verification/adminVerifier.sol';
import '../../Verification/Verification.sol';
import '../../SublimeProxy.sol';

import '../roles/Admin.sol';
import '../roles/User.sol';
import '@openzeppelin/contracts/cryptography/ECDSA.sol';

contract AdminVerifierTests is Test {
    AdminVerifier adminVerifier;
    Verification verification;

    Admin proxyAdmin;
    Admin admin;
    Admin fakeAdmin;
    User user;
    User anotherUser;

    uint256 constant activationDelay = 1;
    uint256 constant signValidity = 365 days;
    uint256 constant signerPrivateKey = 0xb57992e36fcf5e1bf95840b39f83a5c57936bb391b50acad27e53b05bf751f71;
    uint256 constant newSignerPrivateKey = 0xc903396ee8a81ce8729bc48c2e71034e516a11e9b1c516addb602a55cd88e555;

    string constant verifierName = 'sublime';
    string constant verifierVersion = 'v1';

    bytes32 _TYPE_HASH;
    bytes32 _HASHED_NAME;
    bytes32 _HASHED_VERSION;

    function setUp() public {
        proxyAdmin = new Admin();
        admin = new Admin();
        fakeAdmin = new Admin();
        user = new User();
        anotherUser = new User();

        Verification verificationImplementation = new Verification();
        SublimeProxy verificationProxy = new SublimeProxy(address(verificationImplementation), address(proxyAdmin), '');
        verification = Verification(address(verificationProxy));
        admin.initializeVerification(verification, address(admin), activationDelay);

        AdminVerifier adminVerifierImplementation = new AdminVerifier(address(verification));
        SublimeProxy adminVerifierProxy = new SublimeProxy(address(adminVerifierImplementation), address(proxyAdmin), '');
        adminVerifier = AdminVerifier(address(adminVerifierProxy));
        admin.initializeAdminVerifier(
            adminVerifier,
            address(admin),
            vm.addr(signerPrivateKey),
            signValidity,
            verifierName,
            verifierVersion
        );

        admin.addVerifier(address(verification), address(adminVerifier));

        bytes32 hashedName = keccak256(bytes(verifierName));
        bytes32 hashedVersion = keccak256(bytes(verifierVersion));
        _HASHED_NAME = hashedName;
        _HASHED_VERSION = hashedVersion;

        _TYPE_HASH = keccak256('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)');
    }

    // Generating signatures should show valid signatures
    function test_generateSignatures() public {
        string memory userData = 'someUserData';
        // bool _isMasterLinked = true;

        address _user = 0xe33896558027811799165C5A85B7c9C318a0e7c4;

        address adminVerifierCustomAddress = 0x6469d5A63e28E2fa8cC37969e0817cf7e2F6F50b;

        uint256 _timestamp = 1655312381 + 1 days;
        bytes32 digest = _calculateDigest(userData, _user, _timestamp);
        bytes32 hash = _hashTypedDataV4_withContractAddress(digest, adminVerifierCustomAddress);

        (uint8 _v, bytes32 _r, bytes32 _s) = vm.sign(signerPrivateKey, hash);

        log_named_uint('timestamp', _timestamp);
        log_named_uint('v', _v);
        log_named_bytes32('_r', _r);
        log_named_bytes32('_s', _s);
    }

    // Registering a new user should pass
    function test_registerUser(string memory _userData, bool _isMasterLinked) public {
        if (bytes(_userData).length <= 2) return;

        uint256 _timestamp = block.timestamp + 1 minutes;
        bytes32 digest = _calculateDigest(_userData, address(user), _timestamp);
        bytes32 hash = _hashTypedDataV4(digest);

        (uint8 _v, bytes32 _r, bytes32 _s) = vm.sign(signerPrivateKey, hash);
        user.registerUserUsingAdminVerifier(adminVerifier, _isMasterLinked, _v, _r, _s, _userData, _timestamp);

        assertEq(adminVerifier.userData(address(user)), _userData);
    }

    // Registering user with the same digest should fail
    function test_cannot_use_same_digest_twice(string memory _userData, bool _isMasterLinked) public {
        if (bytes(_userData).length <= 2) return;
        uint256 _timestamp = block.timestamp + 1 minutes;
        bytes32 digest = _calculateDigest(_userData, address(user), _timestamp);
        bytes32 hash = _hashTypedDataV4(digest);

        (uint8 _v, bytes32 _r, bytes32 _s) = vm.sign(signerPrivateKey, hash);
        user.registerUserUsingAdminVerifier(adminVerifier, _isMasterLinked, _v, _r, _s, _userData, _timestamp);

        user.unregisterUserFromAdminVerifier(adminVerifier);

        try user.registerUserUsingAdminVerifier(adminVerifier, _isMasterLinked, _v, _r, _s, _userData, _timestamp) {
            revert('should revert as same digest is tried being used');
        } catch Error(string memory reason) {
            assertEq(reason, 'AV:RS3');
        }
    }

    // Regitering user with invalid signer address should fail
    function test_ec_recover(
        string memory _userData,
        bool _isMasterLinked,
        bytes calldata randomBytes
    ) public {
        if (bytes(_userData).length <= 2 || bytes(randomBytes).length <= 72) return;
        bytes32 wrongHash;
        uint256 _timestamp = block.timestamp + 1 minutes;

        {
            _timestamp = block.timestamp + 1 minutes;
            bytes32 digest = _calculateDigest(_userData, address(user), _timestamp);
            bytes32 hash = _hashTypedDataV4(digest);
            wrongHash = keccak256(abi.encode(randomBytes, hash));
        }

        (uint8 _v, bytes32 _r, bytes32 _s) = vm.sign(signerPrivateKey, wrongHash);
        try user.registerUserUsingAdminVerifier(adminVerifier, _isMasterLinked, _v, _r, _s, _userData, _timestamp) {
            revert('signer should be address 0');
        } catch Error(string memory reason) {
            bool result = keccak256(abi.encode(reason)) == keccak256(abi.encode('AV:RS4')) ||
                keccak256(abi.encode(reason)) == keccak256(abi.encode('AV:RS5'));
            assertEq(result, true);
        }
    }

    // Regitering user with invalid signer address should fail
    function test_ec_recover_2(string memory _userData, bool _isMasterLinked) public {
        if (bytes(_userData).length <= 2) return;

        uint256 _timestamp = block.timestamp + 1 minutes;
        bytes32 digest = _calculateDigest(_userData, address(user), _timestamp);
        bytes32 hash = _hashTypedDataV4(digest);
        bytes32 wrongHash = _hashTypedDataV4(hash);

        (uint8 _v, bytes32 _r, bytes32 _s) = vm.sign(signerPrivateKey, wrongHash);

        try user.registerUserUsingAdminVerifier(adminVerifier, _isMasterLinked, _v, _r, _s, _userData, _timestamp) {
            revert('signer should be invalid address');
        } catch Error(string memory reason) {
            assertEq(reason, 'AV:RS5');
        }
    }

    // Registering user after the sign validity has passed should fail
    function test_registerUserAfterSignValidity(string memory _userData, bool _isMasterLinked) public {
        if (bytes(_userData).length <= 2) return;

        uint256 _timestamp = block.timestamp + 1 minutes;
        bytes32 digest = _calculateDigest(_userData, address(user), _timestamp);
        bytes32 hash = _hashTypedDataV4(digest);

        (uint8 _v, bytes32 _r, bytes32 _s) = vm.sign(signerPrivateKey, hash);
        vm.warp(block.timestamp + 1 minutes + adminVerifier.signValidity());
        try user.registerUserUsingAdminVerifier(adminVerifier, _isMasterLinked, _v, _r, _s, _userData, _timestamp) {
            revert('Should revert after sign validity has expired');
        } catch Error(string memory reason) {
            assertEq(reason, 'AV:RS2');
        }
    }

    // Registering an already registered user should fail
    function test_cannot_register_if_already_registered(string memory _userData, bool _isMasterLinked) public {
        if (bytes(_userData).length <= 2) return;

        uint256 _timestamp = block.timestamp + 1 minutes;
        bytes32 digest = _calculateDigest(_userData, address(user), _timestamp);
        bytes32 hash = _hashTypedDataV4(digest);

        (uint8 _v, bytes32 _r, bytes32 _s) = vm.sign(signerPrivateKey, hash);
        user.registerUserUsingAdminVerifier(adminVerifier, _isMasterLinked, _v, _r, _s, _userData, _timestamp);

        try user.registerUserUsingAdminVerifier(adminVerifier, _isMasterLinked, _v, _r, _s, _userData, _timestamp) {
            revert('Should revert if tried to register multiple times');
        } catch Error(string memory reason) {
            assertEq(reason, 'AV:RS1');
        }
    }

    // Updating signer with the current signer address should fail
    function test_update_signer_same_address() public {
        try admin.updateSignerInAdminVerifier(adminVerifier, adminVerifier.signerAddress()) {
            revert('Using same address to update signer should revert');
        } catch Error(string memory reason) {
            assertEq(reason, 'AV:IUSA1');
        }
    }

    // Updating signer with the zero address should fail
    function test_update_signer_zero_address() public {
        try admin.updateSignerInAdminVerifier(adminVerifier, address(0)) {
            revert('Using zero address to update signer should revert');
        } catch Error(string memory reason) {
            assertEq(reason, 'AV:IUSA2');
        }
    }

    // Updating signer should pass
    function test_update_signer() public {
        admin.updateSignerInAdminVerifier(adminVerifier, vm.addr(newSignerPrivateKey));
        assertEq(adminVerifier.signerAddress(), vm.addr(newSignerPrivateKey));
    }

    // Updating sign validity with same value as current sign validity should fail
    function test_update_signValidity_same_value() public {
        try admin.updateSignValidityInAdminVerifier(adminVerifier, adminVerifier.signValidity()) {
            revert('Using same value to update sign validity should fail');
        } catch Error(string memory reason) {
            assertEq(reason, 'AV:IUSV1');
        }
    }

    // Updating sign validity with zero value should fail
    function test_update_signValidity_zero_value() public {
        try admin.updateSignValidityInAdminVerifier(adminVerifier, 0) {
            revert('Using zero value to update sign validity should fail');
        } catch Error(string memory reason) {
            assertEq(reason, 'AV:IUSV2');
        }
    }

    // Updating sign validity by invalid owner should fail
    function test_update_signValidity_invalid_owner() public {
        try proxyAdmin.updateSignValidityInAdminVerifier(adminVerifier, 11267) {
            revert('Using zero value to update sign validity should fail');
        } catch Error(string memory reason) {
            assertEq(reason, 'TransparentUpgradeableProxy: admin cannot fallback to proxy target');
        }

        try fakeAdmin.updateSignValidityInAdminVerifier(adminVerifier, 11267) {
            revert('Using zero value to update sign validity should fail');
        } catch Error(string memory reason) {
            assertEq(reason, 'Ownable: caller is not the owner');
        }
    }

    // Updating sign validity should pass
    function test_update_signValidity(uint256 newSignValidity) public {
        if (newSignValidity == 0 || adminVerifier.signValidity() == newSignValidity) return;

        admin.updateSignValidityInAdminVerifier(adminVerifier, newSignValidity);
        assertEq(adminVerifier.signValidity(), newSignValidity);
    }

    // Unregistering a registered user should pass
    function test_unregisterUser(string memory _userData, bool _isMasterLinked) public {
        if (bytes(_userData).length <= 2) return;
        test_registerUser(_userData, _isMasterLinked);

        emit log_named_uint('block.timestamp', block.timestamp);

        user.unregisterUserFromAdminVerifier(adminVerifier);
        assertEq(verification.masterAddresses(address(user), address(adminVerifier)), 0);
    }

    // Unregistering a non-existant user should fail
    function test_unregister_when_no_user() public {
        try user.unregisterUserFromAdminVerifier(adminVerifier) {
            revert('Should revert if user is not registered');
        } catch Error(string memory reason) {
            assertEq(reason, 'AV:IUU1');
        }
    }

    // Unregistering a user by Admin should pass
    function test_unregister_by_admin(string memory _userData, bool _isMasterLinked) public {
        if (bytes(_userData).length <= 2) return;
        test_registerUser(_userData, _isMasterLinked);

        emit log_named_uint('block.timestamp', block.timestamp);

        admin.unregisterUserByAdminInAdminVerifier(adminVerifier, address(user));
        assertEq(verification.masterAddresses(address(user), address(adminVerifier)), 0);
    }

    // Registering with black listed digest should fail
    function test_registering_with_black_listed_digest(string memory _userData, bool _isMasterLinked) public {
        if (bytes(_userData).length <= 2) return;

        uint256 _timestamp = block.timestamp + 1 minutes;
        bytes32 digest = _calculateDigest(_userData, address(user), _timestamp);
        bytes32 hash = _hashTypedDataV4(digest);

        admin.blacklistDigestInAdminVerifier(adminVerifier, digest);

        (uint8 _v, bytes32 _r, bytes32 _s) = vm.sign(signerPrivateKey, hash);
        try user.registerUserUsingAdminVerifier(adminVerifier, _isMasterLinked, _v, _r, _s, _userData, _timestamp) {
            revert('Should revert as digest is blacklisted');
        } catch Error(string memory reason) {
            assertEq(reason, 'AV:RS3');
        }
    }

    // ---- internal ---- //

    function _calculateDigest(
        string memory _userData,
        address _msgSender,
        uint256 _timestamp
    ) internal pure returns (bytes32) {
        bytes32 digest = keccak256(
            abi.encode(
                keccak256('set(string userData,address userAddr,uint256 timestamp)'),
                keccak256(bytes(_userData)),
                _msgSender,
                _timestamp
            )
        );

        return digest;
    }

    function _hashTypedDataV4(bytes32 structHash) internal view virtual returns (bytes32) {
        return keccak256(abi.encodePacked('\x19\x01', _domainSeparatorV4(), structHash));
    }

    function _domainSeparatorV4() internal view returns (bytes32) {
        return _buildDomainSeparator(_TYPE_HASH, _EIP712NameHash(), _EIP712VersionHash());
    }

    function _buildDomainSeparator(
        bytes32 typeHash,
        bytes32 name,
        bytes32 version
    ) private view returns (bytes32) {
        return keccak256(abi.encode(typeHash, name, version, _getChainId(), address(adminVerifier)));
    }

    function _getChainId() private view returns (uint256 chainId) {
        this; // silence state mutability warning without generating bytecode - see https://github.com/ethereum/solidity/issues/2691
        // solhint-disable-next-line no-inline-assembly
        assembly {
            chainId := chainid()
        }
    }

    function _EIP712NameHash() internal view virtual returns (bytes32) {
        return _HASHED_NAME;
    }

    function _EIP712VersionHash() internal view virtual returns (bytes32) {
        return _HASHED_VERSION;
    }

    // --------------- only for testing ------------- //
    function _hashTypedDataV4_withContractAddress(bytes32 structHash, address contractAddress) internal view virtual returns (bytes32) {
        return keccak256(abi.encodePacked('\x19\x01', _domainSeparatorV4_withContractAddress(contractAddress), structHash));
    }

    function _domainSeparatorV4_withContractAddress(address contractAddress) internal view returns (bytes32) {
        return _buildDomainSeparator_withContractAddress(_TYPE_HASH, _EIP712NameHash(), _EIP712VersionHash(), contractAddress);
    }

    function _buildDomainSeparator_withContractAddress(
        bytes32 typeHash,
        bytes32 name,
        bytes32 version,
        address contractAddress
    ) private view returns (bytes32) {
        return keccak256(abi.encode(typeHash, name, version, _getChainId(), contractAddress));
    }
}
