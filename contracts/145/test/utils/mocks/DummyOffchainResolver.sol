// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "../../../contracts/resolvers/profiles/IExtendedResolver.sol";

error OffchainLookup(
    address sender,
    string[] urls,
    bytes callData,
    bytes4 callbackFunction,
    bytes extraData
);

contract DummyOffchainResolver is IExtendedResolver, ERC165 {
    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override
        returns (bool)
    {
        return
            interfaceId == type(IExtendedResolver).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    function resolve(
        bytes calldata, /* name */
        bytes calldata data
    ) external view returns (bytes memory, address) {
        string[] memory urls = new string[](1);
        urls[0] = "https://example.com/";
        revert OffchainLookup(
            address(this),
            urls,
            data,
            DummyOffchainResolver.resolveCallback.selector,
            data
        );
    }

    function resolveCallback(bytes calldata response, bytes calldata extraData)
        external
        view
        returns (bytes memory)
    {
        require(
            keccak256(response) == keccak256(extraData),
            "Response data error"
        );
        return abi.encode(address(this));
    }
}
