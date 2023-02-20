// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./NFTXEligibility.sol";

interface IPolymorph {
    function geneOf(uint256 tokenId) external view returns (uint256 gene);
    function lastTokenId() external view returns (uint256 tokenId);
}

contract NFTXUglyEligibility is NFTXEligibility {
    function name() public pure override virtual returns (string memory) {
        return "Ugly";
    }

    function finalized() public view override virtual returns (bool) {
        return true;
    }

    function targetAsset() public pure override virtual returns (address) {
        return 0x06012c8cf97BEaD5deAe237070F9587f8E7A266d;
    }

    event NFTXEligibilityInit();

    function __NFTXEligibility_init_bytes(
        bytes memory /* configData */
    ) public override virtual initializer {
        __NFTXEligibility_init();
    }

    // Parameters here should mirror the config struct.
    function __NFTXEligibility_init() public initializer {
        emit NFTXEligibilityInit();
    }

    function _checkIfEligible(uint256 _tokenId)
        internal
        view
        override
        virtual
        returns (bool)
    {
        uint256 gene = IPolymorph(targetAsset())
            .geneOf(_tokenId);
        return gene == 0;
    }
}
