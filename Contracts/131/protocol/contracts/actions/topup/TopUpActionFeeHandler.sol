// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

import "../../../interfaces/actions/IActionFeeHandler.sol";
import "../../../interfaces/IController.sol";
import "../../../interfaces/tokenomics/IKeeperGauge.sol";

import "../../../libraries/Errors.sol";
import "../../../libraries/ScaledMath.sol";
import "../../../libraries/AddressProviderHelpers.sol";

import "../../LpToken.sol";
import "../../access/Authorization.sol";
import "../../pool/LiquidityPool.sol";
import "../../utils/Preparable.sol";

/**
 * @notice Contract to manage the distribution of protocol fees
 */
contract TopUpActionFeeHandler is IActionFeeHandler, Authorization, Preparable {
    using ScaledMath for uint256;
    using SafeERC20Upgradeable for LpToken;
    using AddressProviderHelpers for IAddressProvider;

    bytes32 internal constant _KEEPER_FEE_FRACTION_KEY = "KeeperFee";
    bytes32 internal constant _KEEPER_GAUGE_KEY = "KeeperGauge";
    bytes32 internal constant _TREASURY_FEE_FRACTION_KEY = "TreasuryFee";

    address public immutable actionContract;
    IController public immutable controller;

    mapping(address => uint256) public treasuryAmounts;
    mapping(address => mapping(address => uint256)) public keeperRecords;

    event KeeperFeesClaimed(address indexed keeper, address token, uint256 totalClaimed);

    event FeesPayed(
        address indexed payer,
        address indexed keeper,
        address token,
        uint256 amount,
        uint256 keeperAmount,
        uint256 lpAmount
    );

    constructor(
        IController _controller,
        address _actionContract,
        uint256 keeperFee,
        uint256 treasuryFee
    ) Authorization(_controller.addressProvider().getRoleManager()) {
        require(keeperFee + treasuryFee <= ScaledMath.ONE, Error.INVALID_AMOUNT);
        actionContract = _actionContract;
        controller = _controller;
        _setConfig(_KEEPER_FEE_FRACTION_KEY, keeperFee);
        _setConfig(_TREASURY_FEE_FRACTION_KEY, treasuryFee);
    }

    function setInitialKeeperGaugeForToken(address lpToken, address _keeperGauge)
        external
        override
        onlyGovernance
        returns (bool)
    {
        require(getKeeperGauge(lpToken) == address(0), Error.ZERO_ADDRESS_NOT_ALLOWED);
        require(_keeperGauge != address(0), Error.ZERO_ADDRESS_NOT_ALLOWED);
        _setConfig(_getKeeperGaugeKey(lpToken), _keeperGauge);
        return true;
    }

    /**
     * @notice Transfers the keeper and treasury fees to the fee handler and burns LP fees.
     * @param payer Account who's position the fees are charged on.
     * @param beneficiary Beneficiary of the fees paid (usually this will be the keeper).
     * @param amount Total fee value (both keeper and LP fees).
     * @param lpTokenAddress Address of the lpToken used to pay fees.
     * @return `true` if successful.
     */
    function payFees(
        address payer,
        address beneficiary,
        uint256 amount,
        address lpTokenAddress
    ) external override returns (bool) {
        require(msg.sender == actionContract, Error.UNAUTHORIZED_ACCESS);
        // Handle keeper fees
        uint256 keeperAmount = amount.scaledMul(getKeeperFeeFraction());
        uint256 treasuryAmount = amount.scaledMul(getTreasuryFeeFraction());
        LpToken lpToken = LpToken(lpTokenAddress);

        lpToken.safeTransferFrom(msg.sender, address(this), amount);

        address keeperGauge = getKeeperGauge(lpTokenAddress);
        if (keeperGauge != address(0)) {
            IKeeperGauge(keeperGauge).reportFees(beneficiary, keeperAmount, lpTokenAddress);
        }

        // Accrue keeper and treasury fees here for periodic claiming
        keeperRecords[beneficiary][lpTokenAddress] += keeperAmount;
        treasuryAmounts[lpTokenAddress] += treasuryAmount;

        // Handle LP fees
        uint256 lpAmount = amount - keeperAmount - treasuryAmount;
        lpToken.burn(lpAmount);
        emit FeesPayed(payer, beneficiary, lpTokenAddress, amount, keeperAmount, lpAmount);
        return true;
    }

    /**
     * @notice Claim all accrued fees for an LPToken.
     * @param beneficiary Address to claim the fees for.
     * @param token Address of the lpToken for claiming.
     * @return `true` if successful.
     */
    function claimKeeperFeesForPool(address beneficiary, address token)
        external
        override
        returns (bool)
    {
        uint256 totalClaimable = keeperRecords[beneficiary][token];
        require(totalClaimable > 0, Error.NOTHING_TO_CLAIM);
        keeperRecords[beneficiary][token] = 0;

        LpToken lpToken = LpToken(token);
        lpToken.safeTransfer(beneficiary, totalClaimable);

        emit KeeperFeesClaimed(beneficiary, token, totalClaimable);
        return true;
    }

    /**
     * @notice Claim all accrued treasury fees for an LPToken.
     * @param token Address of the lpToken for claiming.
     * @return `true` if successful.
     */
    function claimTreasuryFees(address token) external override returns (bool) {
        uint256 claimable = treasuryAmounts[token];
        treasuryAmounts[token] = 0;
        LpToken(token).safeTransfer(controller.addressProvider().getRewardHandler(), claimable);
        return true;
    }

    /**
     * @notice Prepare update of keeper fee (with time delay enforced).
     * @param newKeeperFee New keeper fee value.
     * @return `true` if successful.
     */
    function prepareKeeperFee(uint256 newKeeperFee)
        external
        override
        onlyGovernance
        returns (bool)
    {
        require(newKeeperFee <= ScaledMath.ONE, Error.INVALID_AMOUNT);
        return _prepare(_KEEPER_FEE_FRACTION_KEY, newKeeperFee);
    }

    /**
     * @notice Execute update of keeper fee (with time delay enforced).
     * @dev Needs to be called after the update was prepared. Fails if called before time delay is met.
     * @return New keeper fee.
     */
    function executeKeeperFee() external override returns (uint256) {
        require(
            pendingUInts256[_TREASURY_FEE_FRACTION_KEY] +
                pendingUInts256[_KEEPER_FEE_FRACTION_KEY] <=
                ScaledMath.ONE,
            Error.INVALID_AMOUNT
        );
        return _executeUInt256(_KEEPER_FEE_FRACTION_KEY);
    }

    function resetKeeperFee() external override onlyGovernance returns (bool) {
        return _resetUInt256Config(_KEEPER_FEE_FRACTION_KEY);
    }

    function prepareKeeperGauge(address lpToken, address newKeeperGauge)
        external
        override
        onlyGovernance
        returns (bool)
    {
        return _prepare(_getKeeperGaugeKey(lpToken), newKeeperGauge);
    }

    function executeKeeperGauge(address lpToken) external override returns (address) {
        return _executeAddress(_getKeeperGaugeKey(lpToken));
    }

    function resetKeeperGauge(address lpToken) external override onlyGovernance returns (bool) {
        return _resetAddressConfig(_getKeeperGaugeKey(lpToken));
    }

    /**
     * @notice Prepare update of treasury fee (with time delay enforced).
     * @param newTreasuryFee New treasury fee value.
     * @return `true` if successful.
     */
    function prepareTreasuryFee(uint256 newTreasuryFee)
        external
        override
        onlyGovernance
        returns (bool)
    {
        require(newTreasuryFee <= ScaledMath.ONE, Error.INVALID_AMOUNT);
        return _prepare(_TREASURY_FEE_FRACTION_KEY, newTreasuryFee);
    }

    /**
     * @notice Execute update of treasury fee (with time delay enforced).
     * @dev Needs to be called after the update was prepared. Fails if called before time delay is met.
     * @return New treasury fee.
     */
    function executeTreasuryFee() external override returns (uint256) {
        require(
            pendingUInts256[_TREASURY_FEE_FRACTION_KEY] +
                pendingUInts256[_KEEPER_FEE_FRACTION_KEY] <=
                ScaledMath.ONE,
            Error.INVALID_AMOUNT
        );
        return _executeUInt256(_TREASURY_FEE_FRACTION_KEY);
    }

    function resetTreasuryFee() external override onlyGovernance returns (bool) {
        return _resetUInt256Config(_TREASURY_FEE_FRACTION_KEY);
    }

    function getKeeperFeeFraction() public view override returns (uint256) {
        return currentUInts256[_KEEPER_FEE_FRACTION_KEY];
    }

    function getKeeperGauge(address lpToken) public view override returns (address) {
        return currentAddresses[_getKeeperGaugeKey(lpToken)];
    }

    function getTreasuryFeeFraction() public view override returns (uint256) {
        return currentUInts256[_TREASURY_FEE_FRACTION_KEY];
    }

    function _getKeeperGaugeKey(address lpToken) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(_KEEPER_GAUGE_KEY, lpToken));
    }
}
