// SPDX-License-Identifier: MIT

pragma solidity 0.8.9;

import { MintableCappedERC20 } from './MintableCappedERC20.sol';
import { DepositHandler } from './DepositHandler.sol';
import { EternalStorage } from './EternalStorage.sol';

contract BurnableMintableCappedERC20 is MintableCappedERC20 {
    // keccak256('token-frozen')
    bytes32 private constant PREFIX_TOKEN_FROZEN =
        bytes32(0x1a7261d3a36c4ce4235d10859911c9444a6963a3591ec5725b96871d9810626b);

    // keccak256('all-tokens-frozen')
    bytes32 private constant KEY_ALL_TOKENS_FROZEN =
        bytes32(0x75a31d1ce8e5f9892188befc328d3b9bd3fa5037457e881abc21f388471b8d96);

    event Frozen(address indexed owner);
    event Unfrozen(address indexed owner);

    constructor(
        string memory name,
        string memory symbol,
        uint8 decimals,
        uint256 capacity
    ) MintableCappedERC20(name, symbol, decimals, capacity) {}

    function depositAddress(bytes32 salt) public view returns (address) {
        /* Convert a hash which is bytes32 to an address which is 20-byte long
        according to https://docs.soliditylang.org/en/v0.8.1/control-structures.html?highlight=create2#salted-contract-creations-create2 */
        return
            address(
                uint160(
                    uint256(
                        keccak256(
                            abi.encodePacked(
                                bytes1(0xff),
                                owner,
                                salt,
                                keccak256(abi.encodePacked(type(DepositHandler).creationCode))
                            )
                        )
                    )
                )
            );
    }

    function burn(bytes32 salt) public onlyOwner {
        address account = depositAddress(salt);
        _burn(account, balanceOf[account]);
    }

    function _beforeTokenTransfer(
        address,
        address,
        uint256
    ) internal view override {
        require(!EternalStorage(owner).getBool(KEY_ALL_TOKENS_FROZEN), 'IS_FROZEN');
        require(!EternalStorage(owner).getBool(keccak256(abi.encodePacked(PREFIX_TOKEN_FROZEN, symbol))), 'IS_FROZEN');
    }
}
