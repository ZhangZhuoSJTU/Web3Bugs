// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "../escrow/NFTEscrow.sol";
import "../interfaces/ICryptoPunks.sol";

 /// @title CryptoPunks NFTVault helper contract
 /// @notice Allows compatibility between CryptoPunks and {NFTVault}
 /// @dev CryptoPunks IERC721 compatibility.
 /// Meant to only be used by {NFTVault}.
 /// This contract is NOT an ERC721 wrapper for punks and is not meant to implement the ERC721 interface fully, 
 /// its only purpose is to serve as a proxy between {NFTVault} and CryptoPunks.
 /// The owner is {NFTVault}
contract CryptoPunksHelper is NFTEscrow, OwnableUpgradeable {

    /// @param punksAddress Address of the CryptoPunks contract
    function initialize(address punksAddress) external initializer {
        __NFTEscrow_init(punksAddress);
        __Ownable_init();
    }

    /// @notice Returns the owner of the punk at index `_idx`
    /// @dev If the owner of the punk is this contract we return the address of the {NFTVault} for compatibility
    /// @param _idx The punk index
    /// @return The owner of the punk if != `address(this)`, otherwise the the owner of this contract
    function ownerOf(uint256 _idx) external view returns (address) {
        address account = ICryptoPunks(nftAddress).punkIndexToAddress(_idx);

        return account == address(this) ? owner() : account;
    }

    /// @notice Function called by {NFTVault} to transfer punks. Can only be called by the owner
    /// @param _from The sender address
    /// @param _to The recipient address
    /// @param _idx The index of the punk to transfer
    function transferFrom(
        address _from,
        address _to,
        uint256 _idx
    ) external onlyOwner {
        _transferFrom(_from, _to, _idx);
    }

    /// @dev We aren't calling {onERC721Received} on the _to address because punks don't implement
    /// the {ERC721} interface, but we are including this function for compatibility with the {NFTVault} contract.
    /// Calling the {onERC721Received} function on the receiver contract could cause problems as we aren't sending an ERC721.
    /// @param _from The sender address
    /// @param _to The recipient address
    /// @param _idx The index of the punk to transfer
    function safeTransferFrom(
        address _from,
        address _to,
        uint256 _idx
    ) external onlyOwner {
        _transferFrom(_from, _to, _idx);
    }

    /// @dev Implementation of {transferFrom} and {safeTransferFrom}. We are using {NFTEscrow} for atomic transfers.
    /// See {NFTEscrow} for more info
    /// @param _from The sender address
    /// @param _to The recipient address
    /// @param _idx The index of the punk to transfer
    function _transferFrom(
        address _from,
        address _to,
        uint256 _idx
    ) internal {
        ICryptoPunks punks = ICryptoPunks(nftAddress);

        address account = punks.punkIndexToAddress(_idx);

        //if the owner is this address we don't need to go through {NFTEscrow}
        if (account != address(this)) {
            _executeTransfer(_from, _idx);
        }

        require(
            punks.punkIndexToAddress(_idx) == address(this), //this should never be false
            "CryptoPunksHelper: not_deposited"
        );

        //If _to is the owner ({NFTVault}), we aren't sending the punk
        //since we'd have no way to get it back
        if (_to != owner()) punks.transferPunk(_to, _idx);
    }

    /// @dev Prevent the owner from renouncing ownership. Having no owner would render this contract unusable
    function renounceOwnership() public view override onlyOwner {
        revert("Cannot renounce ownership");
    }

    /// @dev The {transferPunk} function is used as the escrow's payload.
    /// @param _idx The index of the punk that's going to be transferred using {NFTEscrow}
    function _encodeFlashEscrowPayload(uint256 _idx)
        internal
        view
        override
        returns (bytes memory)
    {
        return
            abi.encodeWithSignature(
                "transferPunk(address,uint256)",
                address(this),
                _idx
            );
    }
}
