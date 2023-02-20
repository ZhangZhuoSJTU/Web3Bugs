// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
import "@boringcrypto/boring-solidity/contracts/BoringMultipleNFT.sol";

contract ERC721Mock is BoringMultipleNFT {
    function mint(address owner) public returns (uint256 id) {
        id = totalSupply;
        _mint(owner, 0);
    }

    function _tokenURI(uint256) internal view override returns (string memory) {
        return "";
    }
}
