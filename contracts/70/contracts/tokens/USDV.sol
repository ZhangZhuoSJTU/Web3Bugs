// SPDX-License-Identifier: Unlicense

pragma solidity =0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../shared/ProtocolConstants.sol";

import "../interfaces/shared/IERC20Extended.sol";
import "../interfaces/tokens/IUSDV.sol";
import "../interfaces/reserve/IVaderReserve.sol";
import "../interfaces/lbt/ILiquidityBasedTWAP.sol";

// TBD
contract USDV is IUSDV, ProtocolConstants, ERC20, Ownable {
    /* ========== LIBRARIES ========== */

    // Used for safe token transfers
    using SafeERC20 for IERC20Extended;

    /* ========== STATE VARIABLES ========== */

    // The VADER token used for burns and mints
    IERC20Extended public immutable vader;

    // The LBT pricing mechanism for the conversion
    ILiquidityBasedTWAP public lbt;

    // The exchange fee if any applied to burns and mints
    uint256 public exchangeFee;

    // The 24 hour limit on USDV mints
    uint256 public dailyLimit = type(uint256).max;

    // The current cycle end timestamp
    uint256 public cycleTimestamp;

    // The current cycle cumulative mints
    uint256 public cycleMints;

    // All mint/burn locks
    mapping(address => Lock[]) public locks;

    // Guardian Account
    address public guardian;

    // Lock system
    bool private isLocked;

    /* ========== CONSTRUCTOR ========== */

    constructor(IERC20Extended _vader) ERC20("Vader USD", "USDV") {
        require(
            _vader != IERC20Extended(_ZERO_ADDRESS),
            "USDV::constructor: Improper Configuration"
        );
        vader = _vader;
    }

    /* ========== VIEWS ========== */

    /* ========== MUTATIVE FUNCTIONS ========== */

    function mint(uint256 vAmount)
        external
        onlyWhenNotLocked
        returns (uint256 uAmount)
    {
        uint256 vPrice = lbt.getVaderPrice();

        vader.transferFrom(msg.sender, address(this), vAmount);
        vader.burn(vAmount);

        uAmount = (vPrice * vAmount) / 1e18;

        if (cycleTimestamp <= block.timestamp) {
            cycleTimestamp = block.timestamp + 24 hours;
            cycleMints = uAmount;
        } else {
            cycleMints += uAmount;
            require(
                cycleMints <= dailyLimit,
                "USDV::mint: 24 Hour Limit Reached"
            );
        }

        if (exchangeFee != 0) {
            uint256 fee = (uAmount * exchangeFee) / _MAX_BASIS_POINTS;
            uAmount = uAmount - fee;
            _mint(owner(), fee);
        }

        _mint(address(this), uAmount);

        _createLock(LockTypes.USDV, uAmount);
    }

    function burn(uint256 uAmount)
        external
        onlyWhenNotLocked
        returns (uint256 vAmount)
    {
        uint256 uPrice = lbt.getUSDVPrice();

        _burn(msg.sender, uAmount);

        vAmount = (uPrice * uAmount) / 1e18;

        if (exchangeFee != 0) {
            uint256 fee = (vAmount * exchangeFee) / _MAX_BASIS_POINTS;
            vAmount = vAmount - fee;
            vader.mint(owner(), fee);
        }

        vader.mint(address(this), vAmount);

        _createLock(LockTypes.VADER, vAmount);
    }

    function claim(uint256 i) external onlyWhenNotLocked returns (uint256) {
        Lock[] storage userLocks = locks[msg.sender];
        Lock memory lock = userLocks[i];

        require(lock.release <= block.timestamp, "USDV::claim: Vesting");

        uint256 last = userLocks.length - 1;
        if (i != last) {
            userLocks[i] = userLocks[last];
        }

        userLocks.pop();

        if (lock.token == LockTypes.USDV)
            _transfer(address(this), msg.sender, lock.amount);
        else vader.transfer(msg.sender, lock.amount);

        emit LockClaimed(msg.sender, lock.token, lock.amount, lock.release);

        return lock.amount;
    }

    function claimAll()
        external
        onlyWhenNotLocked
        returns (uint256 usdvAmount, uint256 vaderAmount)
    {
        Lock[] memory userLocks = locks[msg.sender];
        delete locks[msg.sender];

        for (uint256 i = 0; i < userLocks.length; i++) {
            Lock memory lock = userLocks[i];

            require(lock.release <= block.timestamp, "USDV::claimAll: Vesting");

            if (lock.token == LockTypes.USDV) {
                _transfer(address(this), msg.sender, lock.amount);
                usdvAmount += lock.amount;
            } else {
                vader.transfer(msg.sender, lock.amount);
                vaderAmount += lock.amount;
            }

            emit LockClaimed(msg.sender, lock.token, lock.amount, lock.release);
        }
    }

    /* ========== RESTRICTED FUNCTIONS ========== */

    function setLBTwap(ILiquidityBasedTWAP _lbt) external onlyOwner {
        require(
            _lbt != ILiquidityBasedTWAP(_ZERO_ADDRESS),
            "USDV::initialize: Improper Configuration"
        );
        lbt = _lbt;
    }

    function setFee(uint256 _exchangeFee) external onlyOwner {
        require(
            _exchangeFee <= _MAX_BASIS_POINTS,
            "USDV::setFee: Fee Out of Bounds"
        );
        emit ExchangeFeeChanged(exchangeFee, _exchangeFee);
        exchangeFee = _exchangeFee;
    }

    function setDailyLimit(uint256 _dailyLimit) external onlyOwner {
        emit DailyLimitChanged(dailyLimit, _dailyLimit);
        dailyLimit = _dailyLimit;
    }

    function setGuardian(address _guardian) external onlyOwner {
        require(_guardian != address(0), "USDV::setGuardian: Zero address");
        guardian = _guardian;
    }

    function setLock(bool _lock) external {
        require(
            msg.sender == owner() || msg.sender == guardian,
            "USDV::setLock: Insufficient Privileges"
        );
        isLocked = _lock;
    }

    /* ========== INTERNAL FUNCTIONS ========== */

    /* ========== PRIVATE FUNCTIONS ========== */

    function _createLock(LockTypes lockType, uint256 amount) private {
        uint256 release = block.timestamp + lbt.maxUpdateWindow();

        locks[msg.sender].push(Lock(lockType, amount, release));

        emit LockCreated(msg.sender, lockType, amount, release);
    }

    /* ========== MODIFIERS ========== */
    modifier onlyWhenNotLocked() {
        require(!isLocked);
        _;
    }
}
