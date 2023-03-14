pragma solidity ^0.8.4;

import "../BytesUtil.sol";
import "../INameWrapper.sol";
import "../../registry/ENS.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";

contract NameGriefer is IERC1155Receiver {
    using BytesUtils for *;

    ENS public immutable ens;
    INameWrapper public immutable wrapper;

    constructor(INameWrapper _wrapper) {
        wrapper = _wrapper;
        ENS _ens = _wrapper.ens();
        ens = _ens;
        _ens.setApprovalForAll(address(_wrapper), true);
    }

    function destroy(bytes calldata name) public {
        wrapper.wrap(name, address(this), address(0));
    }

    function onERC1155Received(
        address operator,
        address from,
        uint256 id,
        uint256,
        bytes calldata
    ) external override returns (bytes4) {
        require(operator == address(this), "Operator must be us");
        require(from == address(0), "Token must be new");

        // Unwrap the name
        bytes memory name = wrapper.names(bytes32(id));
        (bytes32 labelhash, uint256 offset) = name.readLabel(0);
        bytes32 parentNode = name.namehash(offset);
        wrapper.unwrap(parentNode, labelhash, address(this));

        // Here we can do something with the name before it's permanently burned, like
        // set the resolver or create subdomains.

        return NameGriefer.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address,
        address,
        uint256[] calldata,
        uint256[] calldata,
        bytes calldata
    ) external override returns (bytes4) {
        return NameGriefer.onERC1155BatchReceived.selector;
    }

    function supportsInterface(bytes4 interfaceID)
        external
        view
        override
        returns (bool)
    {
        return
            interfaceID == 0x01ffc9a7 || // ERC-165 support (i.e. `bytes4(keccak256('supportsInterface(bytes4)'))`).
            interfaceID == 0x4e2312e0; // ERC-1155 `ERC1155TokenReceiver` support (i.e. `bytes4(keccak256("onERC1155Received(address,address,uint256,uint256,bytes)")) ^ bytes4(keccak256("onERC1155BatchReceived(address,address,uint256[],uint256[],bytes)"))`).
    }
}
