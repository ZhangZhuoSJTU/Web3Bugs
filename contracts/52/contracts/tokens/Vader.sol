// SPDX-License-Identifier: Unlicense

pragma solidity =0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "../shared/ProtocolConstants.sol";

import "../interfaces/tokens/IUSDV.sol";
import "../interfaces/tokens/IVader.sol";
import "../interfaces/tokens/vesting/ILinearVesting.sol";
import "../interfaces/tokens/converter/IConverter.sol";

/**
 * @dev Implementation of the {IVader} interface.
 *
 * The Vader token that acts as the backbone of the Vader protocol,
 * burned and minted to mint and burn USDV tokens respectively.
 *
 * The token contains a dynamically adjusting fee that fluctuates
 * between 0% and 1% depending on the total supply of the token
 * in comparison to the maximum supply possible, which is initially
 * equal to 2.5 billion units.
 *
 * A daily emission schedule is built in the contract as well,
 * meant to supply the Vader USDV treasury at a diminishing
 * rate that inches closer to 0 as the total supply of the token
 * nears the maximum supply possible.
 */
contract Vader is IVader, ProtocolConstants, ERC20, Ownable {
    /* ========== STATE VARIABLES ========== */

    // The Vader <-> Vether converter contract
    IConverter public converter;

    // The Vader Team vesting contract
    ILinearVesting public vest;

    // The USDV contract, used to apply proper access control
    IUSDV public usdv;

    // The adjustable emission curve of the protocol, used as a divisor
    uint256 public emissionCurve = _INITIAL_EMISSION_CURVE;

    // The last emission's timestamp expressed in seconds
    uint256 public lastEmission = block.timestamp;

    // The initial maximum supply of the token, equivalent to 2.5 bn units
    uint256 public maxSupply = _INITIAL_VADER_SUPPLY;

    // A list of addresses that do not have a tax applied to them, used for system components
    mapping(address => bool) public untaxed;

    /* ========== CONSTRUCTOR ========== */

    /**
     * @dev Mints the ecosystem growth fund described in the whitepaper to the
     * token contract itself.
     *
     * As the token is meant to be minted and burned freely between USDV and itself,
     * there is no real initialization taking place apart from the initially minted
     * supply for the following components:
     *
     * - Ecosystem Growth: An allocation that is released to strategic partners for the
     * protocol's expansion
     *
     * - Team Allocation: An allocation that is gradually vested over a 2 year duration to
     * the Vader team to incentivize maintainance of the protocol
     *
     * - Vether Holder Allocation: An allocation that is immediately available to all existing
     * and future Vether holders that allows them to swap their Vether for Vader by burning the
     * former
     *
     * The latter two of the allocations are minted at a later date given that the addresses of
     * the converter and vesting contract are not known on deployment.
     */
    constructor() ERC20("Vader", "VADER") {
        _mint(address(this), _ECOSYSTEM_GROWTH);
    }

    /* ========== VIEWS ========== */

    /**
     * @dev Returns the current fee that the protocol applies to transactions. The fee
     * organically adjusts itself as the actual total supply of the token fluctuates and
     * will always hold a value between [0%, 1%] expressed in basis points.
     */
    function calculateFee() public view override returns (uint256 basisPoints) {
        basisPoints = (_MAX_FEE_BASIS_POINTS * totalSupply()) / maxSupply;
    }

    /**
     * @dev Returns the current era's emission based on the existing total supply of the
     * token. The era emissions diminish as the total supply of the token increases, inching
     * closer to 0 as the total supply reaches its cap.
     */
    function getCurrentEraEmission() external view override returns (uint256) {
        return getEraEmission(totalSupply());
    }

    /**
     * @dev Calculates and returns the constantly diminishing era emission based on the difference between
     * the current and maximum supply spread over a one year based in on the emission's era duration.
     */
    function getEraEmission(uint256 currentSupply)
        public
        view
        override
        returns (uint256)
    {
        return
            ((maxSupply - currentSupply) / emissionCurve) /
            (_ONE_YEAR / _EMISSION_ERA);
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    /**
     * @dev Creates a manual emission event
     *
     * Emits an {Emission} event indicating the amount emitted as well as what the current
     * era's timestamp is.
     */
    function createEmission(address user, uint256 amount)
        external
        override
        onlyOwner
    {
        _mint(user, amount);
        emit Emission(user, amount);
    }

    /* ========== RESTRICTED FUNCTIONS ========== */

    /**
     * @dev Sets the initial {converter}, {vest}, and {usdv} contract addresses prior to transferring
     * ownership to the DAO. Additionally, mints the Vader amount available for conversion as well
     * as the team allocation that is meant to be vested to each respective contract.
     *
     * Emits a {ProtocolInitialized} event indicating all the supplied values of the function.
     *
     * Requirements:
     *
     * - the caller must be the deployer of the contract
     * - the contract must not have already been initialized
     */
    function setComponents(
        IConverter _converter,
        ILinearVesting _vest,
        IUSDV _usdv,
        address dao
    ) external onlyOwner {
        require(
            _converter != IConverter(_ZERO_ADDRESS) &&
                _vest != ILinearVesting(_ZERO_ADDRESS) &&
                _usdv != IUSDV(_ZERO_ADDRESS) &&
                dao != _ZERO_ADDRESS,
            "Vader::setComponents: Incorrect Arguments"
        );
        require(
            converter == IConverter(_ZERO_ADDRESS),
            "Vader::setComponents: Already Set"
        );

        converter = _converter;
        vest = _vest;
        usdv = _usdv;

        untaxed[address(_converter)] = true;
        untaxed[address(_vest)] = true;
        untaxed[address(_usdv)] = true;

        _mint(address(_converter), _VETH_ALLOCATION);
        _mint(address(_vest), _TEAM_ALLOCATION);

        _vest.begin();
        transferOwnership(dao);

        emit ProtocolInitialized(
            address(_converter),
            address(_vest),
            address(_usdv),
            dao
        );
    }

    /**
     * @dev Allows a strategic partnership grant to be claimed.
     *
     * Emits a {GrantClaimed} event indicating the beneficiary of the grant as
     * well as the grant amount.
     *
     * Requirements:
     *
     * - the caller must be the DAO
     * - the token must hold sufficient Vader allocation for the grant
     * - the grant must be of a non-zero amount
     */
    function claimGrant(address beneficiary, uint256 amount) external onlyDAO {
        require(amount != 0, "Vader::claimGrant: Non-Zero Amount Required");
        emit GrantClaimed(beneficiary, amount);
        ERC20._transfer(address(this), beneficiary, amount);
    }

    /**
     * @dev Allows the maximum supply of the token to be adjusted.
     *
     * Emits an {MaxSupplyChanged} event indicating the previous and next maximum
     * total supplies.
     *
     * Requirements:
     *
     * - the caller must be the DAO
     * - the new maximum supply must be greater than the current one
     */
    function adjustMaxSupply(uint256 _maxSupply) external onlyDAO {
        require(
            _maxSupply >= totalSupply(),
            "Vader::adjustMaxSupply: Max supply cannot subcede current supply"
        );
        emit MaxSupplyChanged(maxSupply, _maxSupply);
        maxSupply = _maxSupply;
    }

    /* ========== INTERNAL FUNCTIONS ========== */

    /**
     * @dev Ensures that the daily emission of the token gets automatically executed
     * when the time is right and enforces the maximum supply limit on mint operations.
     */
    function _beforeTokenTransfer(
        address from,
        address,
        uint256 amount
    ) internal view override {
        if (from == address(0))
            require(
                totalSupply() + amount <= maxSupply,
                "Vader::_beforeTokenTransfer: Mint exceeds cap"
            );

        // _syncEmissions();
    }

    /**
     * @dev Overrides the existing ERC-20 {_transfer} functionality to apply a fee on each
     * transfer.
     */
    function _transfer(
        address sender,
        address recipient,
        uint256 amount
    ) internal override {
        if (untaxed[msg.sender])
            return ERC20._transfer(sender, recipient, amount);

        uint256 fee = calculateFee();

        uint256 tax = (amount * fee) / _MAX_BASIS_POINTS;

        amount -= tax;

        _burn(sender, tax);

        ERC20._transfer(sender, recipient, amount);
    }

    /* ========== PRIVATE FUNCTIONS ========== */

    /**
     * @dev Ensures only the DAO is able to invoke a particular function by validating that the
     * contract has been set up and that the owner is the msg.sender
     */
    function _onlyDAO() private view {
        require(
            converter != IConverter(_ZERO_ADDRESS),
            "Vader::_onlyDAO: DAO not set yet"
        );
        require(
            owner() == _msgSender(),
            "Vader::_onlyDAO: Insufficient Privileges"
        );
    }

    /* ========== MODIFIERS ========== */

    /**
     * @dev Throws if invoked by anyone else other than the DAO
     */
    modifier onlyDAO() {
        _onlyDAO();
        _;
    }

    /* ========== DEPRECATED FUNCTIONS ========== */

    /**
     * @dev Allows the daily emission curve of the token to be adjusted.
     *
     * Emits an {EmissionChanged} event indicating the previous and next emission
     * curves.
     *
     * Requirements:
     *
     * - the caller must be the DAO
     * - the new emission must be non-zero
     */
    // function adjustEmission(uint256 _emissionCurve) external onlyDAO {
    //     require(
    //         _emissionCurve != 0,
    //         "Vader::adjustEmission: Incorrect Curve Emission"
    //     );
    //     emit EmissionChanged(emissionCurve, _emissionCurve);
    //     emissionCurve = _emissionCurve;
    // }

    /**
     * @dev Syncs the current emission schedule by advancing the necessary epochs to match the
     * current timestamp and mints the corresponding Vader to the USDV contract for distribution
     * via the {distributeEmission} function.
     */
    // function _syncEmissions() private {
    //     uint256 currentSupply = totalSupply();
    //     uint256 _lastEmission = lastEmission;
    //     if (
    //         block.timestamp >= _lastEmission + _EMISSION_ERA &&
    //         maxSupply != currentSupply
    //     ) {
    //         uint256 eras = (block.timestamp - _lastEmission) / _EMISSION_ERA;

    //         // NOTE: Current Supply + Emission guaranteed to not overflow as <= maxSupply
    //         uint256 emission;
    //         for (uint256 i = 0; i < eras; i++)
    //             emission += getEraEmission(currentSupply + emission);

    //         _mint(address(usdv), emission);

    //         usdv.distributeEmission();

    //         _lastEmission += (_EMISSION_ERA * eras);
    //         lastEmission = _lastEmission;

    //         emit Emission(emission, _lastEmission);
    //     }
    // }
}
