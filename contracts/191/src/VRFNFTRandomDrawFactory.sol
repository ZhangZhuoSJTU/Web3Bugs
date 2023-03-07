// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import {IERC721EnumerableUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/IERC721EnumerableUpgradeable.sol";
import {ClonesUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/ClonesUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "./ownable/OwnableUpgradeable.sol";
import {IVRFNFTRandomDrawFactory} from "./interfaces/IVRFNFTRandomDrawFactory.sol";
import {IVRFNFTRandomDraw} from "./interfaces/IVRFNFTRandomDraw.sol";
import {Version} from "./utils/Version.sol";

/// @notice VRFNFTRandom Draw with NFT Tickets Factory Implementation
/// @author @isiain
contract VRFNFTRandomDrawFactory is
    IVRFNFTRandomDrawFactory,
    OwnableUpgradeable,
    UUPSUpgradeable,
    Version(1)
{
    /// @notice Implementation to clone of the raffle code
    address public immutable implementation;

    /// @notice Constructor to set the implementation
    constructor(address _implementation) initializer {
        if (_implementation == address(0)) {
            revert IMPL_ZERO_ADDRESS_NOT_ALLOWED();
        }
        implementation = _implementation;
    }

    function initialize(address _initialOwner) initializer external {
        __Ownable_init(_initialOwner);
        emit SetupFactory();
    }

    /// @notice Function to make a new drawing
    /// @param settings settings for the new drawing
    function makeNewDraw(IVRFNFTRandomDraw.Settings memory settings)
        external
        returns (address)
    {
        address admin = msg.sender;
        // Clone the contract
        address newDrawing = ClonesUpgradeable.clone(implementation);
        // Setup the new drawing
        IVRFNFTRandomDraw(newDrawing).initialize(admin, settings);
        // Emit event for indexing
        emit SetupNewDrawing(admin, newDrawing);
        // Return address for integration or testing
        return newDrawing;
    }

    /// @notice Allows only the owner to upgrade the contract
    /// @param newImplementation proposed new upgrade implementation
    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyOwner
    {}
}
