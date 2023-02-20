// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "../escrow/NFTEscrow.sol";
import "../interfaces/IEtherRocks.sol";

 /// @title EtherRocks NFTVault helper contract
 /// @notice Allows compatibility between EtherRocks and {NFTVault}
 /// @dev EtherRocks IERC721 compatibility.
 /// Meant to only be used by {NFTVault}.
 /// This contract is NOT an ERC721 wrapper for rocks and is not meant to implement the ERC721 interface fully, 
 /// its only purpose is to serve as a proxy between {NFTVault} and EtherRocks.
 /// The owner is {NFTVault}
contract EtherRocksHelper is NFTEscrow, OwnableUpgradeable {

    /// @param rocksAddress Address of the EtherRocks contract
    function initialize(address rocksAddress) external initializer {
        __NFTEscrow_init(rocksAddress);
        __Ownable_init();
    }

    /// @notice Returns the owner of the rock at index `_idx`
    /// @dev If the owner of the rock is this contract we return the address of the {NFTVault} for compatibility
    /// @param _idx The rock index
    /// @return The owner of the rock if != `address(this)`, otherwise the the owner of this contract
    function ownerOf(uint256 _idx) external view returns (address) {
        (address account,,,) = IEtherRocks(nftAddress).getRockInfo(_idx);

        return account == address(this) ? owner() : account;
    }

    /// @notice Function called by {NFTVault} to transfer rocks. Can only be called by the owner
    /// @param _from The sender address
    /// @param _to The recipient address
    /// @param _idx The index of the rock to transfer
    function transferFrom(
        address _from,
        address _to,
        uint256 _idx
    ) external onlyOwner {
        _transferFrom(_from, _to, _idx);
    }

    /// @dev We aren't calling {onERC721Received} on the _to address because rocks don't implement
    /// the {ERC721} interface, but we are including this function for compatibility with the {NFTVault} contract.
    /// Calling the {onERC721Received} function on the receiver contract could cause problems as we aren't sending an ERC721.
    /// @param _from The sender address
    /// @param _to The recipient address
    /// @param _idx The index of the rock to transfer
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
    /// @param _idx The index of the rock to transfer
    function _transferFrom(
        address _from,
        address _to,
        uint256 _idx
    ) internal {
        IEtherRocks rocks = IEtherRocks(nftAddress);

        (address account,,,) = rocks.getRockInfo(_idx);

        //if the owner is this address we don't need to go through {NFTEscrow}
        if (account != address(this)) {
            _executeTransfer(_from, _idx);
        }

        (address newOwner,,,) = rocks.getRockInfo(_idx);

        require(
            newOwner == address(this), //this should never be false
            "EtherRocksHelper: not_deposited"
        );

        //remove rock from sale
        rocks.dontSellRock(_idx);

        //If _to is the owner ({NFTVault}), we aren't sending the rock
        //since we'd have no way to get it back
        if (_to != owner()) rocks.giftRock(_idx, _to);
    }

    /// @dev Prevent the owner from renouncing ownership. Having no owner would render this contract unusable
    function renounceOwnership() public view override onlyOwner {
        revert("Cannot renounce ownership");
    }

    /// @dev The {giftRock} function is used as the escrow's payload.
    /// @param _idx The index of the rock that's going to be transferred using {NFTEscrow}
    function _encodeFlashEscrowPayload(uint256 _idx)
        internal
        view
        override
        returns (bytes memory)
    {
        return
            abi.encodeWithSignature(
                "giftRock(uint256,address)",
                _idx,
                address(this)
            );
    }
}
