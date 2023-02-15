// SPDX-License-Identifier: Unlicense

pragma solidity =0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../../shared/ProtocolConstants.sol";

import "../../interfaces/tokens/vesting/ILinearVesting.sol";

/**
 * @dev Implementation of the {ILinearVesting} interface.
 *
 * The straightforward vesting contract that gradually releases a
 * fixed supply of tokens to multiple vest parties over a 2 year
 * window.
 *
 * The token expects the {begin} hook to be invoked the moment
 * it is supplied with the necessary amount of tokens to vest,
 * which should be equivalent to the time the {setComponents}
 * function is invoked on the Vader token.
 */
contract LinearVesting is ILinearVesting, ProtocolConstants, Ownable {
    /* ========== LIBRARIES ========== */

    /* ========== STATE VARIABLES ========== */

    // The Vader token
    IERC20 public immutable vader;

    // The start of the vesting period
    uint256 public start;

    // The end of the vesting period
    uint256 public end;

    // The status of each vesting member (Vester)
    mapping(address => Vester) public vest;

    // The address of Converter contract.
    address public immutable converter;

    /* ========== CONSTRUCTOR ========== */

    /**
     * @dev Initializes the contract's vesters and vesting amounts as well as sets
     * the Vader token address.
     *
     * It conducts a sanity check to ensure that the total vesting amounts specified match
     * the team allocation to ensure that the contract is deployed correctly.
     *
     * Additionally, it transfers ownership to the Vader contract that needs to consequently
     * initiate the vesting period via {begin} after it mints the necessary amount to the contract.
     */
    constructor(IERC20 _vader, address _converter) {
        require(
            _vader != IERC20(_ZERO_ADDRESS) && _converter != _ZERO_ADDRESS,
            "LinearVesting::constructor: Misconfiguration"
        );

        vader = _vader;
        converter = _converter;

        transferOwnership(address(_vader));
    }

    /* ========== VIEWS ========== */

    /**
     * @dev Returns the amount a user can claim at a given point in time.
     *
     * Requirements:
     * - the vesting period has started
     */
    function getClaim(address _vester)
        external
        view
        override
        hasStarted
        returns (uint256 vestedAmount)
    {
        Vester memory vester = vest[_vester];
        return
            _getClaim(
                vester.amount,
                vester.lastClaim,
                vester.start,
                vester.end
            );
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    /**
     * @dev Allows a user to claim their pending vesting amount of the vested claim
     *
     * Emits a {Vested} event indicating the user who claimed their vested tokens
     * as well as the amount that was vested.
     *
     * Requirements:
     *
     * - the vesting period has started
     * - the caller must have a non-zero vested amount
     */
    function claim() external override returns (uint256 vestedAmount) {
        Vester memory vester = vest[msg.sender];

        require(
            vester.start != 0,
            "LinearVesting::claim: Incorrect Vesting Type"
        );

        require(
            vester.start < block.timestamp,
            "LinearVesting::claim: Not Started Yet"
        );

        vestedAmount = _getClaim(
            vester.amount,
            vester.lastClaim,
            vester.start,
            vester.end
        );

        require(vestedAmount != 0, "LinearVesting::claim: Nothing to claim");

        vester.amount -= uint192(vestedAmount);
        vester.lastClaim = uint64(block.timestamp);

        vest[msg.sender] = vester;

        emit Vested(msg.sender, vestedAmount);

        vader.transfer(msg.sender, vestedAmount);
    }

    /* ========== RESTRICTED FUNCTIONS ========== */

    /**
     * @dev Allows the vesting period to be initiated.
     *
     * Emits a {VestingInitialized} event from which the start and
     * end can be calculated via it's attached timestamp.
     *
     * Requirements:
     *
     * - the caller must be the owner (vader token)
     */
    function begin(address[] calldata vesters, uint192[] calldata amounts)
        external
        override
        onlyOwner
    {
        require(
            vesters.length == amounts.length,
            "LinearVesting::begin: Vesters and Amounts lengths do not match"
        );

        uint256 _start = block.timestamp;
        uint256 _end = block.timestamp + _VESTING_DURATION;

        start = _start;
        end = _end;

        uint256 total;
        // C4-Audit Fix for Issue # 81
        for (uint256 i = 0; i < vesters.length; ++i) {
            require(
                amounts[i] != 0,
                "LinearVesting::begin: Incorrect Amount Specified"
            );
            require(
                vesters[i] != _ZERO_ADDRESS,
                "LinearVesting::begin: Zero Vester Address Specified"
            );
            require(
                vest[vesters[i]].amount == 0,
                "LinearVesting::begin: Duplicate Vester Entry Specified"
            );
            vest[vesters[i]] = Vester(
                amounts[i],
                0,
                uint128(_start),
                uint128(_end)
            );
            total = total + amounts[i];
        }
        require(
            total == _TEAM_ALLOCATION,
            "LinearVesting::begin: Invalid Vest Amounts Specified"
        );

        require(
            vader.balanceOf(address(this)) >= _TEAM_ALLOCATION,
            "LinearVesting::begin: Vader is less than TEAM_ALLOCATION"
        );

        emit VestingInitialized(_VESTING_DURATION);

        renounceOwnership();
    }

    /**
     * @dev Adds a new vesting schedule to the contract.
     *
     * Requirements:
     * - Only {converter} can call.
     */
    function vestFor(address user, uint256 amount)
        external
        override
        onlyConverter
        hasStarted
    {
        require(
            amount <= type(uint192).max,
            "LinearVesting::vestFor: Amount Overflows uint192"
        );
        require(
            vest[user].amount == 0,
            "LinearVesting::vestFor: Already a vester"
        );
        vest[user] = Vester(
            uint192(amount),
            0,
            uint128(block.timestamp),
            uint128(block.timestamp + 365 days)
        );
        vader.transferFrom(msg.sender, address(this), amount);

        emit VestingCreated(user, amount);
    }

    /* ========== PRIVATE FUNCTIONS ========== */

    function _getClaim(
        uint256 amount,
        uint256 lastClaim,
        uint256 _start,
        uint256 _end
    ) private view returns (uint256) {
        if (block.timestamp >= _end) return amount;
        if (lastClaim == 0) lastClaim = _start;

        return (amount * (block.timestamp - lastClaim)) / (_end - lastClaim);
    }

    /**
     * @dev Validates that the vesting period has started
     */
    function _hasStarted() private view {
        require(
            start != 0,
            "LinearVesting::_hasStarted: Vesting hasn't started yet"
        );
    }

    /*
     * @dev Ensures that only converter is able to call a function.
     **/
    function _onlyConverter() private view {
        require(
            msg.sender == converter,
            "LinearVesting::_onlyConverter: Only converter is allowed to call"
        );
    }

    /* ========== MODIFIERS ========== */

    /**
     * @dev Throws if the vesting period hasn't started
     */
    modifier hasStarted() {
        _hasStarted();
        _;
    }

    /*
     * @dev Throws if called by address that is not converter.
     **/
    modifier onlyConverter() {
        _onlyConverter();
        _;
    }
}
