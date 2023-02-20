// SPDX-License-Identifier: MIT

pragma solidity =0.8.10;

import { IERC721Enumerable } from "@openzeppelin/contracts/token/ERC721/extensions/IERC721Enumerable.sol";

interface IXDEFIDistribution is IERC721Enumerable {

    struct Position {
        uint96 units;  // 240,000,000,000,000,000,000,000,000 XDEFI * 100x bonus (which fits in a uint96).
        uint88 depositedXDEFI; // XDEFI cap is 240000000000000000000000000 (which fits in a uint88).
        uint32 expiry;  // block timestamps for the next 50 years (which fits in a uint32).
        uint32 created;
        uint8 bonusMultiplier;
        int256 pointsCorrection;
    }

    /// @notice Emitted when owner proposed an account that can accept ownership.
    event OwnershipProposed(address indexed owner, address indexed pendingOwner);

    /// @notice Emitted when an account has accepted ownership.
    event OwnershipAccepted(address indexed previousOwner, address indexed owner);

    /// @notice Emitted when a new lock period duration, in seconds, has been enabled with some bonus multiplier (scaled by 100, 0 signaling it is disabled).
    event LockPeriodSet(uint256 duration, uint8 bonusMultiplier);

    /// @notice Emitted when a new locked position is created for some amount of XDEFI, and the NFT is minted to an owner.
    event LockPositionCreated(uint256 indexed tokenId, address indexed owner, uint256 amount, uint256 duration);

    /// @notice Emitted when a locked position is unlocked, withdrawing some amount of XDEFI.
    event LockPositionWithdrawn(uint256 indexed tokenId, address indexed owner, uint256 amount);

    /// @notice Emitted when a new amount of XDEFI is distributed to all locked positions, by some caller.
    event DistributionUpdated(address indexed caller, uint256 amount);

    /// @notice The address of the XDEFI token.
    function XDEFI() external view returns (address XDEFI_);

    /// @notice The amount of XDEFI that is distributable to all currently locked positions.
    function distributableXDEFI() external view returns (uint256 distributableXDEFI_);

    /// @notice The amount of XDEFI that was deposited by all currently locked positions.
    function totalDepositedXDEFI() external view returns (uint256 totalDepositedXDEFI_);

    /// @notice The amount of locked position units (in some way, it is the denominator use to distribute new XDEFI to each unit).
    function totalUnits() external view returns (uint256 totalUnits_);

    /// @notice Returns the position details (`pointsCorrection_` is a value used in the amortized work pattern for token distribution).
    function positionOf(uint256 id_) external view returns (uint96 units_, uint88 depositedXDEFI_, uint32 expiry_, uint32 created_, uint8 bonusMultiplier_, int256 pointsCorrection_);

    /// @notice The multiplier applied to the deposited XDEFI amount to determine the units of a position, and thus its share of future distributions.
    function bonusMultiplierOf(uint256 duration_) external view returns (uint8 bonusMultiplier_);

    /// @notice The base URI for NFT metadata.
    function baseURI() external view returns (string memory baseURI_);

    /// @notice The account that can set and unset lock periods and transfer ownership of the contract.
    function owner() external view returns (address owner_);

    /// @notice The account that can take ownership of the contract.
    function pendingOwner() external view returns (address pendingOwner_);

    /*******************/
    /* Admin Functions */
    /*******************/

    /// @notice Allows the `pendingOwner` to take ownership of the contract.
    function acceptOwnership() external;

    /// @notice Allows the owner to propose a new owner for the contract.
    function proposeOwnership(address newOwner_) external;

    /// @notice Sets the base URI for NFT metadata.
    function setBaseURI(string memory baseURI_) external;

    /// @notice Allows the setting or un-setting (when the multiplier is 0) of multipliers for lock durations. Scaled such that 1x is 100.
    function setLockPeriods(uint256[] memory durations_, uint8[] memory multipliers) external;

    /**********************/
    /* Position Functions */
    /**********************/

    /// @notice Locks some amount of XDEFI into a non-fungible (NFT) position, for a duration of time. The caller must first approve this contract to spend its XDEFI.
    function lock(uint256 amount_, uint256 duration_, address destination_) external returns (uint256 tokenId_);

    /// @notice Locks some amount of XDEFI into a non-fungible (NFT) position, for a duration of time, with a signed permit to transfer XDEFI from the caller.
    function lockWithPermit(uint256 amount_, uint256 duration_, address destination_, uint256 deadline_, uint8 v_, bytes32 r_, bytes32 s_) external returns (uint256 tokenId_);

    /// @notice Unlock an un-lockable non-fungible position and re-lock some amount, for a duration of time, sending the balance XDEFI to some destination.
    function relock(uint256 tokenId_, uint256 lockAmount_, uint256 duration_, address destination_) external returns (uint256 amountUnlocked_, uint256 newTokenId_);

    /// @notice Unlock an un-lockable non-fungible position, sending the XDEFI to some destination.
    function unlock(uint256 tokenId_, address destination_) external returns (uint256 amountUnlocked_);

    /// @notice To be called as part of distributions to force the contract to recognize recently transferred XDEFI as distributable.
    function updateDistribution() external;

    /// @notice Returns the amount of XDEFI that can be withdrawn when the position is unlocked. This will increase as distributions are made.
    function withdrawableOf(uint256 tokenId_) external view returns (uint256 withdrawableXDEFI_);

    /****************************/
    /* Batch Position Functions */
    /****************************/

    /// @notice Unlocks several un-lockable non-fungible positions and re-lock some amount, for a duration of time, sending the balance XDEFI to some destination.
    function relockBatch(uint256[] memory tokenIds_, uint256 lockAmount_, uint256 duration_, address destination_) external returns (uint256 amountUnlocked_, uint256 newTokenId_);

    /// @notice Unlocks several un-lockable non-fungible positions, sending the XDEFI to some destination.
    function unlockBatch(uint256[] memory tokenIds_, address destination_) external returns (uint256 amountUnlocked_);

    /*****************/
    /* NFT Functions */
    /*****************/

    /// @notice Returns the number of points an NFT will have, given some amount locked for some duration.
    function getPoints(uint256 amount_, uint256 duration_) external view returns (uint256 points_);

    /// @notice Burns several unlocked NFTs to mint a new NFT that has their combined points total.
    function merge(uint256[] memory tokenIds_, address destination_) external returns (uint256 tokenId_);

    /// @notice Returns the number of points of an NFT.
    function pointsOf(uint256 tokenId_) external view returns (uint256 points_);

    /// @notice Returns the URI for the NFT metadata for a given token ID.
    function tokenURI(uint256 tokenId_) external view returns (string memory tokenURI_);

}
