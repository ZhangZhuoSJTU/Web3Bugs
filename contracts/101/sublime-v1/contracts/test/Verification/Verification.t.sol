// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import 'forge-std/Test.sol';
import 'forge-std/Vm.sol';

import '../../Verification/Verification.sol';
import '../roles/Admin.sol';
import '../roles/User.sol';

contract VerificationTest is Test {
    Verification verification;

    Admin proxyAdmin;
    Admin admin;
    Admin fakeAdmin;

    User user;
    User anotherUser;

    Admin mockVerifier;

    uint256 constant activationDelay = 1000;

    function setUp() public {
        proxyAdmin = new Admin();
        admin = new Admin();
        fakeAdmin = new Admin();
        mockVerifier = new Admin();

        user = new User();
        anotherUser = new User();

        Verification verificationImplementation = new Verification();
        SublimeProxy verificationProxy = new SublimeProxy(address(verificationImplementation), address(proxyAdmin), '');
        verification = Verification(address(verificationProxy));
        admin.initializeVerification(verification, address(admin), activationDelay);

        admin.addVerifier(address(verification), address(mockVerifier));
    }

    // Adding address(0) as verifier should fail
    function test_address_zero_verifier() public {
        try admin.addVerifier(address(verification), address(0)) {
            revert('Should not be able to add zero verifier');
        } catch Error(string memory reason) {
            assertEq(reason, 'V:AV1');
        }
    }

    // Removing non-existant verifier should fail
    function test_remove_wrong_verifier() public {
        try admin.removeVerifier(address(verification), address(21123)) {
            revert('This should be reverted');
        } catch Error(string memory reason) {
            assertEq(reason, 'V:RV1');
        }
    }

    // Adding exising verifier should fail
    function test_cannot_add_existing_verifier() public {
        try admin.addVerifier(address(verification), address(mockVerifier)) {
            revert('Should revert when tried to add verifier again');
        } catch Error(string memory reason) {
            assertEq(reason, 'V:AV2');
        }
    }

    // Adding new verifier should pass
    function test_add_new_verifier() public {
        Admin newMockVerifier = new Admin();

        admin.addVerifier(address(verification), address(newMockVerifier));
        assertTrue(verification.verifiers(address(newMockVerifier)));
    }

    // Removing verifier should pass
    function test_remove_verifier() public {
        admin.removeVerifier(address(verification), address(mockVerifier));
        bool isVerifier = verification.verifiers(address(mockVerifier));
        assertEq(isVerifier, false);
    }

    // Registering master address should pass
    function test_registerMasterAddress(bool _isMasterLinked) public {
        mockVerifier.registerMasterAddressInVerificaction(verification, address(user), _isMasterLinked);

        assertGt(verification.masterAddresses(address(user), address(mockVerifier)), 0); // activation time should be non-zero
        if (_isMasterLinked) {
            (uint64 _linkedAddressActivatesAt, address _master) = verification.linkedAddresses(address(user));
            assertGt(uint256(_linkedAddressActivatesAt), 0);
            assertEq(_master, address(user)); // here master address and linked address should be same
        }
    }

    // User should be active only after activation time has passed
    function test_is_user_is_false_immediately_after() public {
        test_registerMasterAddress(true);
        assertEq(verification.isUser(address(user), address(mockVerifier)), false);
    }

    // User should be active after activation time has passed
    function test_is_user_after_activation_delay() public {
        test_is_user_is_false_immediately_after();
        vm.warp(block.timestamp + activationDelay + 1);
        assertEq(verification.isUser(address(user), address(mockVerifier)), true);
    }

    // Registering same master address twice should fail
    function test_registerMasterAddressTwice(bool _isMasterLinked) public {
        mockVerifier.registerMasterAddressInVerificaction(verification, address(user), _isMasterLinked);

        try mockVerifier.registerMasterAddressInVerificaction(verification, address(user), _isMasterLinked) {
            revert('Should fail if tried to register twice');
        } catch Error(string memory reason) {
            assertEq(reason, 'V:RMA1');
        }
    }

    // Registering master address by an invalid user (NOT a verifier) should fail
    function test_registerMasterByNonVerifier(bool _isMasterLinked) public {
        try admin.registerMasterAddressInVerificaction(verification, address(user), _isMasterLinked) {
            revert('non verifier should not be able to registerMasterAddress');
        } catch Error(string memory reason) {
            assertEq(reason, 'V:OV1');
        }
    }

    // Any user should be able to unregister master address
    function test_admin_unregister_any_account(bool _isMasterLinked) public {
        test_registerMasterAddress(_isMasterLinked);
        admin.unregisterMasterAddressInVerification(verification, address(user), address(mockVerifier));

        assertEq(verification.masterAddresses(address(user), address(mockVerifier)), uint256(0));
    }

    // Only admin should be able to unregister master address
    function test_non_admin_unregister_any_account(bool _isMasterLinked) public {
        test_registerMasterAddress(_isMasterLinked);
        try fakeAdmin.unregisterMasterAddressInVerification(verification, address(user), address(mockVerifier)) {
            revert('Should revert as admin is not calling this function');
        } catch Error(string memory reason) {
            assertEq(reason, 'V:UMA1');
        }
    }

    // Valid verifier should be able to unregister master addresses
    function test_verifier_unregister_any_account(bool _isMasterLinked, address thisArgumentCanBeAnything) public {
        test_registerMasterAddress(_isMasterLinked);

        mockVerifier.unregisterMasterAddressInVerification(verification, address(user), thisArgumentCanBeAnything);
        assertEq(verification.masterAddresses(address(user), address(mockVerifier)), uint256(0));
    }

    // Requesting address link should pass
    function test_requestAddressLinking() public {
        test_registerMasterAddress(false);
        vm.warp(block.timestamp + 1 hours);

        // user = master, anotherUser = linkedAddress
        user.requestAddressLinkingInVerifier(verification, address(anotherUser));
        assertEq(verification.pendingLinkAddresses(address(anotherUser), address(user)), true);
    }

    // Requesting address link for existing master address should fail
    function test_requestExistingAddressLinking() public {
        test_registerMasterAddress(true);
        vm.warp(block.timestamp + 1 hours);

        // user = master, anotherUser = linkedAddress
        try user.requestAddressLinkingInVerifier(verification, address(user)) {
            revert('Should revert when tried to link existing address');
        } catch Error(string memory reason) {
            assertEq(reason, 'V:RAL1');
        }
    }

    // Cancelling address link request should pass
    function test_cancelAddressLinking() public {
        test_requestAddressLinking();
        user.cancelAddressLinkingRequestInVerification(verification, address(anotherUser));
        assertEq(verification.pendingLinkAddresses(address(anotherUser), address(user)), false);
    }

    // Cancelling address link request for linked addresses should fail
    function test_cancelAddressLinkingWhenNotPendfing() public {
        try user.cancelAddressLinkingRequestInVerification(verification, address(anotherUser)) {
            revert('Should revert when tried to cancel when no request is there');
        } catch Error(string memory reason) {
            assertEq(reason, 'V:CALR1');
        }
    }

    // linking addresses to master address should pass
    function test_linkAddress() public {
        test_requestAddressLinking();
        anotherUser.linkAddressInVerification(verification, address(user));
        (, address _master) = verification.linkedAddresses(address(anotherUser));
        assertEq(_master, address(user));
        vm.warp(block.timestamp + activationDelay);
        assertEq(verification.isUser(address(anotherUser), address(mockVerifier)), true);
    }

    // Unlinking addresses from master address should pass
    function test_unlinkAddress() public {
        test_linkAddress();
        user.unlinkAddressInVerification(verification, address(anotherUser));
        assertEq(verification.isUser(address(anotherUser), address(mockVerifier)), false);
    }

    // Unlinking same address from master address more than once should fail
    function test_unlinkAddressMultipleTimes() public {
        test_unlinkAddress();
        try user.unlinkAddressInVerification(verification, address(anotherUser)) {
            revert("Can't unlink multiple times");
        } catch Error(string memory reason) {
            assertEq(reason, 'V:UA1');
        }
    }

    // linking master address to address(0) should fail
    function test_linking_address_to_zero() public {
        try anotherUser.linkAddressInVerification(verification, address(0)) {
            revert('Should Revert');
        } catch Error(string memory reason) {
            assertEq(reason, 'V:LA1');
        }
    }

    // linking same address to same master address multiple times should fail
    function test_linkAddress_multiple_times_fails() public {
        test_requestAddressLinking();
        anotherUser.linkAddressInVerification(verification, address(user));

        try anotherUser.linkAddressInVerification(verification, address(user)) {
            revert('Should Revert');
        } catch Error(string memory reason) {
            assertEq(reason, 'V:LA2');
        }
    }

    // Linking address without requesting first should fail
    function test_linkAddress_without_request() public {
        try anotherUser.linkAddressInVerification(verification, address(user)) {
            revert('Should Revert');
        } catch Error(string memory reason) {
            assertEq(reason, 'V:LA3');
        }
    }

    // Updating activation delay should pass
    function test_updateActivationDelay(uint256 _activationDelay) public {
        admin.updateActivationDelayInVerification(verification, _activationDelay);
        uint256 newActivationDelay = verification.activationDelay();
        assertEq(newActivationDelay, _activationDelay);
    }

    // Updating activation delay with invalid owner should fail
    function test_updateActivationDelay_invalidOwner(uint256 _activationDelay) public {
        try fakeAdmin.updateActivationDelayInVerification(verification, _activationDelay) {
            revert('Only owner can call this function');
        } catch Error(string memory reason) {
            assertEq(reason, 'Ownable: caller is not the owner');
        }
    }
}
