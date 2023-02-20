// SPDX-License-Identifier: MIT

pragma solidity =0.8.10;

import { ERC721, ERC721Enumerable, Strings } from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import { IERC20, SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { IEIP2612 } from "./interfaces/IEIP2612.sol";
import { IXDEFIDistribution } from "./interfaces/IXDEFIDistribution.sol";

/// @dev Handles distributing XDEFI to NFTs that have locked up XDEFI for various durations of time.
contract XDEFIDistribution is IXDEFIDistribution, ERC721Enumerable {

    uint88 internal MAX_TOTAL_XDEFI_SUPPLY = uint88(240_000_000_000_000_000_000_000_000);

    // See https://github.com/ethereum/EIPs/issues/1726#issuecomment-472352728
    uint256 internal constant _pointsMultiplier = uint256(2**128);
    uint256 internal _pointsPerUnit;

    address public immutable XDEFI;

    uint256 public distributableXDEFI;
    uint256 public totalDepositedXDEFI;
    uint256 public totalUnits;

    mapping(uint256 => Position) public positionOf;

    mapping(uint256 => uint8) public bonusMultiplierOf;  // Scaled by 100 (i.e. 1.1x is 110, 2.55x is 255).

    uint256 internal immutable _zeroDurationPointBase;

    string public baseURI;

    address public owner;
    address public pendingOwner;

    uint256 internal _locked;

    constructor (address XDEFI_, string memory baseURI_, uint256 zeroDurationPointBase_) ERC721("Locked XDEFI", "lXDEFI") {
        require((XDEFI = XDEFI_) != address(0), "INVALID_TOKEN");
        owner = msg.sender;
        baseURI = baseURI_;
        _zeroDurationPointBase = zeroDurationPointBase_;
    }

    modifier onlyOwner() {
        require(owner == msg.sender, "NOT_OWNER");
        _;
    }

    modifier noReenter() {
        require(_locked == 0, "LOCKED");
        _locked = uint256(1);
        _;
        _locked = uint256(0);
    }

    /*******************/
    /* Admin Functions */
    /*******************/

    function acceptOwnership() external {
        require(pendingOwner == msg.sender, "NOT_PENDING_OWNER");
        emit OwnershipAccepted(owner, msg.sender);
        owner = msg.sender;
        pendingOwner = address(0);
    }

    function proposeOwnership(address newOwner_) external onlyOwner {
        emit OwnershipProposed(owner, pendingOwner = newOwner_);
    }

    function setBaseURI(string memory baseURI_) external onlyOwner {
        baseURI = baseURI_;
    }

    function setLockPeriods(uint256[] memory durations_, uint8[] memory multipliers) external onlyOwner {
        uint256 count = durations_.length;

        for (uint256 i; i < count; ++i) {
            uint256 duration = durations_[i];
            require(duration <= uint256(18250 days), "INVALID_DURATION");
            emit LockPeriodSet(duration, bonusMultiplierOf[duration] = multipliers[i]);
        }
    }

    /**********************/
    /* Position Functions */
    /**********************/

    function lock(uint256 amount_, uint256 duration_, address destination_) external noReenter returns (uint256 tokenId_) {
        // Lock the XDEFI in the contract.
        SafeERC20.safeTransferFrom(IERC20(XDEFI), msg.sender, address(this), amount_);

        // Handle the lock position creation and get the tokenId of the locked position.
        return _lock(amount_, duration_, destination_);
    }

    function lockWithPermit(uint256 amount_, uint256 duration_, address destination_, uint256 deadline_, uint8 v_, bytes32 r_, bytes32 s_) external noReenter returns (uint256 tokenId_) {
        // Approve this contract for the amount, using the provided signature.
        IEIP2612(XDEFI).permit(msg.sender, address(this), amount_, deadline_, v_, r_, s_);

        // Lock the XDEFI in the contract.
        SafeERC20.safeTransferFrom(IERC20(XDEFI), msg.sender, address(this), amount_);

        // Handle the lock position creation and get the tokenId of the locked position.
        return _lock(amount_, duration_, destination_);
    }

    function relock(uint256 tokenId_, uint256 lockAmount_, uint256 duration_, address destination_) external noReenter returns (uint256 amountUnlocked_, uint256 newTokenId_) {
        // Handle the unlock and get the amount of XDEFI eligible to withdraw.
        amountUnlocked_ = _unlock(msg.sender, tokenId_);

        // Throw convenient error if trying to re-lock more than was unlocked. `amountUnlocked_ - lockAmount_` would have reverted below anyway.
        require(lockAmount_ <= amountUnlocked_, "INSUFFICIENT_AMOUNT_UNLOCKED");

        // Handle the lock position creation and get the tokenId of the locked position.
        newTokenId_ = _lock(lockAmount_, duration_, destination_);

        uint256 withdrawAmount = amountUnlocked_ - lockAmount_;

        if (withdrawAmount != uint256(0)) {
            // Send the excess XDEFI to the destination, if needed.
            SafeERC20.safeTransfer(IERC20(XDEFI), destination_, withdrawAmount);
        }

        // NOTE: This needs to be done after updating `totalDepositedXDEFI` (which happens in `_unlock`) and transferring out.
        _updateXDEFIBalance();
    }

    function unlock(uint256 tokenId_, address destination_) external noReenter returns (uint256 amountUnlocked_) {
        // Handle the unlock and get the amount of XDEFI eligible to withdraw.
        amountUnlocked_ = _unlock(msg.sender, tokenId_);

        // Send the the unlocked XDEFI to the destination.
        SafeERC20.safeTransfer(IERC20(XDEFI), destination_, amountUnlocked_);

        // NOTE: This needs to be done after updating `totalDepositedXDEFI` (which happens in `_unlock`) and transferring out.
        _updateXDEFIBalance();
    }

    function updateDistribution() external {
        uint256 totalUnitsCached = totalUnits;

        require(totalUnitsCached > uint256(0), "NO_UNIT_SUPPLY");

        uint256 newXDEFI = _toUint256Safe(_updateXDEFIBalance());

        if (newXDEFI == uint256(0)) return;

        _pointsPerUnit += ((newXDEFI * _pointsMultiplier) / totalUnitsCached);

        emit DistributionUpdated(msg.sender, newXDEFI);
    }

    function withdrawableOf(uint256 tokenId_) public view returns (uint256 withdrawableXDEFI_) {
        Position storage position = positionOf[tokenId_];
        return _withdrawableGiven(position.units, position.depositedXDEFI, position.pointsCorrection);
    }

    /****************************/
    /* Batch Position Functions */
    /****************************/

    function relockBatch(uint256[] memory tokenIds_, uint256 lockAmount_, uint256 duration_, address destination_) external noReenter returns (uint256 amountUnlocked_, uint256 newTokenId_) {
        // Handle the unlocks and get the amount of XDEFI eligible to withdraw.
        amountUnlocked_ = _unlockBatch(msg.sender, tokenIds_);

        // Throw convenient error if trying to re-lock more than was unlocked. `amountUnlocked_ - lockAmount_` would have reverted below anyway.
        require(lockAmount_ <= amountUnlocked_, "INSUFFICIENT_AMOUNT_UNLOCKED");

        // Handle the lock position creation and get the tokenId of the locked position.
        newTokenId_ = _lock(lockAmount_, duration_, destination_);

        uint256 withdrawAmount = amountUnlocked_ - lockAmount_;

        if (withdrawAmount != uint256(0)) {
            // Send the excess XDEFI to the destination, if needed.
            SafeERC20.safeTransfer(IERC20(XDEFI), destination_, withdrawAmount);
        }

        // NOTE: This needs to be done after updating `totalDepositedXDEFI` (which happens in `_unlockBatch`) and transferring out.
        _updateXDEFIBalance();
    }

    function unlockBatch(uint256[] memory tokenIds_, address destination_) external noReenter returns (uint256 amountUnlocked_) {
        // Handle the unlocks and get the amount of XDEFI eligible to withdraw.
        amountUnlocked_ = _unlockBatch(msg.sender, tokenIds_);

        // Send the the unlocked XDEFI to the destination.
        SafeERC20.safeTransfer(IERC20(XDEFI), destination_, amountUnlocked_);

        // NOTE: This needs to be done after updating `totalDepositedXDEFI` (which happens in `_unlockBatch`) and transferring out.
        _updateXDEFIBalance();
    }

    /*****************/
    /* NFT Functions */
    /*****************/

    function getPoints(uint256 amount_, uint256 duration_) external view returns (uint256 points_) {
        return _getPoints(amount_, duration_);
    }

    function merge(uint256[] memory tokenIds_, address destination_) external returns (uint256 tokenId_) {
        uint256 count = tokenIds_.length;
        require(count > uint256(1), "MIN_2_TO_MERGE");

        uint256 points;

        // For each NFT, check that it belongs to the caller, burn it, and accumulate the points.
        for (uint256 i; i < count; ++i) {
            uint256 tokenId = tokenIds_[i];
            require(ownerOf(tokenId) == msg.sender, "NOT_OWNER");
            require(positionOf[tokenId].expiry == uint32(0), "POSITION_NOT_UNLOCKED");

            _burn(tokenId);

            points += _getPointsFromTokenId(tokenId);
        }

        // Mine a new NFT to the destinations, based on the accumulated points.
        _safeMint(destination_, tokenId_ = _generateNewTokenId(points));
    }

    function pointsOf(uint256 tokenId_) external view returns (uint256 points_) {
        require(_exists(tokenId_), "NO_TOKEN");
        return _getPointsFromTokenId(tokenId_);
    }

    function tokenURI(uint256 tokenId_) public view override(IXDEFIDistribution, ERC721) returns (string memory tokenURI_) {
        require(_exists(tokenId_), "NO_TOKEN");
        return string(abi.encodePacked(baseURI, Strings.toString(tokenId_)));
    }

    /**********************/
    /* Internal Functions */
    /**********************/

    function _generateNewTokenId(uint256 points_) internal view returns (uint256 tokenId_) {
        // Points is capped at 128 bits (max supply of XDEFI for 10 years locked), total supply of NFTs is capped at 128 bits.
        return (points_ << uint256(128)) + uint128(totalSupply() + 1);
    }

    function _getPoints(uint256 amount_, uint256 duration_) internal view returns (uint256 points_) {
        return amount_ * (duration_ + _zeroDurationPointBase);
    }

    function _getPointsFromTokenId(uint256 tokenId_) internal pure returns (uint256 points_) {
        return tokenId_ >> uint256(128);
    }

    function _lock(uint256 amount_, uint256 duration_, address destination_) internal returns (uint256 tokenId_) {
        // Prevent locking 0 amount in order generate many score-less NFTs, even if it is inefficient, and such NFTs would be ignored.
        require(amount_ != uint256(0) && amount_ <= MAX_TOTAL_XDEFI_SUPPLY, "INVALID_AMOUNT");

        // Get bonus multiplier and check that it is not zero (which validates the duration).
        uint8 bonusMultiplier = bonusMultiplierOf[duration_];
        require(bonusMultiplier != uint8(0), "INVALID_DURATION");

        // Mint a locked staked position NFT to the destination.
        _safeMint(destination_, tokenId_ = _generateNewTokenId(_getPoints(amount_, duration_)));

        // Track deposits.
        totalDepositedXDEFI += amount_;

        // Create Position.
        uint96 units = uint96((amount_ * uint256(bonusMultiplier)) / uint256(100));
        totalUnits += units;
        positionOf[tokenId_] =
            Position({
                units: units,
                depositedXDEFI: uint88(amount_),
                expiry: uint32(block.timestamp + duration_),
                created: uint32(block.timestamp),
                bonusMultiplier: bonusMultiplier,
                pointsCorrection: -_toInt256Safe(_pointsPerUnit * units)
            });

        emit LockPositionCreated(tokenId_, destination_, amount_, duration_);
    }

    function _toInt256Safe(uint256 x_) internal pure returns (int256 y_) {
        y_ = int256(x_);
        assert(y_ >= int256(0));
    }

    function _toUint256Safe(int256 x_) internal pure returns (uint256 y_) {
        assert(x_ >= int256(0));
        return uint256(x_);
    }

    function _unlock(address account_, uint256 tokenId_) internal returns (uint256 amountUnlocked_) {
        // Check that the account is the position NFT owner.
        require(ownerOf(tokenId_) == account_, "NOT_OWNER");

        // Fetch position.
        Position storage position = positionOf[tokenId_];
        uint96 units = position.units;
        uint88 depositedXDEFI = position.depositedXDEFI;
        uint32 expiry = position.expiry;

        // Check that enough time has elapsed in order to unlock.
        require(expiry != uint32(0), "NO_LOCKED_POSITION");
        require(block.timestamp >= uint256(expiry), "CANNOT_UNLOCK");

        // Get the withdrawable amount of XDEFI for the position.
        amountUnlocked_ = _withdrawableGiven(units, depositedXDEFI, position.pointsCorrection);

        // Track deposits.
        totalDepositedXDEFI -= uint256(depositedXDEFI);

        // Burn FDT Position.
        totalUnits -= units;
        delete positionOf[tokenId_];

        emit LockPositionWithdrawn(tokenId_, account_, amountUnlocked_);
    }

    function _unlockBatch(address account_, uint256[] memory tokenIds_) internal returns (uint256 amountUnlocked_) {
        uint256 count = tokenIds_.length;
        require(count > uint256(1), "USE_UNLOCK");

        // Handle the unlock for each position and accumulate the unlocked amount.
        for (uint256 i; i < count; ++i) {
            amountUnlocked_ += _unlock(account_, tokenIds_[i]);
        }
    }

    function _updateXDEFIBalance() internal returns (int256 newFundsTokenBalance_) {
        uint256 previousDistributableXDEFI = distributableXDEFI;
        uint256 currentDistributableXDEFI = distributableXDEFI = IERC20(XDEFI).balanceOf(address(this)) - totalDepositedXDEFI;

        return _toInt256Safe(currentDistributableXDEFI) - _toInt256Safe(previousDistributableXDEFI);
    }

    function _withdrawableGiven(uint96 units_, uint88 depositedXDEFI_, int256 pointsCorrection_) internal view returns (uint256 withdrawableXDEFI_) {
        return
            (
                _toUint256Safe(
                    _toInt256Safe(_pointsPerUnit * uint256(units_)) +
                    pointsCorrection_
                ) / _pointsMultiplier
            ) + uint256(depositedXDEFI_);
    }

}
