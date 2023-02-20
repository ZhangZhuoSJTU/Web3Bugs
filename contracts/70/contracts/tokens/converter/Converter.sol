// SPDX-License-Identifier: Unlicense

pragma solidity =0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

import "../../shared/ProtocolConstants.sol";

import "../../interfaces/tokens/converter/IConverter.sol";
import "../../interfaces/tokens/vesting/ILinearVesting.sol";

/**
 * @dev Implementation of the {IConverter} interface.
 *
 * A simple converter contract that allows users to convert
 * their Vether tokens by "burning" them (See {convert}) to
 * acquire their equivalent Vader tokens based on the constant
 * {VADER_VETHER_CONVERSION_RATE}.
 *
 * The contract assumes that it has been sufficiently funded with
 * Vader tokens and will fail to execute trades if it has not been
 * done so yet.
 */
contract Converter is IConverter, ProtocolConstants, Ownable {
    /* ========== LIBRARIES ========== */

    // Using MerkleProof for validating claims
    using MerkleProof for bytes32[];

    /* ========== STATE VARIABLES ========== */

    // The VETHER token
    IERC20 public immutable vether;

    // The VADER token
    IERC20 public immutable vader;

    // The VADER vesting contract
    ILinearVesting public vesting;

    // The merkle proof root for validating claims
    bytes32 public immutable root;

    // Unique deployment salt
    uint256 public immutable salt;

    // Signals whether a particular leaf has been claimed of the merkle proof
    mapping(bytes32 => bool) public claimed;

    /* ========== CONSTRUCTOR ========== */

    /**
     * @dev Initializes the contract's {vether} and {vader} addresses.
     *
     * Performs rudimentary checks to ensure that the variables haven't
     * been declared incorrectly.
     */
    constructor(
        IERC20 _vether,
        IERC20 _vader,
        bytes32 _root,
        uint256 _salt
    ) {
        require(
            _vether != IERC20(_ZERO_ADDRESS) && _vader != IERC20(_ZERO_ADDRESS),
            "Converter::constructor: Misconfiguration"
        );

        vether = _vether;
        vader = _vader;

        root = _root;
        salt = _salt;
    }

    /* ========== RESTRICTED FUNCTIONS ========== */

    /*
     * @dev Sets address of vesting contract.
     *
     * The LinearVesting and Converter contracts are dependent upon
     * each other, hence this setter is introduced.
     *
     * Also approves Vesting to spend Vader tokens on its behalf.
     *
     **/
    function setVesting(ILinearVesting _vesting) external onlyOwner {
        require(
            vesting == ILinearVesting(_ZERO_ADDRESS),
            "Converter::setVesting: Vesting is already set"
        );
        require(
            _vesting != ILinearVesting(_ZERO_ADDRESS),
            "Converter::setVesting: Cannot Set Zero Vesting Address"
        );
        vader.approve(address(_vesting), type(uint256).max);
        vesting = _vesting;
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    /**
     * @dev Allows a user to convert their Vether to Vader.
     *
     * Emits a {Conversion} event indicating the amount of Vether the user
     * "burned" and the amount of Vader that they acquired.
     *
     * Here, "burned" refers to the action of transferring them to an irrecoverable
     * address, the {BURN} address.
     *
     * Requirements:
     *
     * - the caller has approved the contract for the necessary amount via Vether
     * - the amount specified is non-zero
     * - the contract has been supplied with the necessary Vader amount to fulfill the trade
     */
    function convert(bytes32[] calldata proof, uint256 amount, uint256 minVader)
        external
        override
        returns (uint256 vaderReceived)
    {
        require(
            amount != 0,
            "Converter::convert: Non-Zero Conversion Amount Required"
        );

        ILinearVesting _vesting = vesting;

        require(
            _vesting != ILinearVesting(_ZERO_ADDRESS),
            "Converter::convert: Vesting is not set"
        );

        bytes32 leaf = keccak256(
            abi.encodePacked(msg.sender, amount, salt, getChainId())
        );
        require(
            !claimed[leaf] && proof.verify(root, leaf),
            "Converter::convert: Incorrect Proof Provided"
        );
        claimed[leaf] = true;

        uint256 allowance = vether.allowance(msg.sender, address(this));

        amount = amount > allowance ? allowance : amount;

        // NOTE: FoT is ignored as units are meant to be burned anyway
        vether.transferFrom(msg.sender, _BURN, amount);

        vaderReceived = amount * _VADER_VETHER_CONVERSION_RATE;
        require(vaderReceived >= minVader, "Converter::convert: Vader < min");

        emit Conversion(msg.sender, amount, vaderReceived);

        uint256 half = vaderReceived / 2;
        vader.transfer(msg.sender, half);
        _vesting.vestFor(msg.sender, vaderReceived - half);
    }

    /* ========== INTERNAL FUNCTIONS ========== */
    /*
     * @dev Returns the {chainId} of current network.
     **/
    function getChainId() internal view returns (uint256 chainId) {
        assembly {
            chainId := chainid()
        }
    }
}
