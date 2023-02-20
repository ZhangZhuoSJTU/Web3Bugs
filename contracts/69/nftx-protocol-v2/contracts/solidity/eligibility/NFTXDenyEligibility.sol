// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./NFTXUniqueEligibility.sol";

contract NFTXDenyEligibility is NFTXUniqueEligibility {

    function name() public pure override virtual returns (string memory) {    
        return "Deny";
    }

    function _checkIfEligible(
        uint256 _tokenId
    ) internal view override virtual returns (bool) {
        return !isUniqueEligible(_tokenId);
    }

    function afterRedeemHook(uint256[] calldata tokenIds) external override virtual {
        require(msg.sender == vault);
        if (negateEligOnRedeem) {
            // Reversing eligibility to true here so they're added to the deny list.
            _setUniqueEligibilities(tokenIds, true);
        }
    }
}
