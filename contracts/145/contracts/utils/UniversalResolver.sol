// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {ERC165} from "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {LowLevelCallUtils} from "./LowLevelCallUtils.sol";
import {ENS} from "../registry/ENS.sol";
import {IExtendedResolver} from "../resolvers/profiles/IExtendedResolver.sol";
import {Resolver, INameResolver, IAddrResolver} from "../resolvers/Resolver.sol";
import {NameEncoder} from "./NameEncoder.sol";
import {BytesUtils} from "../wrapper/BytesUtil.sol";

error OffchainLookup(
    address sender,
    string[] urls,
    bytes callData,
    bytes4 callbackFunction,
    bytes extraData
);

/**
 * The Universal Resolver is a contract that handles the work of resolving a name entirely onchain,
 * making it possible to make a single smart contract call to resolve an ENS name.
 */
contract UniversalResolver is IExtendedResolver, ERC165 {
    using Address for address;
    using NameEncoder for string;
    using BytesUtils for bytes;

    ENS public immutable registry;

    constructor(address _registry) {
        registry = ENS(_registry);
    }

    /**
     * @dev Performs ENS name resolution for the supplied name and resolution data.
     * @param name The name to resolve, in normalised and DNS-encoded form.
     * @param data The resolution data, as specified in ENSIP-10.
     * @return The result of resolving the name.
     */
    function resolve(bytes calldata name, bytes memory data)
        external
        view
        override
        returns (bytes memory, address)
    {
        (Resolver resolver, ) = findResolver(name);
        if (address(resolver) == address(0)) {
            return ("", address(0));
        }

        try
            resolver.supportsInterface(type(IExtendedResolver).interfaceId)
        returns (bool supported) {
            if (supported) {
                return (
                    callWithOffchainLookupPropagation(
                        address(resolver),
                        abi.encodeCall(IExtendedResolver.resolve, (name, data)),
                        UniversalResolver.resolveCallback.selector
                    ),
                    address(resolver)
                );
            }
        } catch {}
        return (
            callWithOffchainLookupPropagation(
                address(resolver),
                data,
                UniversalResolver.resolveCallback.selector
            ),
            address(resolver)
        );
    }

    /**
     * @dev Performs ENS name reverse resolution for the supplied reverse name.
     * @param reverseName The reverse name to resolve, in normalised and DNS-encoded form. e.g. b6E040C9ECAaE172a89bD561c5F73e1C48d28cd9.addr.reverse
     * @return The resolved name, the resolved address, the reverse resolver address, and the resolver address.
     */
    function reverse(bytes calldata reverseName)
        external
        view
        returns (
            string memory,
            address,
            address,
            address
        )
    {
        (
            bytes memory resolvedReverseData,
            address reverseResolverAddress
        ) = this.resolve(
                reverseName,
                abi.encodeCall(INameResolver.name, reverseName.namehash(0))
            );

        string memory resolvedName = abi.decode(resolvedReverseData, (string));

        (bytes memory encodedName, bytes32 namehash) = resolvedName
            .dnsEncodeName();

        (bytes memory resolvedData, address resolverAddress) = this.resolve(
            encodedName,
            abi.encodeCall(IAddrResolver.addr, namehash)
        );

        address resolvedAddress = abi.decode(resolvedData, (address));

        return (
            resolvedName,
            resolvedAddress,
            reverseResolverAddress,
            resolverAddress
        );
    }

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

    /**
     * @dev Makes a call to `target` with `data`. If the call reverts with an `OffchainLookup` error, wraps
     *      the error with the data necessary to continue the request where it left off.
     * @param target The address to call.
     * @param data The data to call `target` with.
     * @param callbackFunction The function ID of a function on this contract to use as an EIP 3668 callback.
     *        This function's `extraData` argument will be passed `(address target, bytes4 innerCallback, bytes innerExtraData)`.
     * @return ret If `target` did not revert, contains the return data from the call to `target`.
     */
    function callWithOffchainLookupPropagation(
        address target,
        bytes memory data,
        bytes4 callbackFunction
    ) internal view returns (bytes memory ret) {
        bool result = LowLevelCallUtils.functionStaticCall(target, data);
        uint256 size = LowLevelCallUtils.returnDataSize();

        if (result) {
            return LowLevelCallUtils.readReturnData(0, size);
        }

        // Failure
        if (size >= 4) {
            bytes memory errorId = LowLevelCallUtils.readReturnData(0, 4);
            if (bytes4(errorId) == OffchainLookup.selector) {
                // Offchain lookup. Decode the revert message and create our own that nests it.
                bytes memory revertData = LowLevelCallUtils.readReturnData(
                    4,
                    size - 4
                );
                (
                    address sender,
                    string[] memory urls,
                    bytes memory callData,
                    bytes4 innerCallbackFunction,
                    bytes memory extraData
                ) = abi.decode(
                        revertData,
                        (address, string[], bytes, bytes4, bytes)
                    );
                if (sender == target) {
                    revert OffchainLookup(
                        address(this),
                        urls,
                        callData,
                        callbackFunction,
                        abi.encode(sender, innerCallbackFunction, extraData)
                    );
                }
            }
        }

        LowLevelCallUtils.propagateRevert();
    }

    /**
     * @dev Callback function for `resolve`.
     * @param response Response data returned by the target address that invoked the inner `OffchainData` revert.
     * @param extraData Extra data encoded by `callWithOffchainLookupPropagation` to allow completing the request.
     */
    function resolveCallback(bytes calldata response, bytes calldata extraData)
        external
        view
        returns (bytes memory)
    {
        (
            address target,
            bytes4 innerCallbackFunction,
            bytes memory innerExtraData
        ) = abi.decode(extraData, (address, bytes4, bytes));
        return
            abi.decode(
                target.functionStaticCall(
                    abi.encodeWithSelector(
                        innerCallbackFunction,
                        response,
                        innerExtraData
                    )
                ),
                (bytes)
            );
    }

    /**
     * @dev Finds a resolver by recursively querying the registry, starting at the longest name and progressively
     *      removing labels until it finds a result.
     * @param name The name to resolve, in DNS-encoded and normalised form.
     * @return The Resolver responsible for this name, and the namehash of the full name.
     */
    function findResolver(bytes calldata name)
        public
        view
        returns (Resolver, bytes32)
    {
        (address resolver, bytes32 labelhash) = findResolver(name, 0);
        return (Resolver(resolver), labelhash);
    }

    function findResolver(bytes calldata name, uint256 offset)
        internal
        view
        returns (address, bytes32)
    {
        uint256 labelLength = uint256(uint8(name[offset]));
        if (labelLength == 0) {
            return (address(0), bytes32(0));
        }
        uint256 nextLabel = offset + labelLength + 1;
        bytes32 labelHash = keccak256(name[offset + 1:nextLabel]);
        (address parentresolver, bytes32 parentnode) = findResolver(
            name,
            nextLabel
        );
        bytes32 node = keccak256(abi.encodePacked(parentnode, labelHash));
        address resolver = registry.resolver(node);
        if (resolver != address(0)) {
            return (resolver, node);
        }
        return (parentresolver, node);
    }
}
