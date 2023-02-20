// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

/*
Rewrite of Convex Finance's Vested Escrow
found at https://github.com/convex-eth/platform/blob/main/contracts/contracts/VestedEscrow.sol
Changes:
- remove safe math (default from Solidity >=0.8)
- remove claim and stake logic
- remove safeTransferFrom logic and add support for "airdropped" reward token
*/

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "../../interfaces/tokenomics/IVestedEscrow.sol";

import "../../libraries/Errors.sol";
import "../../libraries/UncheckedMath.sol";

contract EscrowTokenHolder {
    constructor(address rewardToken_) {
        IERC20(rewardToken_).approve(msg.sender, type(uint256).max);
    }
}

contract VestedEscrow is IVestedEscrow, ReentrancyGuard {
    using UncheckedMath for uint256;
    using SafeERC20 for IERC20;

    IERC20 public immutable rewardToken;
    address public admin;
    address public fundAdmin;

    uint256 public immutable startTime;
    uint256 public immutable endTime;
    uint256 public totalTime;
    uint256 public initialLockedSupply;
    uint256 public unallocatedSupply;
    bool public initializedSupply;

    mapping(address => uint256) public initialLocked;
    mapping(address => uint256) public totalClaimed;
    mapping(address => address) public holdingContract;

    event Fund(address indexed recipient, uint256 reward);
    event Claim(address indexed user, uint256 amount);

    constructor(
        address rewardToken_,
        uint256 starttime_,
        uint256 endtime_,
        address fundAdmin_
    ) {
        require(starttime_ >= block.timestamp, "start must be future");
        require(endtime_ > starttime_, "end must be greater");

        rewardToken = IERC20(rewardToken_);
        startTime = starttime_;
        endTime = endtime_;
        totalTime = endtime_ - starttime_;
        admin = msg.sender;
        fundAdmin = fundAdmin_;
    }

    function setAdmin(address _admin) external override {
        require(_admin != address(0), Error.ZERO_ADDRESS_NOT_ALLOWED);
        require(msg.sender == admin, Error.UNAUTHORIZED_ACCESS);
        admin = _admin;
    }

    function setFundAdmin(address _fundadmin) external override {
        require(_fundadmin != address(0), Error.ZERO_ADDRESS_NOT_ALLOWED);
        require(msg.sender == admin, Error.UNAUTHORIZED_ACCESS);
        fundAdmin = _fundadmin;
    }

    function initializeUnallocatedSupply() external override returns (bool) {
        require(msg.sender == admin, Error.UNAUTHORIZED_ACCESS);
        require(!initializedSupply, "Supply already initialized once");
        unallocatedSupply = rewardToken.balanceOf(address(this));
        require(unallocatedSupply > 0, "No reward tokens in contract");
        initializedSupply = true;
        return true;
    }

    function fund(FundingAmount[] calldata amounts) external override nonReentrant returns (bool) {
        require(msg.sender == fundAdmin || msg.sender == admin, Error.UNAUTHORIZED_ACCESS);
        require(initializedSupply, "Supply must be initialized");

        uint256 totalAmount;
        for (uint256 i; i < amounts.length; i = i.uncheckedInc()) {
            uint256 amount = amounts[i].amount;
            address recipient_ = amounts[i].recipient;
            address holdingAddress = holdingContract[recipient_];
            if (holdingAddress == address(0)) {
                holdingAddress = address(new EscrowTokenHolder(address(rewardToken)));
                holdingContract[recipient_] = holdingAddress;
            }
            rewardToken.safeTransfer(holdingAddress, amount);
            initialLocked[recipient_] = initialLocked[recipient_] + amount;
            totalAmount = totalAmount + amount;
            emit Fund(recipient_, amount);
        }

        initialLockedSupply = initialLockedSupply + totalAmount;
        unallocatedSupply = unallocatedSupply - totalAmount;
        return true;
    }

    function claim() external virtual override {
        _claimUntil(msg.sender, block.timestamp);
    }

    function vestedSupply() external view override returns (uint256) {
        return _totalVested();
    }

    function lockedSupply() external view override returns (uint256) {
        return initialLockedSupply - _totalVested();
    }

    function vestedOf(address _recipient) external view virtual override returns (uint256) {
        return _totalVestedOf(_recipient, block.timestamp);
    }

    function balanceOf(address _recipient) external view virtual override returns (uint256) {
        return _balanceOf(_recipient, block.timestamp);
    }

    function lockedOf(address _recipient) external view virtual override returns (uint256) {
        uint256 vested = _totalVestedOf(_recipient, block.timestamp);
        return initialLocked[_recipient] - vested;
    }

    function claim(address _recipient) public virtual override nonReentrant {
        _claimUntil(_recipient, block.timestamp);
    }

    function _claimUntil(address _recipient, uint256 _time) internal {
        uint256 claimable = _balanceOf(msg.sender, _time);
        if (claimable == 0) return;
        totalClaimed[msg.sender] = totalClaimed[msg.sender] + claimable;
        rewardToken.safeTransferFrom(holdingContract[msg.sender], _recipient, claimable);

        emit Claim(msg.sender, claimable);
    }

    function _computeVestedAmount(uint256 locked, uint256 _time) internal view returns (uint256) {
        if (_time < startTime) {
            return 0;
        }
        uint256 elapsed = _time - startTime;
        return Math.min((locked * elapsed) / totalTime, locked);
    }

    function _totalVestedOf(address _recipient, uint256 _time) internal view returns (uint256) {
        return _computeVestedAmount(initialLocked[_recipient], _time);
    }

    function _totalVested() internal view returns (uint256) {
        return _computeVestedAmount(initialLockedSupply, block.timestamp);
    }

    function _balanceOf(address _recipient, uint256 _time) internal view returns (uint256) {
        uint256 vested = _totalVestedOf(_recipient, _time);
        return vested - totalClaimed[_recipient];
    }
}
