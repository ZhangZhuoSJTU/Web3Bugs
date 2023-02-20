//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.4;
pragma abicoder v1;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Treasury {
    using SafeERC20 for IERC20;

    /// @notice Reference to token to drip (immutable)
    IERC20 public immutable token;
    address public admin;

    struct Schedule {
        uint256 dripStart; //The block number when the Treasury started (immutable)
        uint256 amount; //Total amount to drip (immutable)
        uint256 dripRate; //Tokens per block that to drip to target (immutable)
        address target; //Target to receive dripped tokens (immutable)
        uint256 dripped; //Amount that has already been dripped
    }

    mapping(address => Schedule) public tokenSchedules; //0: target address, 1: Schedule

    modifier onlyAdmin() {
        require(msg.sender == admin, "Treasury: not admin");
        _;
    }

    constructor(IERC20 token_) {
        admin = msg.sender;
        token = token_;
    }

    function setAdmin(address admin_) public onlyAdmin {
        admin = admin_;
    }

    /**
     * @notice Drips the maximum amount of tokens to match the drip rate since inception
     * @dev Note: this will only drip up to the amount of tokens available.
     * @return The amount of tokens dripped in this call
     */
    function drip(address target) public returns (uint256) {
        require(tokenSchedules[target].target != address(0), "Target schedule doesn't exist");
        // First, read storage into memory
        IERC20 token_ = token;
        uint256 dripRate_ = tokenSchedules[target].dripRate;
        uint256 dripStart_ = tokenSchedules[target].dripStart;
        uint256 dripped_ = tokenSchedules[target].dripped;
        address target_ = tokenSchedules[target].target;
        uint256 totalAmount_ = tokenSchedules[target].amount;
        uint256 blockNumber_ = block.number;

        require(blockNumber_ >= dripStart_, "not yet started");
        uint256 treasuryBalance_ = token_.balanceOf(address(this)); // TODO: Verify this is a static call

        // Next, calculate intermediate values
        uint256 dripTotal_ = _min((blockNumber_ - dripStart_) * dripRate_, totalAmount_);
        uint256 deltaDrip_;
        if (dripTotal_ > dripped_) {
            deltaDrip_ = dripTotal_ - dripped_;
        } else {
            deltaDrip_ = 0;
        }
        uint256 toDrip_ = _min(treasuryBalance_, deltaDrip_);
        uint256 drippedNext_ = dripped_ + toDrip_;

        // Finally, write new `dripped` value and transfer tokens to target
        tokenSchedules[target_].dripped = drippedNext_;
        token_.safeTransfer(target_, toDrip_);

        return toDrip_;
    }

    function addSchedule(
        uint256 dripStart_,
        uint256 dripRate_,
        address target_,
        uint256 amount_
    ) public onlyAdmin {
        require(tokenSchedules[target_].target == address(0), "Target schedule already exists");
        Schedule memory schedule;
        schedule.dripStart = dripStart_;
        schedule.dripRate = dripRate_;
        schedule.target = target_;
        schedule.amount = amount_;
        schedule.dripped = 0;
        tokenSchedules[target_] = schedule;
    }

    function editSchedule(
        uint256 dripStart_,
        uint256 dripRate_,
        address target_,
        uint256 amount_
    ) public onlyAdmin {
        require(tokenSchedules[target_].target != address(0), "Target schedule doesn't exist");
        tokenSchedules[target_].dripStart = dripStart_;
        tokenSchedules[target_].dripRate = dripRate_;
        tokenSchedules[target_].amount = amount_;
    }

    function grantToken(address account, uint256 amount) public onlyAdmin {
        IERC20 token_ = token;
        uint256 treasuryBalance_ = token_.balanceOf(address(this));
        require(amount <= treasuryBalance_, "amount larger than balance");
        token_.safeTransfer(account, amount);
    }

    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        if (a <= b) {
            return a;
        } else {
            return b;
        }
    }
}
