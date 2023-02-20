// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "../../interfaces/IController.sol";
import "../../interfaces/tokenomics/IBkdToken.sol";
import "../../interfaces/tokenomics/IMinter.sol";

import "../../libraries/Errors.sol";
import "../../libraries/ScaledMath.sol";
import "../../libraries/AddressProviderHelpers.sol";

import "./BkdToken.sol";
import "../access/Authorization.sol";

contract Minter is IMinter, Authorization, ReentrancyGuard {
    using ScaledMath for uint256;
    using AddressProviderHelpers for IAddressProvider;

    uint256 private constant _INFLATION_DECAY_PERIOD = 365 days;

    // Lp Rates
    uint256 public immutable initialAnnualInflationRateLp;
    uint256 public immutable annualInflationDecayLp;
    uint256 public currentInflationAmountLp;

    // Keeper Rates
    uint256 public immutable initialPeriodKeeperInflation;
    uint256 public immutable initialAnnualInflationRateKeeper;
    uint256 public immutable annualInflationDecayKeeper;
    uint256 public currentInflationAmountKeeper;

    // AMM Rates
    uint256 public immutable initialPeriodAmmInflation;
    uint256 public immutable initialAnnualInflationRateAmm;
    uint256 public immutable annualInflationDecayAmm;
    uint256 public currentInflationAmountAmm;

    bool public initialPeriodEnded;

    // Non-inflation rates
    uint256 public immutable nonInflationDistribution;
    uint256 public issuedNonInflationSupply;

    uint256 public lastInflationDecay;
    uint256 public currentTotalInflation;

    // Used for final safety check to ensure inflation is not exceeded
    uint256 public totalAvailableToNow;
    uint256 public totalMintedToNow;
    uint256 public lastEvent;

    IController public immutable controller;
    BkdToken public token;

    event TokensMinted(address beneficiary, uint256 amount);

    constructor(
        uint256 _annualInflationRateLp,
        uint256 _annualInflationRateKeeper,
        uint256 _annualInflationRateAmm,
        uint256 _annualInflationDecayLp,
        uint256 _annualInflationDecayKeeper,
        uint256 _annualInflationDecayAmm,
        uint256 _initialPeriodKeeperInflation,
        uint256 _initialPeriodAmmInflation,
        uint256 _nonInflationDistribution,
        IController _controller
    ) Authorization(_controller.addressProvider().getRoleManager()) {
        require(_annualInflationDecayLp < ScaledMath.ONE, Error.INVALID_PARAMETER_VALUE);
        require(_annualInflationDecayKeeper < ScaledMath.ONE, Error.INVALID_PARAMETER_VALUE);
        require(_annualInflationDecayAmm < ScaledMath.ONE, Error.INVALID_PARAMETER_VALUE);
        initialAnnualInflationRateLp = _annualInflationRateLp;
        initialAnnualInflationRateKeeper = _annualInflationRateKeeper;
        initialAnnualInflationRateAmm = _annualInflationRateAmm;

        annualInflationDecayLp = _annualInflationDecayLp;
        annualInflationDecayKeeper = _annualInflationDecayKeeper;
        annualInflationDecayAmm = _annualInflationDecayAmm;

        initialPeriodKeeperInflation = _initialPeriodKeeperInflation;
        initialPeriodAmmInflation = _initialPeriodAmmInflation;

        currentInflationAmountLp = _annualInflationRateLp / _INFLATION_DECAY_PERIOD;
        currentInflationAmountKeeper = _initialPeriodKeeperInflation / _INFLATION_DECAY_PERIOD;
        currentInflationAmountAmm = _initialPeriodAmmInflation / _INFLATION_DECAY_PERIOD;

        currentTotalInflation =
            currentInflationAmountLp +
            currentInflationAmountKeeper +
            currentInflationAmountAmm;

        nonInflationDistribution = _nonInflationDistribution;
        controller = _controller;
    }

    function setToken(address _token) external override onlyGovernance {
        require(address(token) == address(0), "Token already set!");
        token = BkdToken(_token);
    }

    function startInflation() external override onlyGovernance {
        require(lastEvent == 0, "Inflation has already started.");
        lastEvent = block.timestamp;
        lastInflationDecay = block.timestamp;
    }

    /**
     * @notice Update the inflation rate according to the piecewise linear schedule.
     * @dev This updates the inflation rate to the next linear segment in the inflations schedule.
     * @return `true` if successful.
     */
    function executeInflationRateUpdate() external override returns (bool) {
        return _executeInflationRateUpdate();
    }

    /**
     * @notice Mints BKD tokens to a specified address.
     * @dev Can only be called by the controller.
     * @param beneficiary Address to mint tokens for.
     * @param amount Amount of tokens to mint.
     * @return `true` if successful.
     */
    function mint(address beneficiary, uint256 amount)
        external
        override
        nonReentrant
        returns (bool)
    {
        require(msg.sender == address(controller.inflationManager()), Error.UNAUTHORIZED_ACCESS);
        if (lastEvent == 0) return false;
        return _mint(beneficiary, amount);
    }

    /**
     * @notice Mint tokens that are not part of the inflation schedule.
     * @dev The amount of tokens that can be minted in total is subject to a pre-set upper limit.
     * @param beneficiary Address to mint tokens for.
     * @param amount Amount of tokens to mint.
     * @return `true` if successful.
     */
    function mintNonInflationTokens(address beneficiary, uint256 amount)
        external
        override
        onlyGovernance
        returns (bool)
    {
        require(
            issuedNonInflationSupply + amount <= nonInflationDistribution,
            "Maximum non-inflation amount exceeded."
        );
        issuedNonInflationSupply += amount;
        token.mint(beneficiary, amount);
        emit TokensMinted(beneficiary, amount);
        return true;
    }

    /**
     * @notice Supplies the inflation rate for LPs per unit of time (seconds).
     * @return LP inflation rate.
     */
    function getLpInflationRate() external view override returns (uint256) {
        if (lastEvent == 0) return 0;
        return currentInflationAmountLp;
    }

    /**
     * @notice Supplies the inflation rate for keepers per unit of time (seconds).
     * @return keeper inflation rate.
     */
    function getKeeperInflationRate() external view override returns (uint256) {
        if (lastEvent == 0) return 0;
        return currentInflationAmountKeeper;
    }

    /**
     * @notice Supplies the inflation rate for LPs on AMMs per unit of time (seconds).
     * @return AMM inflation rate.
     */
    function getAmmInflationRate() external view override returns (uint256) {
        if (lastEvent == 0) return 0;
        return currentInflationAmountAmm;
    }

    function _executeInflationRateUpdate() internal returns (bool) {
        totalAvailableToNow += (currentTotalInflation * (block.timestamp - lastEvent));
        lastEvent = block.timestamp;
        if (block.timestamp >= lastInflationDecay + _INFLATION_DECAY_PERIOD) {
            currentInflationAmountLp = currentInflationAmountLp.scaledMul(annualInflationDecayLp);
            if (initialPeriodEnded) {
                currentInflationAmountKeeper = currentInflationAmountKeeper.scaledMul(
                    annualInflationDecayKeeper
                );
                currentInflationAmountAmm = currentInflationAmountAmm.scaledMul(
                    annualInflationDecayAmm
                );
            } else {
                currentInflationAmountKeeper =
                    initialAnnualInflationRateKeeper /
                    _INFLATION_DECAY_PERIOD;

                currentInflationAmountAmm = initialAnnualInflationRateAmm / _INFLATION_DECAY_PERIOD;
                initialPeriodEnded = true;
            }
            currentTotalInflation =
                currentInflationAmountLp +
                currentInflationAmountKeeper +
                currentInflationAmountAmm;
            controller.inflationManager().checkpointAllGauges();
            lastInflationDecay = block.timestamp;
        }
        return true;
    }

    function _mint(address beneficiary, uint256 amount) internal returns (bool) {
        totalAvailableToNow += ((block.timestamp - lastEvent) * currentTotalInflation);
        uint256 newTotalMintedToNow = totalMintedToNow + amount;
        require(newTotalMintedToNow <= totalAvailableToNow, "Mintable amount exceeded");
        totalMintedToNow = newTotalMintedToNow;
        lastEvent = block.timestamp;
        token.mint(beneficiary, amount);
        _executeInflationRateUpdate();
        emit TokensMinted(beneficiary, amount);
        return true;
    }
}
