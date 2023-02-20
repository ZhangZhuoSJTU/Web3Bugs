// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

/*
Rewrite of Convex Finance's Vested Escrow
found at https://github.com/convex-eth/platform/blob/main/contracts/contracts/VestedEscrow.sol
Changes:
- remove safe math (default from Solidity >=0.8)
- remove claim and stake logic
- remove safeTransferFrom logic and add support for "airdropped" reward token
- add revoke logic to allow admin to stop vesting for a recipient
*/

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "../../interfaces/tokenomics/IVestedEscrowRevocable.sol";

import "../../libraries/Errors.sol";

import "./VestedEscrow.sol";

contract VestedEscrowRevocable is IVestedEscrowRevocable, VestedEscrow {
    using SafeERC20 for IERC20;

    address public immutable treasury;

    uint256 private _vestedBefore;

    mapping(address => uint256) public revokedTime;

    event Revoked(address indexed user, uint256 revokedAmount);

    constructor(
        address rewardToken_,
        uint256 starttime_,
        uint256 endtime_,
        address fundAdmin_,
        address treasury_
    ) VestedEscrow(rewardToken_, starttime_, endtime_, fundAdmin_) {
        treasury = treasury_;
        holdingContract[treasury_] = address(new EscrowTokenHolder(rewardToken_));
    }

    function claim() external override {
        claim(msg.sender);
    }

    function revoke(address _recipient) external returns (bool) {
        require(msg.sender == admin, Error.UNAUTHORIZED_ACCESS);
        require(revokedTime[_recipient] == 0, "Recipient already revoked");
        require(_recipient != treasury, "Treasury cannot be revoked!");
        revokedTime[_recipient] = block.timestamp;
        uint256 vested = _totalVestedOf(_recipient, block.timestamp);

        uint256 initialAmount = initialLocked[_recipient];
        uint256 revokedAmount = initialAmount - vested;
        rewardToken.safeTransferFrom(
            holdingContract[_recipient],
            holdingContract[treasury],
            revokedAmount
        );
        initialLocked[treasury] += initialAmount;
        totalClaimed[treasury] += vested;
        _vestedBefore += vested;
        emit Revoked(_recipient, revokedAmount);
        return true;
    }

    function vestedOf(address _recipient) external view override returns (uint256) {
        if (_recipient == treasury) {
            return _totalVestedOf(_recipient, block.timestamp) - _vestedBefore;
        }

        uint256 timeRevoked = revokedTime[_recipient];
        if (timeRevoked != 0) {
            return _totalVestedOf(_recipient, timeRevoked);
        }
        return _totalVestedOf(_recipient, block.timestamp);
    }

    function balanceOf(address _recipient) external view override returns (uint256) {
        uint256 timestamp = block.timestamp;
        uint256 timeRevoked = revokedTime[_recipient];
        if (timeRevoked != 0) {
            timestamp = timeRevoked;
        }
        return _balanceOf(_recipient, timestamp);
    }

    function lockedOf(address _recipient) external view override returns (uint256) {
        if (revokedTime[_recipient] != 0) {
            return 0;
        }
        uint256 vested = _totalVestedOf(_recipient, block.timestamp);
        return initialLocked[_recipient] - vested;
    }

    function claim(address _recipient) public override nonReentrant {
        uint256 timestamp = block.timestamp;
        if (revokedTime[msg.sender] != 0) {
            timestamp = revokedTime[msg.sender];
        }
        _claimUntil(_recipient, timestamp);
    }
}
