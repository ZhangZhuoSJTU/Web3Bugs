// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

//inspired by https://github.com/thousandetherhomepage/ketherhomepage/blob/master/contracts/KetherNFT.sol
/// @title FlashEscrow contract 
/// @notice This contract sends and receives non ERC721 NFTs
/// @dev Deployed for each NFT, its address is calculated by {NFTEscrow} prior to it being deployed to allow atomic non ERC721 transfers 
contract FlashEscrow {

    /// @dev The contract selfdestructs in the constructor, its only purpose is to perform one call to the `target` address using `payload` as the payload
    /// @param target The call recipient
    /// @param payload The payload to use for the call
    constructor(address target, bytes memory payload) {
        (bool success, ) = target.call(payload);
        require(success, "FlashEscrow: call_failed");

        selfdestruct(payable(target));
    }
}

/// @title Escrow contract for non ERC721 NFTs
/// @notice Handles atomic non ERC721 NFT transfers by using {FlashEscrow}
/// @dev NFTEscrow allows an atomic, 2 step mechanism to transfer non ERC721 NFTs without requiring prior reservation.
/// - Users send the NFT to a precomputed address (calculated using the owner's address as salt) that can be fetched by calling the `precompute` function
/// - The child contract can then call the `_executeTransfer` function to deploy an instance of the {FlashEscrow} contract, deployed at the address calculated in the previous step
/// This allows atomic transfers, as the address calculated by the `precompute` function is unique and changes depending by the `_owner` address and the NFT index (`_idx`).
/// This is an alternative to the classic "reservation" method, which requires users to call 3 functions in a specifc order (making the process non atomic)
abstract contract NFTEscrow is Initializable {
    /// @notice The address of the non ERC721 NFT supported by the child contract
    address public nftAddress;

    /// @dev Initializer function, see https://docs.openzeppelin.com/upgrades-plugins/1.x/writing-upgradeable
    /// @param _nftAddress See `nftAddress`
    function __NFTEscrow_init(address _nftAddress) internal initializer {
        nftAddress = _nftAddress;
    }

    /// @dev Computes the bytecode of the {FlashEscrow} instance to deploy
    /// @param _idx The index of the NFT that's going to be sent to the {FlashEscrow} instance
    /// @return The bytecode of the {FlashEscrow} instance relative to the NFT at index `_idx`
    function _encodeFlashEscrow(uint256 _idx)
        internal
        view
        returns (bytes memory)
    {
        return
            abi.encodePacked(
                type(FlashEscrow).creationCode,
                abi.encode(nftAddress, _encodeFlashEscrowPayload(_idx))
            );
    }

    /// @dev Virtual function, should return the `payload` to use in {FlashEscrow}'s constructor
    /// @param _idx The index of the NFT that's going to be sent to the {FlashEscrow} instance
    function _encodeFlashEscrowPayload(uint256 _idx)
        internal
        view
        virtual
        returns (bytes memory);

    /// @dev Deploys a {FlashEscrow} instance relative to owner `_owner` and index `_idx`
    /// @param _owner The owner of the NFT at index `_idx`
    /// @param _idx The index of the NFT owned by `_owner` 
    function _executeTransfer(address _owner, uint256 _idx) internal {
        (bytes32 salt, ) = precompute(_owner, _idx);
        new FlashEscrow{salt: salt}(
            nftAddress,
            _encodeFlashEscrowPayload(_idx)
        );
    }

    /// @notice This function returns the address where user `_owner` should send the `_idx` NFT to
    /// @dev `precompute` computes the salt and the address relative to NFT at index `_idx` owned by `_owner`
    /// @param _owner The owner of the NFT at index `_idx`
    /// @param _idx The index of the NFT owner by `_owner`
    /// @return salt The salt that's going to be used to deploy the {FlashEscrow} instance
    /// @return predictedAddress The address where the {FlashEscrow} instance relative to `_owner` and `_idx` will be deployed to
    function precompute(address _owner, uint256 _idx)
        public
        view
        returns (bytes32 salt, address predictedAddress)
    {
        require(
            _owner != address(this) && _owner != address(0),
            "NFTEscrow: invalid_owner"
        );

        salt = sha256(abi.encodePacked(_owner));

        bytes memory bytecode = _encodeFlashEscrow(_idx);

        //hash from which the contract address can be derived
        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0xff),
                address(this),
                salt,
                keccak256(bytecode)
            )
        );

        predictedAddress = address(uint160(uint256(hash)));
        return (salt, predictedAddress);
    }

    uint256[50] private __gap;
}
