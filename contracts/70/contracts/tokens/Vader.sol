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
 * The token has a fixed initial supply at 25 billion units that is meant to then
 * fluctuate depending on the amount of USDV minted into and burned from circulation.
 *
 * Emissions are initially controlled by the Vader team and then will be governed
 * by the DAO.
 */
contract Vader is IVader, ProtocolConstants, ERC20, Ownable {
    /* ========== STATE VARIABLES ========== */

    // The Vader <-> Vether converter contract
    IConverter public converter;

    // The Vader Team vesting contract
    ILinearVesting public vest;

    // The USDV contract, used to apply proper access control
    IUSDV public usdv;

    // The initial maximum supply of the token, equivalent to 25 bn units
    uint256 public maxSupply = _INITIAL_VADER_SUPPLY;

    /* ========== CONSTRUCTOR ========== */

    /**
     * @dev Mints the ecosystem growth fund and grant allocation amount described in the whitepaper to the
     * token contract itself.
     *
     * As the token is meant to be minted and burned freely between USDV and itself,
     * there is no real initialization taking place apart from the initially minted
     * supply for the following components:
     *
     * - Grant Allocation: The amount of funds meant to be distributed by the DAO as grants to expand the protocol
     *
     * - Ecosystem Growth: An allocation that is released to strategic partners for the
     * protocol's expansion
     *
     * The latter two of the allocations are minted at a later date given that the addresses of
     * the converter and vesting contract are not known on deployment.
     */
    constructor() ERC20("Vader", "VADER") {
        _mint(address(this), _GRANT_ALLOCATION);
        _mint(address(this), _ECOSYSTEM_GROWTH);
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
        _transfer(address(this), user, amount);
        emit Emission(user, amount);
    }

    /* ========== RESTRICTED FUNCTIONS ========== */

    /**
     * @dev Sets the initial {converter} and {vest} contract addresses. Additionally, mints
     * the Vader amount available for conversion as well as the team allocation that is meant
     * to be vested to each respective contract.
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
        address[] calldata vesters,
        uint192[] calldata amounts
    ) external onlyOwner {
        require(
            _converter != IConverter(_ZERO_ADDRESS) &&
                _vest != ILinearVesting(_ZERO_ADDRESS),
            "Vader::setComponents: Incorrect Arguments"
        );
        require(
            converter == IConverter(_ZERO_ADDRESS),
            "Vader::setComponents: Already Set"
        );

        converter = _converter;
        vest = _vest;

        _mint(address(_converter), _VETH_ALLOCATION);
        _mint(address(_vest), _TEAM_ALLOCATION);

        _vest.begin(vesters, amounts);

        emit ProtocolInitialized(
            address(_converter),
            address(_vest)
        );
    }

    /**
     * @dev Set USDV
     * Emits a {USDVSet} event indicating that USDV is set
     *
     * Requirements:
     *
     * - the caller must be owner
     * - USDV must be of a non-zero address
     * - USDV must not be set
     */
    function setUSDV(IUSDV _usdv) external onlyOwner {
        require(_usdv != IUSDV(_ZERO_ADDRESS), "Vader::setUSDV: Invalid USDV address");
        require(usdv == IUSDV(_ZERO_ADDRESS), "Vader::setUSDV: USDV already set");

        usdv = _usdv;
        emit USDVSet(address(_usdv));
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
    function claimGrant(address beneficiary, uint256 amount) external onlyOwner {
        require(amount != 0, "Vader::claimGrant: Non-Zero Amount Required");
        emit GrantClaimed(beneficiary, amount);
        _transfer(address(this), beneficiary, amount);
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
     * - the new maximum supply must be greater than the current supply
     */
    function adjustMaxSupply(uint256 _maxSupply) external onlyOwner {
        require(
            _maxSupply >= totalSupply(),
            "Vader::adjustMaxSupply: Max supply cannot subcede current supply"
        );
        emit MaxSupplyChanged(maxSupply, _maxSupply);
        maxSupply = _maxSupply;
    }

    /**
     * @dev Allows the USDV token to perform mints of VADER tokens
     *
     * Emits an ERC-20 {Transfer} event signaling the minting operation.
     *
     * Requirements:
     *
     * - the caller must be the USDV
     * - the new supply must be below the maximum supply
     */
    function mint(address _user, uint256 _amount) external onlyUSDV {
        require(
            maxSupply >= totalSupply() + _amount,
            "Vader::mint: Max supply reached"
        );
        _mint(_user, _amount);
    }

    /**
     * @dev Allows the USDV token to perform burns of VADER tokens
     *
     * Emits an ERC-20 {Transfer} event signaling the burning operation.
     *
     * Requirements:
     *
     * - the caller must be the USDV
     * - the USDV contract must have a sufficient VADER balance
     */
    function burn(uint256 _amount) external onlyUSDV {
        _burn(msg.sender, _amount);
    }

    /* ========== INTERNAL FUNCTIONS ========== */

    /* ========== PRIVATE FUNCTIONS ========== */

    /**
     * @dev Ensures only the USDV is able to invoke a particular function by validating that the
     * contract has been set up and that the msg.sender is the USDV address
     */
    function _onlyUSDV() private view {
        require(
            address(usdv) == msg.sender,
            "Vader::_onlyUSDV: Insufficient Privileges"
        );
    }

    /* ========== MODIFIERS ========== */

    /**
     * @dev Throws if invoked by anyone else other than the USDV
     */
    modifier onlyUSDV() {
        _onlyUSDV();
        _;
    }
}
