// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import 'forge-std/Test.sol';
import '../../Verification/twitterVerifier.sol';
import '../../Verification/Verification.sol';
import '../../SublimeProxy.sol';

import '../roles/Admin.sol';
import '../roles/User.sol';
import '@openzeppelin/contracts/cryptography/ECDSA.sol';

contract TwitterVerifierTests is Test {
    TwitterVerifier twitterVerifier;
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

    bytes32 _TYPE_HASH = keccak256('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)');
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

        TwitterVerifier twitterVerifierImplementation = new TwitterVerifier(address(verification));
        SublimeProxy twitterVerifierProxy = new SublimeProxy(address(twitterVerifierImplementation), address(proxyAdmin), '');
        twitterVerifier = TwitterVerifier(address(twitterVerifierProxy));
        admin.initializeTwitterVerifier(
            twitterVerifier,
            address(admin),
            vm.addr(signerPrivateKey),
            signValidity,
            verifierName,
            verifierVersion
        );

        admin.addVerifier(address(verification), address(twitterVerifier));

        bytes32 hashedName = keccak256(bytes(verifierName));
        bytes32 hashedVersion = keccak256(bytes(verifierVersion));
        _HASHED_NAME = hashedName;
        _HASHED_VERSION = hashedVersion;

        _TYPE_HASH = keccak256('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)');
    }

    function test_check_address_generation() public {
        log_named_address('signer address', vm.addr(signerPrivateKey));
    }

    // Test signer and signer private key equivalency
    function test_sign_message_and_recover() public {
        bytes32 digest = keccak256((abi.encode('some random value')));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPrivateKey, digest);
        address signer = ECDSA.recover(digest, v, r, s);
        assertEq(signer, vm.addr(signerPrivateKey));
    }

    // Valid signature generation check
    function test_generateSignatures() public {
        string memory _twitterId = 'sudosym';
        string memory _tweetId = 'r tweet id';
        // bool _isMasterLinked = true;

        address _user = 0xe33896558027811799165C5A85B7c9C318a0e7c4;

        address twitterVerifierCustomAddress = 0xB980BDa08dB45156E5fE727057f54f85AfB6eE3C;

        uint256 _timestamp = 1655312381 + 1 days;
        bytes32 digest = _calculateDigest(_twitterId, _tweetId, _user, _timestamp);
        bytes32 hash = _hashTypedDataV4_withContractAddress(digest, twitterVerifierCustomAddress);

        (uint8 _v, bytes32 _r, bytes32 _s) = vm.sign(signerPrivateKey, hash);

        log_named_bytes32('digest', digest);
        log_named_bytes32('eip712-digest', hash);
        log_named_uint('timestamp', _timestamp);
        log_named_uint('v', _v);
        log_named_bytes32('_r', _r);
        log_named_bytes32('_s', _s);

        log_named_bytes32('keccak256(bytes(_twitterId))', keccak256(bytes(_twitterId)));
    }

    // Registering a new user should pass
    function test_registerUser(
        string memory _twitterId,
        string memory _tweetId,
        bool _isMasterLinked
    ) public {
        if (bytes(_twitterId).length <= 2 || bytes(_tweetId).length <= 2) return;

        uint256 _timestamp = block.timestamp + 1 minutes;
        bytes32 digest = _calculateDigest(_twitterId, _tweetId, address(user), _timestamp);
        bytes32 hash = _hashTypedDataV4(digest);

        (uint8 _v, bytes32 _r, bytes32 _s) = vm.sign(signerPrivateKey, hash);
        user.registerUserUsingTwitterVerifier(twitterVerifier, _isMasterLinked, _v, _r, _s, _twitterId, _tweetId, _timestamp);

        vm.warp(block.timestamp + 1 minutes);

        assertEq(twitterVerifier.twitterIdMap(_twitterId), address(user));
        assertEq(twitterVerifier.usedTweetIds(_tweetId), address(user));

        if (_isMasterLinked) {
            assertEq(verification.isUser(address(user), address(twitterVerifier)), true);
        } else {
            assertEq(verification.isUser(address(user), address(twitterVerifier)), false);
        }
    }

    // Registering a new user after the sign validity has passed should fail
    function test_registerUser_fail_after_validity(
        string memory _twitterId,
        string memory _tweetId,
        bool _isMasterLinked
    ) public {
        if (bytes(_twitterId).length <= 2 || bytes(_tweetId).length <= 2) return;

        uint256 _timestamp = block.timestamp + 1 minutes;
        bytes32 digest = _calculateDigest(_twitterId, _tweetId, address(user), _timestamp);
        bytes32 hash = _hashTypedDataV4(digest);

        (uint8 _v, bytes32 _r, bytes32 _s) = vm.sign(signerPrivateKey, hash);

        vm.warp(block.timestamp + 1 minutes + twitterVerifier.signValidity());
        try user.registerUserUsingTwitterVerifier(twitterVerifier, _isMasterLinked, _v, _r, _s, _twitterId, _tweetId, _timestamp) {
            revert('Should revert after sign validity has expired');
        } catch Error(string memory reason) {
            assertEq(reason, 'TV:RS4');
        }
    }

    // Registering a new user with zero length tweet id should fail
    function test_cannot_register_if_tweet_id_is_zero_length(string memory _twitterId, bool _isMasterLinked) public {
        if (bytes(_twitterId).length <= 2) return;

        uint256 _timestamp = block.timestamp + 1 minutes;
        bytes32 digest = _calculateDigest(_twitterId, '', address(user), _timestamp);
        bytes32 hash = _hashTypedDataV4(digest);

        (uint8 _v, bytes32 _r, bytes32 _s) = vm.sign(signerPrivateKey, hash);
        try user.registerUserUsingTwitterVerifier(twitterVerifier, _isMasterLinked, _v, _r, _s, _twitterId, '', _timestamp) {
            revert('Should revert as tweet id length is 0');
        } catch Error(string memory reason) {
            assertEq(reason, 'TV:RS8');
        }
    }

    // Registering a user with invalid signer address should fail
    function test_ec_recover(
        string memory _twitterId,
        string memory _tweetId,
        bytes calldata randomBytes
    ) public {
        if (bytes(_twitterId).length <= 2 || bytes(_tweetId).length <= 2) return;
        bytes32 wrongHash;
        uint256 _timestamp = block.timestamp + 1 minutes;

        {
            bytes32 digest = _calculateDigest(_twitterId, _tweetId, address(user), _timestamp);
            bytes32 hash = _hashTypedDataV4(digest);

            wrongHash = keccak256(abi.encode(randomBytes, hash));
        }

        (uint8 _v, bytes32 _r, bytes32 _s) = vm.sign(signerPrivateKey, wrongHash);
        try user.registerUserUsingTwitterVerifier(twitterVerifier, true, _v, _r, _s, _twitterId, _tweetId, _timestamp) {
            revert('signer should be address 0');
        } catch Error(string memory reason) {
            bool result = keccak256(abi.encode(reason)) == keccak256(abi.encode('TV:RS6')) ||
                keccak256(abi.encode(reason)) == keccak256(abi.encode('TV:RS7'));
            assertEq(result, true);
        }
    }

    // Registering a user with a used tweet should fail
    function test_cannot_reuse_the_tweet(
        string calldata _twitterId,
        string calldata _tweetId,
        bool _isMasterLinked
    ) public {
        if (bytes(_twitterId).length <= 2 || bytes(_tweetId).length <= 2) return;

        test_unregisterUser(_twitterId, _tweetId, _isMasterLinked);

        try
            user.registerUserUsingTwitterVerifier(
                twitterVerifier,
                _isMasterLinked,
                uint8(0),
                bytes32(0),
                bytes32(0),
                _twitterId,
                _tweetId,
                block.timestamp + 365 days
            )
        {
            revert('Should Revert');
        } catch Error(string memory reason) {
            assertEq(reason, 'TV:RS3');
        }
    }

    // Registering user with zero length twitter id should fail
    function test_cannot_register_if_twitter_id_is_zero_length(string memory _tweetId, bool _isMasterLinked) public {
        if (bytes(_tweetId).length <= 2) return;

        uint256 _timestamp = block.timestamp + 1 minutes;
        bytes32 digest = _calculateDigest('', _tweetId, address(user), _timestamp);
        bytes32 hash = _hashTypedDataV4(digest);

        (uint8 _v, bytes32 _r, bytes32 _s) = vm.sign(signerPrivateKey, hash);
        try user.registerUserUsingTwitterVerifier(twitterVerifier, _isMasterLinked, _v, _r, _s, '', _tweetId, _timestamp) {
            revert('Should revert as twitter id length is 0');
        } catch Error(string memory reason) {
            assertEq(reason, 'TV:RS9');
        }
    }

    // Registering an already registered user should fail
    function test_cannot_register_if_already_registered(
        string memory _twitterId,
        string memory _tweetId,
        bool _isMasterLinked
    ) public {
        if (bytes(_twitterId).length <= 2 || bytes(_tweetId).length <= 2) return;

        uint256 _timestamp = block.timestamp + 1 minutes;
        bytes32 digest = _calculateDigest(_twitterId, _tweetId, address(user), _timestamp);
        bytes32 hash = _hashTypedDataV4(digest);

        (uint8 _v, bytes32 _r, bytes32 _s) = vm.sign(signerPrivateKey, hash);
        user.registerUserUsingTwitterVerifier(twitterVerifier, _isMasterLinked, _v, _r, _s, _twitterId, _tweetId, _timestamp);

        try user.registerUserUsingTwitterVerifier(twitterVerifier, _isMasterLinked, _v, _r, _s, _twitterId, _tweetId, _timestamp) {
            revert('Should revert if tried to register multiple times');
        } catch Error(string memory reason) {
            assertEq(reason, 'TV:RS1');
        }
    }

    // Updating signer with the current signer address should fail
    function test_update_signer_same_address() public {
        try admin.updateSignerInTwitterVerifier(twitterVerifier, twitterVerifier.signerAddress()) {
            revert('Using same address to update signer should revert');
        } catch Error(string memory reason) {
            assertEq(reason, 'TV:IUSA1');
        }
    }

    // Updating signer with the zero address should fail
    function test_update_signer_zero_address() public {
        try admin.updateSignerInTwitterVerifier(twitterVerifier, address(0)) {
            revert('Using zero address to update signer should revert');
        } catch Error(string memory reason) {
            assertEq(reason, 'TV:IUSA2');
        }
    }

    // Updating a signer address should pass
    function test_update_signer() public {
        admin.updateSignerInTwitterVerifier(twitterVerifier, vm.addr(newSignerPrivateKey));
        assertEq(twitterVerifier.signerAddress(), vm.addr(newSignerPrivateKey));
    }

    // Updating sign validity with same value as current sign validity should fail
    function test_update_signValidity_same_value() public {
        try admin.updateSignValidityInTwitterVerifier(twitterVerifier, twitterVerifier.signValidity()) {
            revert('Using same value to update sign validity should fail');
        } catch Error(string memory reason) {
            assertEq(reason, 'TV:IUSV1');
        }
    }

    // Updating sign validity with zero value should fail
    function test_update_signValidity_zero_value() public {
        try admin.updateSignValidityInTwitterVerifier(twitterVerifier, 0) {
            revert('Using zero value to update sign validity should fail');
        } catch Error(string memory reason) {
            assertEq(reason, 'TV:IUSV2');
        }
    }

    // Updating sign validity by invalid owner should fail
    function test_update_signValidity_invalid_owner() public {
        try proxyAdmin.updateSignValidityInTwitterVerifier(twitterVerifier, 11267) {
            revert('Using zero value to update sign validity should fail');
        } catch Error(string memory reason) {
            assertEq(reason, 'TransparentUpgradeableProxy: admin cannot fallback to proxy target');
        }

        try fakeAdmin.updateSignValidityInTwitterVerifier(twitterVerifier, 11267) {
            revert('Using zero value to update sign validity should fail');
        } catch Error(string memory reason) {
            assertEq(reason, 'Ownable: caller is not the owner');
        }
    }

    // Updating the sign validity should pass
    function test_update_signValidity(uint256 newSignValidity) public {
        if (newSignValidity == 0 || twitterVerifier.signValidity() == newSignValidity) return;

        admin.updateSignValidityInTwitterVerifier(twitterVerifier, newSignValidity);
        assertEq(twitterVerifier.signValidity(), newSignValidity);
    }

    // Registering user with already used twitter id should fail
    function test_cannot_register_if_twitterId_is_already_used(
        string memory _twitterId,
        string memory _tweetId,
        bool _isMasterLinked
    ) public {
        if (bytes(_twitterId).length <= 2 || bytes(_tweetId).length <= 2) return;

        uint256 _timestamp = block.timestamp + 1 minutes;
        bytes32 digest = _calculateDigest(_twitterId, _tweetId, address(user), _timestamp);
        bytes32 hash = _hashTypedDataV4(digest);

        (uint8 _v, bytes32 _r, bytes32 _s) = vm.sign(signerPrivateKey, hash);

        user.registerUserUsingTwitterVerifier(twitterVerifier, _isMasterLinked, _v, _r, _s, _twitterId, _tweetId, _timestamp);

        try anotherUser.registerUserUsingTwitterVerifier(twitterVerifier, _isMasterLinked, _v, _r, _s, _twitterId, _tweetId, _timestamp) {
            revert('Should revert if same twitter id used again');
        } catch Error(string memory reason) {
            assertEq(reason, 'TV:RS2');
        }
    }

    // Unregistering a registered user should pass
    function test_unregisterUser(
        string memory _twitterId,
        string memory _tweetId,
        bool _isMasterLinked
    ) public {
        if (bytes(_twitterId).length <= 2 || bytes(_tweetId).length <= 2) return;
        test_registerUser(_twitterId, _tweetId, _isMasterLinked);

        user.unregisterUserFromTwitterVerifier(twitterVerifier);
        assertEq(verification.masterAddresses(address(user), address(twitterVerifier)), 0);
        assertEq(twitterVerifier.twitterIdMap(_twitterId), address(0));
        assertEq(twitterVerifier.usedTweetIds(_tweetId), address(user));
    }

    // Unregistering a non-existant user should fail
    function test_unregisterUserWhenNotRegistered() public {
        try user.unregisterUserFromTwitterVerifier(twitterVerifier) {
            revert('Should revert if user was not registered');
        } catch Error(string memory reason) {
            assertEq(reason, 'TV:IUU1');
        }
    }

    // Unregistering a user by Admin should pass
    function test_unregister_by_admin(
        string memory _twitterId,
        string memory _tweetId,
        bool _isMasterLinked
    ) public {
        if (bytes(_twitterId).length <= 2 || bytes(_tweetId).length <= 2) return;
        test_registerUser(_twitterId, _tweetId, _isMasterLinked);

        admin.unregisterUserByAdminInTwitterVerifier(twitterVerifier, address(user));
        assertEq(verification.masterAddresses(address(user), address(twitterVerifier)), 0);
        assertEq(twitterVerifier.twitterIdMap(_twitterId), address(0));
        assertEq(twitterVerifier.usedTweetIds(_tweetId), address(user));
    }

    // Registering user with black listed digest should fail
    function test_registering_with_black_listed_digest(
        string memory _twitterId,
        string memory _tweetId,
        bool _isMasterLinked
    ) public {
        if (bytes(_twitterId).length <= 2 || bytes(_tweetId).length <= 2) return;

        uint256 _timestamp = block.timestamp + 1 minutes;
        bytes32 digest = _calculateDigest(_twitterId, _tweetId, address(user), _timestamp);
        bytes32 hash = _hashTypedDataV4(digest);

        admin.blacklistDigestInTwitterVerifier(twitterVerifier, digest);

        (uint8 _v, bytes32 _r, bytes32 _s) = vm.sign(signerPrivateKey, hash);
        try user.registerUserUsingTwitterVerifier(twitterVerifier, _isMasterLinked, _v, _r, _s, _twitterId, _tweetId, _timestamp) {
            revert('Should revert as digest is blacklisted');
        } catch Error(string memory reason) {
            assertEq(reason, 'TV:RS5');
        }
    }

    function _calculateDigest(
        string memory _twitterId,
        string memory _tweetId,
        address _msgSender,
        uint256 _timestamp
    ) internal pure returns (bytes32) {
        bytes32 digest = keccak256(
            abi.encode(
                keccak256('set(string twitterId,string tweetId,address userAddr,uint256 timestamp)'),
                keccak256(bytes(_twitterId)),
                keccak256(bytes(_tweetId)),
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
        return keccak256(abi.encode(typeHash, name, version, _getChainId(), address(twitterVerifier)));
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
    function _hashTypedDataV4_withContractAddress(bytes32 structHash, address contractAddress) internal virtual returns (bytes32) {
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
