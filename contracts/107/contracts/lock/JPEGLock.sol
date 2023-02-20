// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title JPEG Locker contract
/// @notice Contract used by {NFTVault} to lock JPEG to increase the value of an NFT
contract JPEGLock is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    event Lock(address indexed user, uint256 indexed nftIndex, uint256 amount);
    event Unlock(address indexed user, uint256 indexed nftIndex, uint256 amount);

    struct LockPosition {
        address owner;
        uint256 unlockAt;
        uint256 lockAmount;
    }

    /// @notice The token to lock, JPEG
    IERC20 public immutable jpeg;
    /// @notice The amount of time to lock JPEG tokens for
    uint256 public lockTime;
    /// @notice Positions by NFT index
    mapping(uint256 => LockPosition) public positions;

    /// @param _jpeg The token to lock
    constructor(IERC20 _jpeg) Ownable() ReentrancyGuard() {
        jpeg = _jpeg;
        lockTime = 365 days;
    }

    /// @notice Allows the owner to change the amount of time JPEG tokens are locked for.
    /// The lock duration of already existing locked tokens won't change
    /// @param _newTime The new lock duration in seconds
    function setLockTime(uint256 _newTime) external onlyOwner {
        require(_newTime > 0, "Invalid lock time");
        lockTime = _newTime;
    }

    /// @notice Locks `_lockAmount` tokens for account `_account` and NFT `_nftIndex` for 1 year. 
    /// @dev Emits a {Lock} event
    /// @param _account The account to lock tokens for
    /// @param _nftIndex The NFT to lock tokens for
    /// @param _lockAmount The amount of tokens to lock
    function lockFor(
        address _account,
        uint256 _nftIndex,
        uint256 _lockAmount
    ) external onlyOwner nonReentrant {
        jpeg.safeTransferFrom(_account, address(this), _lockAmount);

        positions[_nftIndex] = LockPosition({
            owner: _account,
            unlockAt: block.timestamp + lockTime,
            lockAmount: _lockAmount
        });

        emit Lock(_account, _nftIndex, _lockAmount);
    }

    /// @notice Unlocks tokens for the position relative to NFT `_nftIndex`
    /// @dev Emits an {Unlock} event
    /// @param _nftIndex the NFT to unlock 
    function unlock(uint256 _nftIndex) external nonReentrant {
        LockPosition memory position = positions[_nftIndex];
        require(position.owner == msg.sender, "unauthorized");
        require(position.unlockAt <= block.timestamp, "locked");

        delete positions[_nftIndex];

        jpeg.safeTransfer(msg.sender, position.lockAmount);

        emit Unlock(msg.sender, _nftIndex, position.lockAmount);
    }

    /// @dev Prevent the owner from renouncing ownership. Having no owner would render this contract unusable
    function renounceOwnership() public view override onlyOwner {
        revert("Cannot renounce ownership");
    }
}
