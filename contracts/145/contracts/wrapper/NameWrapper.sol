//SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./ERC1155Fuse.sol";
import "./Controllable.sol";
import "./INameWrapper.sol";
import "./INameWrapperUpgrade.sol";
import "./IMetadataService.sol";
import "../registry/ENS.sol";
import "../ethregistrar/IBaseRegistrar.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./BytesUtil.sol";

error Unauthorised(bytes32 node, address addr);
error NameNotFound();
error IncompatibleParent();
error IncompatibleName(bytes name);
error IncorrectTokenType();
error LabelMismatch(bytes32 labelHash, bytes32 expectedLabelhash);
error LabelTooShort();
error LabelTooLong(string label);
error IncorrectTargetOwner(address owner);
error CannotUpgrade();
error InvalidExpiry(bytes32 node, uint64 expiry);

contract NameWrapper is
    Ownable,
    ERC1155Fuse,
    INameWrapper,
    Controllable,
    IERC721Receiver
{
    using BytesUtils for bytes;
    ENS public immutable override ens;
    IBaseRegistrar public immutable override registrar;
    IMetadataService public override metadataService;
    mapping(bytes32 => bytes) public override names;

    bytes32 private constant ETH_NODE =
        0x93cdeb708b7545dc668eb9280176169d1c33cfd8ed6f04690a0bcc88a93fc4ae;
    bytes32 private constant ROOT_NODE =
        0x0000000000000000000000000000000000000000000000000000000000000000;

    //A contract address to a new upgraded contract if any
    INameWrapperUpgrade public upgradeContract;
    uint64 private constant MAX_EXPIRY = type(uint64).max;

    constructor(
        ENS _ens,
        IBaseRegistrar _registrar,
        IMetadataService _metadataService
    ) {
        ens = _ens;
        registrar = _registrar;
        metadataService = _metadataService;

        /* Burn PARENT_CANNOT_CONTROL and CANNOT_UNWRAP fuses for ROOT_NODE and ETH_NODE */

        _setData(
            uint256(ETH_NODE),
            address(0),
            uint32(PARENT_CANNOT_CONTROL | CANNOT_UNWRAP),
            MAX_EXPIRY
        );
        _setData(
            uint256(ROOT_NODE),
            address(0),
            uint32(PARENT_CANNOT_CONTROL | CANNOT_UNWRAP),
            MAX_EXPIRY
        );
        names[ROOT_NODE] = "\x00";
        names[ETH_NODE] = "\x03eth\x00";
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC1155Fuse, IERC165)
        returns (bool)
    {
        return
            interfaceId == type(INameWrapper).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    /* ERC1155 */

    function ownerOf(uint256 id)
        public
        view
        override(ERC1155Fuse, INameWrapper)
        returns (address owner)
    {
        return super.ownerOf(id);
    }

    /* Metadata service */

    /**
     * @notice Set the metadata service. Only the owner can do this
     */

    function setMetadataService(IMetadataService _newMetadataService)
        public
        onlyOwner
    {
        metadataService = _newMetadataService;
    }

    /**
     * @notice Get the metadata uri
     * @return String uri of the metadata service
     */

    function uri(uint256 tokenId) public view override returns (string memory) {
        return metadataService.uri(tokenId);
    }

    /**
     * @notice Set the address of the upgradeContract of the contract. only admin can do this
     * @dev The default value of upgradeContract is the 0 address. Use the 0 address at any time
     * to make the contract not upgradable.
     * @param _upgradeAddress address of an upgraded contract
     */

    function setUpgradeContract(INameWrapperUpgrade _upgradeAddress)
        public
        onlyOwner
    {
        if (address(upgradeContract) != address(0)) {
            registrar.setApprovalForAll(address(upgradeContract), false);
            ens.setApprovalForAll(address(upgradeContract), false);
        }

        upgradeContract = _upgradeAddress;

        if (address(upgradeContract) != address(0)) {
            registrar.setApprovalForAll(address(upgradeContract), true);
            ens.setApprovalForAll(address(upgradeContract), true);
        }
    }

    /**
     * @notice Checks if msg.sender is the owner or approved by the owner of a name
     * @param node namehash of the name to check
     */

    modifier onlyTokenOwner(bytes32 node) {
        if (!isTokenOwnerOrApproved(node, msg.sender)) {
            revert Unauthorised(node, msg.sender);
        }

        _;
    }

    /**
     * @notice Checks if owner or approved by owner
     * @param node namehash of the name to check
     * @param addr which address to check permissions for
     * @return whether or not is owner or approved
     */

    function isTokenOwnerOrApproved(bytes32 node, address addr)
        public
        view
        override
        returns (bool)
    {
        address owner = ownerOf(uint256(node));
        return owner == addr || isApprovedForAll(owner, addr);
    }

    /**
     * @notice Gets fuse permissions for a specific name
     * @dev Fuses are represented by a uint32 where each permission is represented by 1 bit
     *      The interface has predefined fuses for all registry permissions, but additional
     *      fuses can be added for other use cases
     *      Also returns expiry, which is when the fuses are set to expire.
     * @param node namehash of the name to check
     * @return fuses A number that represents the permissions a name has. Returns 0 when expiry < block.timestamp
     * @return expiry Unix time of when the name expires and fuses are to expire
     */
    function getFuses(bytes32 node)
        public
        view
        override
        returns (uint32 fuses, uint64 expiry)
    {
        (, fuses, expiry) = getData(uint256(node));
        if (fuses == 0 && expiry == 0) {
            bytes memory name = names[node];
            if (name.length == 0) {
                revert NameNotFound();
            }
        }
    }

    /**
     * @notice Wraps a .eth domain, creating a new token and sending the original ERC721 token to this contract
     * @dev Can be called by the owner of the name on the .eth registrar or an authorised caller on the registrar
     * @param label label as a string of the .eth domain to wrap
     * @param wrappedOwner Owner of the name in this contract
     * @param fuses initial fuses to set
     * @param expiry when the fuses will expire
     * @param resolver resolver contract address
     */

    function wrapETH2LD(
        string calldata label,
        address wrappedOwner,
        uint32 fuses,
        uint64 expiry,
        address resolver
    ) public override returns (uint64) {
        uint256 tokenId = uint256(keccak256(bytes(label)));
        address registrant = registrar.ownerOf(tokenId);
        if (
            registrant != msg.sender &&
            !isApprovedForAll(registrant, msg.sender) &&
            !registrar.isApprovedForAll(registrant, msg.sender)
        ) {
            revert Unauthorised(
                _makeNode(ETH_NODE, bytes32(tokenId)),
                msg.sender
            );
        }

        // transfer the token from the user to this contract
        registrar.transferFrom(registrant, address(this), tokenId);

        // transfer the ens record back to the new owner (this contract)
        registrar.reclaim(tokenId, address(this));

        return _wrapETH2LD(label, wrappedOwner, fuses, expiry, resolver);
    }

    /**
     * @dev Registers a new .eth second-level domain and wraps it.
     *      Only callable by authorised controllers.
     * @param label The label to register (Eg, 'foo' for 'foo.eth').
     * @param wrappedOwner The owner of the wrapped name.
     * @param duration The duration, in seconds, to register the name for.
     * @param resolver The resolver address to set on the ENS registry (optional).
     * @param fuses initial fuses to set
     * @param expiry when the fuses will expire
     * @return registrarExpiry The expiry date of the new name on the .eth registrar, in seconds since the Unix epoch.
     */

    function registerAndWrapETH2LD(
        string calldata label,
        address wrappedOwner,
        uint256 duration,
        address resolver,
        uint32 fuses,
        uint64 expiry
    ) external override onlyController returns (uint256 registrarExpiry) {
        uint256 tokenId = uint256(keccak256(bytes(label)));
        registrarExpiry = registrar.register(tokenId, address(this), duration);
        _wrapETH2LD(label, wrappedOwner, fuses, expiry, resolver);
    }

    /**
     * @dev Renews a .eth second-level domain.
     *      Only callable by authorised controllers.
     * @param tokenId The hash of the label to register (eg, `keccak256('foo')`, for 'foo.eth').
     * @param duration The number of seconds to renew the name for.
     * @return expires The expiry date of the name on the .eth registrar, in seconds since the Unix epoch.
     */
    function renew(
        uint256 tokenId,
        uint256 duration,
        uint64 expiry
    ) external override onlyController returns (uint256 expires) {
        bytes32 node = _makeNode(ETH_NODE, bytes32(tokenId));

        expires = registrar.renew(tokenId, duration);
        (address owner, uint32 fuses, uint64 oldExpiry) = getData(
            uint256(node)
        );
        expiry = _normaliseExpiry(expiry, oldExpiry, uint64(expires));

        _setData(node, owner, fuses, expiry);
    }

    /**
     * @notice Wraps a non .eth domain, of any kind. Could be a DNSSEC name vitalik.xyz or a subdomain
     * @dev Can be called by the owner in the registry or an authorised caller in the registry
     * @param name The name to wrap, in DNS format
     * @param wrappedOwner Owner of the name in this contract
     * @param resolver resolver contract address
     */

    function wrap(
        bytes calldata name,
        address wrappedOwner,
        address resolver
    ) public override {
        (bytes32 labelhash, uint256 offset) = name.readLabel(0);
        bytes32 parentNode = name.namehash(offset);
        bytes32 node = _makeNode(parentNode, labelhash);

        if (parentNode == ETH_NODE) {
            revert IncompatibleParent();
        }

        address owner = ens.owner(node);

        if (
            owner != msg.sender &&
            !isApprovedForAll(owner, msg.sender) &&
            !ens.isApprovedForAll(owner, msg.sender)
        ) {
            revert Unauthorised(node, msg.sender);
        }

        if (resolver != address(0)) {
            ens.setResolver(node, resolver);
        }

        ens.setOwner(node, address(this));

        _wrap(node, name, wrappedOwner, 0, 0);
    }

    /**
     * @notice Unwraps a .eth domain. e.g. vitalik.eth
     * @dev Can be called by the owner in the wrapper or an authorised caller in the wrapper
     * @param labelhash labelhash of the .eth domain
     * @param newRegistrant sets the owner in the .eth registrar to this address
     * @param newController sets the owner in the registry to this address
     */

    function unwrapETH2LD(
        bytes32 labelhash,
        address newRegistrant,
        address newController
    ) public override onlyTokenOwner(_makeNode(ETH_NODE, labelhash)) {
        _unwrap(_makeNode(ETH_NODE, labelhash), newController);
        registrar.transferFrom(
            address(this),
            newRegistrant,
            uint256(labelhash)
        );
    }

    /**
     * @notice Unwraps a non .eth domain, of any kind. Could be a DNSSEC name vitalik.xyz or a subdomain
     * @dev Can be called by the owner in the wrapper or an authorised caller in the wrapper
     * @param parentNode parent namehash of the name e.g. vitalik.xyz would be namehash('xyz')
     * @param labelhash labelhash of the name, e.g. vitalik.xyz would be keccak256('vitalik')
     * @param newController sets the owner in the registry to this address
     */

    function unwrap(
        bytes32 parentNode,
        bytes32 labelhash,
        address newController
    ) public override onlyTokenOwner(_makeNode(parentNode, labelhash)) {
        if (parentNode == ETH_NODE) {
            revert IncompatibleParent();
        }
        _unwrap(_makeNode(parentNode, labelhash), newController);
    }

    /**
     * @notice Sets fuses of a name
     * @param node namehash of the name
     * @param fuses fuses to burn (cannot burn PARENT_CANOT_CONTROL)
     */

    function setFuses(bytes32 node, uint32 fuses)
        public
        onlyTokenOwner(node)
        operationAllowed(node, CANNOT_BURN_FUSES)
        returns (uint32)
    {
        if (fuses & PARENT_CANNOT_CONTROL != 0) {
            // Only the parent can burn the PARENT_CANNOT_CONTROL fuse.
            revert Unauthorised(node, msg.sender);
        }

        (address owner, uint32 oldFuses, uint64 expiry) = getData(
            uint256(node)
        );

        fuses |= oldFuses;
        _setFuses(node, owner, fuses, expiry);
        return fuses;
    }

    /**
     * @notice Upgrades a .eth wrapped domain by calling the wrapETH2LD function of the upgradeContract
     *     and burning the token of this contract
     * @dev Can be called by the owner of the name in this contract
     * @param label Label as a string of the .eth name to upgrade
     * @param wrappedOwner The owner of the wrapped name
     */

    function upgradeETH2LD(
        string calldata label,
        address wrappedOwner,
        address resolver
    ) public {
        bytes32 labelhash = keccak256(bytes(label));
        bytes32 node = _makeNode(ETH_NODE, labelhash);
        (uint32 fuses, uint64 expiry) = _prepareUpgrade(node);

        upgradeContract.wrapETH2LD(
            label,
            wrappedOwner,
            fuses,
            expiry,
            resolver
        );
    }

    /**
     * @notice Upgrades a non .eth domain of any kind. Could be a DNSSEC name vitalik.xyz or a subdomain
     * @dev Can be called by the owner or an authorised caller
     * Requires upgraded Namewrapper to permit old Namewrapper to call `setSubnodeRecord` for all names
     * @param parentNode namehash of the parent name
     * @param label Label as a string of the name to upgrade
     * @param wrappedOwner Owner of the name in this contract
     * @param resolver resolver contract for this name
     */

    function upgrade(
        bytes32 parentNode,
        string calldata label,
        address wrappedOwner,
        address resolver
    ) public {
        bytes32 labelhash = keccak256(bytes(label));
        bytes32 node = _makeNode(parentNode, labelhash);
        (uint32 fuses, uint64 expiry) = _prepareUpgrade(node);
        upgradeContract.setSubnodeRecord(
            parentNode,
            label,
            wrappedOwner,
            resolver,
            0,
            fuses,
            expiry
        );
    }

    /* @notice Sets fuses of a name that you own the parent of. Can also be called by the owner of a .eth name
     * @param parentNode parent namehash of the name e.g. vitalik.xyz would be namehash('xyz')
     * @param labelhash labelhash of the name, e.g. vitalik.xyz would be keccak256('vitalik')
     * @param fuses fuses to burn
     * @param expiry when the fuses will expire
     */

    function setChildFuses(
        bytes32 parentNode,
        bytes32 labelhash,
        uint32 fuses,
        uint64 expiry
    ) public {
        bytes32 node = _makeNode(parentNode, labelhash);
        (address owner, uint32 oldFuses, uint64 oldExpiry) = getData(
            uint256(node)
        );
        uint64 maxExpiry;
        if (parentNode == ETH_NODE) {
            if (!isTokenOwnerOrApproved(node, msg.sender)) {
                revert Unauthorised(node, msg.sender);
            }
            // max expiry is set to the expiry on the registrar
            maxExpiry = uint64(registrar.nameExpires(uint256(labelhash)));
        } else {
            if (!isTokenOwnerOrApproved(parentNode, msg.sender)) {
                revert Unauthorised(node, msg.sender);
            }

            // max expiry is set to the expiry of the parent
            (, , maxExpiry) = getData(uint256(parentNode));
        }

        expiry = _normaliseExpiry(expiry, oldExpiry, maxExpiry);

        // if PARENT_CANNOT_CONTROL has been burned and fuses have changed
        if (
            oldFuses & PARENT_CANNOT_CONTROL != 0 &&
            oldFuses | fuses != oldFuses
        ) {
            revert OperationProhibited(node);
        }
        fuses |= oldFuses;
        _setFuses(node, owner, fuses, expiry);
    }

    /**
     * @notice Sets the subdomain owner in the registry and then wraps the subdomain
     * @param parentNode parent namehash of the subdomain
     * @param label label of the subdomain as a string
     * @param newOwner newOwner in the registry
     * @param fuses initial fuses for the wrapped subdomain
     * @param expiry when the fuses will expire
     */

    function setSubnodeOwner(
        bytes32 parentNode,
        string calldata label,
        address newOwner,
        uint32 fuses,
        uint64 expiry
    )
        public
        onlyTokenOwner(parentNode)
        canCallSetSubnodeOwner(parentNode, keccak256(bytes(label)))
        returns (bytes32 node)
    {
        bytes32 labelhash = keccak256(bytes(label));
        node = _makeNode(parentNode, labelhash);
        (, , expiry) = _getDataAndNormaliseExpiry(parentNode, node, expiry);

        if (ens.owner(node) != address(this)) {
            ens.setSubnodeOwner(parentNode, labelhash, address(this));
            _addLabelAndWrap(parentNode, node, label, newOwner, fuses, expiry);
        } else {
            _transferAndBurnFuses(node, newOwner, fuses, expiry);
        }
    }

    /**
     * @notice Sets the subdomain owner in the registry with records and then wraps the subdomain
     * @param parentNode parent namehash of the subdomain
     * @param label label of the subdomain as a string
     * @param newOwner newOwner in the registry
     * @param resolver resolver contract in the registry
     * @param ttl ttl in the regsitry
     * @param fuses initial fuses for the wrapped subdomain
     * @param expiry expiry date for the domain
     */

    function setSubnodeRecord(
        bytes32 parentNode,
        string memory label,
        address newOwner,
        address resolver,
        uint64 ttl,
        uint32 fuses,
        uint64 expiry
    )
        public
        onlyTokenOwner(parentNode)
        canCallSetSubnodeOwner(parentNode, keccak256(bytes(label)))
    {
        bytes32 labelhash = keccak256(bytes(label));
        bytes32 node = _makeNode(parentNode, labelhash);
        (, , expiry) = _getDataAndNormaliseExpiry(parentNode, node, expiry);
        if (ens.owner(node) != address(this)) {
            ens.setSubnodeRecord(
                parentNode,
                labelhash,
                address(this),
                resolver,
                ttl
            );
            _addLabelAndWrap(parentNode, node, label, newOwner, fuses, expiry);
        } else {
            ens.setSubnodeRecord(
                parentNode,
                labelhash,
                address(this),
                resolver,
                ttl
            );
            _transferAndBurnFuses(node, newOwner, fuses, expiry);
        }
    }

    /**
     * @notice Sets records for the name in the ENS Registry
     * @param node namehash of the name to set a record for
     * @param owner newOwner in the registry
     * @param resolver the resolver contract
     * @param ttl ttl in the registry
     */

    function setRecord(
        bytes32 node,
        address owner,
        address resolver,
        uint64 ttl
    )
        public
        override
        onlyTokenOwner(node)
        operationAllowed(
            node,
            CANNOT_TRANSFER | CANNOT_SET_RESOLVER | CANNOT_SET_TTL
        )
    {
        ens.setRecord(node, address(this), resolver, ttl);
        (address oldOwner, , ) = getData(uint256(node));
        _transfer(oldOwner, owner, uint256(node), 1, "");
    }

    /**
     * @notice Sets resolver contract in the registry
     * @param node namehash of the name
     * @param resolver the resolver contract
     */

    function setResolver(bytes32 node, address resolver)
        public
        override
        onlyTokenOwner(node)
        operationAllowed(node, CANNOT_SET_RESOLVER)
    {
        ens.setResolver(node, resolver);
    }

    /**
     * @notice Sets TTL in the registry
     * @param node namehash of the name
     * @param ttl TTL in the registry
     */

    function setTTL(bytes32 node, uint64 ttl)
        public
        override
        onlyTokenOwner(node)
        operationAllowed(node, CANNOT_SET_TTL)
    {
        ens.setTTL(node, ttl);
    }

    /**
     * @dev Allows an operation only if none of the specified fuses are burned.
     * @param node The namehash of the name to check fuses on.
     * @param fuseMask A bitmask of fuses that must not be burned.
     */

    modifier operationAllowed(bytes32 node, uint32 fuseMask) {
        (, uint32 fuses, ) = getData(uint256(node));
        if (fuses & fuseMask != 0) {
            revert OperationProhibited(node);
        }
        _;
    }

    /**
     * @notice Check whether a name can call setSubnodeOwner/setSubnodeRecord
     * @dev Checks both canCreateSubdomain and canReplaceSubdomain and whether not they have been burnt
     *      and checks whether the owner of the subdomain is 0x0 for creating or already exists for
     *      replacing a subdomain. If either conditions are true, then it is possible to call
     *      setSubnodeOwner
     * @param node namehash of the name to check
     * @param labelhash labelhash of the name to check
     */

    modifier canCallSetSubnodeOwner(bytes32 node, bytes32 labelhash) {
        bytes32 subnode = _makeNode(node, labelhash);
        address owner = ens.owner(subnode);

        if (owner == address(0)) {
            (, uint32 fuses, ) = getData(uint256(node));
            if (fuses & CANNOT_CREATE_SUBDOMAIN != 0) {
                revert OperationProhibited(node);
            }
        } else {
            (, uint32 subnodeFuses, ) = getData(uint256(subnode));
            if (subnodeFuses & PARENT_CANNOT_CONTROL != 0) {
                revert OperationProhibited(node);
            }
        }

        _;
    }

    /**
     * @notice Checks all Fuses in the mask are burned for the node
     * @param node namehash of the name
     * @param fuseMask the fuses you want to check
     * @return Boolean of whether or not all the selected fuses are burned
     */

    function allFusesBurned(bytes32 node, uint32 fuseMask)
        public
        view
        override
        returns (bool)
    {
        (, uint32 fuses, ) = getData(uint256(node));
        return fuses & fuseMask == fuseMask;
    }

    function onERC721Received(
        address to,
        address,
        uint256 tokenId,
        bytes calldata data
    ) public override returns (bytes4) {
        //check if it's the eth registrar ERC721
        if (msg.sender != address(registrar)) {
            revert IncorrectTokenType();
        }

        (
            string memory label,
            address owner,
            uint32 fuses,
            uint64 expiry,
            address resolver
        ) = abi.decode(data, (string, address, uint32, uint64, address));

        bytes32 labelhash = bytes32(tokenId);
        bytes32 labelhashFromData = keccak256(bytes(label));

        if (labelhashFromData != labelhash) {
            revert LabelMismatch(labelhashFromData, labelhash);
        }

        // transfer the ens record back to the new owner (this contract)
        registrar.reclaim(uint256(labelhash), address(this));

        _wrapETH2LD(label, owner, fuses, expiry, resolver);

        return IERC721Receiver(to).onERC721Received.selector;
    }

    /***** Internal functions */

    function _canTransfer(uint32 fuses) internal pure override returns (bool) {
        return fuses & CANNOT_TRANSFER == 0;
    }

    function _makeNode(bytes32 node, bytes32 labelhash)
        private
        pure
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(node, labelhash));
    }

    function _addLabel(string memory label, bytes memory name)
        internal
        pure
        returns (bytes memory ret)
    {
        if (bytes(label).length < 1) {
            revert LabelTooShort();
        }
        if (bytes(label).length > 255) {
            revert LabelTooLong(label);
        }
        return abi.encodePacked(uint8(bytes(label).length), label, name);
    }

    function _mint(
        bytes32 node,
        address wrappedOwner,
        uint32 fuses,
        uint64 expiry
    ) internal override {
        address oldWrappedOwner = ownerOf(uint256(node));
        _canFusesBeBurned(node, fuses);
        if (oldWrappedOwner != address(0)) {
            // burn and unwrap old token of old owner
            _burn(uint256(node));
            emit NameUnwrapped(node, address(0));
        }
        super._mint(node, wrappedOwner, fuses, expiry);
    }

    function _wrap(
        bytes32 node,
        bytes memory name,
        address wrappedOwner,
        uint32 fuses,
        uint64 expiry
    ) internal {
        names[node] = name;
        _mint(node, wrappedOwner, fuses, expiry);
        emit NameWrapped(node, name, wrappedOwner, fuses, expiry);
    }

    function _addLabelAndWrap(
        bytes32 parentNode,
        bytes32 node,
        string memory label,
        address newOwner,
        uint32 fuses,
        uint64 expiry
    ) internal {
        bytes memory name = _addLabel(label, names[parentNode]);
        _wrap(node, name, newOwner, fuses, expiry);
    }

    function _prepareUpgrade(bytes32 node)
        private
        returns (uint32 fuses, uint64 expiry)
    {
        if (address(upgradeContract) == address(0)) {
            revert CannotUpgrade();
        }

        if (!isTokenOwnerOrApproved(node, msg.sender)) {
            revert Unauthorised(node, msg.sender);
        }

        (fuses, expiry) = getFuses(node);

        // burn token and fuse data
        _burn(uint256(node));
    }

    function _transferAndBurnFuses(
        bytes32 node,
        address newOwner,
        uint32 fuses,
        uint64 expiry
    ) internal {
        (address owner, , ) = getData(uint256(node));
        _transfer(owner, newOwner, uint256(node), 1, "");
        _setFuses(node, newOwner, fuses, expiry);
    }

    // wrapper function for stack limit
    function _getDataAndNormaliseExpiry(
        bytes32 parentNode,
        bytes32 node,
        uint64 expiry
    )
        internal
        view
        returns (
            address owner,
            uint32 fuses,
            uint64
        )
    {
        uint64 oldExpiry;
        (owner, fuses, oldExpiry) = getData(uint256(node));
        (, , uint64 maxExpiry) = getData(uint256(parentNode));

        expiry = _normaliseExpiry(expiry, oldExpiry, maxExpiry);
        return (owner, fuses, expiry);
    }

    function _getETH2LDDataAndNormaliseExpiry(
        bytes32 node,
        bytes32 labelhash,
        uint64 expiry
    )
        internal
        view
        returns (
            address owner,
            uint32 fuses,
            uint64
        )
    {
        uint64 oldExpiry;
        (owner, fuses, oldExpiry) = getData(uint256(node));
        uint64 maxExpiry = uint64(registrar.nameExpires(uint256(labelhash)));

        expiry = _normaliseExpiry(expiry, oldExpiry, maxExpiry);
        return (owner, fuses, expiry);
    }

    function _normaliseExpiry(
        uint64 expiry,
        uint64 oldExpiry,
        uint64 maxExpiry
    ) internal pure returns (uint64) {
        // Expiry cannot be more than maximum allowed
        // .eth names will check registrar, non .eth check parent
        if (expiry > maxExpiry) {
            expiry = maxExpiry;
        }
        // Expiry cannot be less than old expiry
        if (expiry < oldExpiry) {
            expiry = oldExpiry;
        }

        return expiry;
    }

    function _wrapETH2LD(
        string memory label,
        address wrappedOwner,
        uint32 fuses,
        uint64 expiry,
        address resolver
    ) private returns (uint64) {
        // Mint a new ERC1155 token with fuses
        // Set PARENT_CANNOT_REPLACE to reflect wrapper + registrar control over the 2LD
        bytes32 labelhash = keccak256(bytes(label));
        bytes32 node = _makeNode(ETH_NODE, labelhash);

        (, , expiry) = _getETH2LDDataAndNormaliseExpiry(
            node,
            labelhash,
            expiry
        );

        _addLabelAndWrap(
            ETH_NODE,
            node,
            label,
            wrappedOwner,
            fuses | PARENT_CANNOT_CONTROL,
            expiry
        );
        if (resolver != address(0)) {
            ens.setResolver(node, resolver);
        }

        return expiry;
    }

    function _unwrap(bytes32 node, address newOwner) private {
        if (newOwner == address(0x0) || newOwner == address(this)) {
            revert IncorrectTargetOwner(newOwner);
        }

        if (allFusesBurned(node, CANNOT_UNWRAP)) {
            revert OperationProhibited(node);
        }

        // Burn token and fuse data
        _burn(uint256(node));
        ens.setOwner(node, newOwner);

        emit NameUnwrapped(node, newOwner);
    }

    function _setFuses(
        bytes32 node,
        address owner,
        uint32 fuses,
        uint64 expiry
    ) internal {
        _setData(node, owner, fuses, expiry);
        emit FusesSet(node, fuses, expiry);
    }

    function _setData(
        bytes32 node,
        address owner,
        uint32 fuses,
        uint64 expiry
    ) internal {
        _canFusesBeBurned(node, fuses);
        super._setData(uint256(node), owner, fuses, expiry);
    }

    function _canFusesBeBurned(bytes32 node, uint32 fuses) internal pure {
        if (
            fuses & ~PARENT_CANNOT_CONTROL != 0 &&
            fuses & (PARENT_CANNOT_CONTROL | CANNOT_UNWRAP) !=
            (PARENT_CANNOT_CONTROL | CANNOT_UNWRAP)
        ) {
            revert OperationProhibited(node);
        }
    }
}
