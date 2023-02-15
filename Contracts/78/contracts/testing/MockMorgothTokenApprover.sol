// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;
import "../facades/MorgothTokenApproverLike.sol";

contract MockMorgothTokenApprover is MorgothTokenApproverLike {
    mapping(address => bool) public approvedTokens;

    function toggleManyTokens(address[] memory tokens, bool value) public {
        for (uint256 i = 0; i < tokens.length; i++) approvedTokens[tokens[i]] = value;
    }

    function addToken(address token) public {
        approvedTokens[token] = true;
    }

    function removeToken(address token) public {
        approvedTokens[token] = false;
    }

    function approved(address token) public view override returns (bool) {
        return approvedTokens[token];
    }
}
