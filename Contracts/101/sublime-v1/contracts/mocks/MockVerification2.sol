// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

contract MockVerification2 {
    mapping(address => bool) public verifiers;
    mapping(address => mapping(address => bool)) public verifiedUsers;

    function isUser(address _user, address _verifier) public view returns (bool) {
        return verifiedUsers[_verifier][_user];
    }

    function verifyUser(address _user, address _verifier) public {
        if (verifiers[_verifier]) {
            verifiedUsers[_verifier][_user] = true;
        } else {
            verifiedUsers[_verifier][_user] = false;
        }
    }

    function unverifyUser(address _user) public {
        require(verifiers[msg.sender], 'Only authorized verifiers can unverify users');
        require(verifiedUsers[msg.sender][_user] == false, 'User either already unverified or was not verified by you');
        verifiedUsers[msg.sender][_user] = false;
    }

    function whitelistVerifier(address _verifier) public {
        verifiers[_verifier] = true;
    }
}
