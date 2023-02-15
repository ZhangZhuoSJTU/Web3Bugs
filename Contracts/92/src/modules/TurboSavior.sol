// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.10;

import {ERC4626} from "solmate/mixins/ERC4626.sol";
import {Auth, Authority} from "solmate/auth/Auth.sol";
import {ReentrancyGuard} from "solmate/utils/ReentrancyGuard.sol";
import {FixedPointMathLib} from "solmate/utils/FixedPointMathLib.sol";

import {Fei} from "../interfaces/Fei.sol";
import {CERC20} from "../interfaces/CERC20.sol";
import {Comptroller} from "../interfaces/Comptroller.sol";

import {TurboSafe} from "../TurboSafe.sol";
import {TurboMaster} from "../TurboMaster.sol";

/// @title Turbo Savior
/// @author Transmissions11
/// @notice Safe repayment module.
contract TurboSavior is Auth, ReentrancyGuard {
    using FixedPointMathLib for uint256;

    /*///////////////////////////////////////////////////////////////
                               IMMUTABLES
    //////////////////////////////////////////////////////////////*/

    /// @notice The Master contract.
    /// @dev Used to validate Safes are legitimate.
    TurboMaster public immutable master;

    /// @notice The Fei token on the network.
    Fei public immutable fei;

    /// @notice The Turbo Fuse Pool used by the Master.
    Comptroller public immutable pool;

    /// @notice The Fei cToken in the Turbo Fuse Pool.
    CERC20 public immutable feiTurboCToken;

    /*///////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    /// @notice Creates a new Turbo Savior contract.
    /// @param _master The Master of the Savior.
    /// @param _owner The owner of the Savior.
    /// @param _authority The Authority of the Savior.
    constructor(
        TurboMaster _master,
        address _owner,
        Authority _authority
    ) Auth(_owner, _authority) {
        master = _master;

        fei = Fei(address(master.fei()));

        pool = master.pool();

        feiTurboCToken = pool.cTokensByUnderlying(fei);
    }

    /*///////////////////////////////////////////////////////////////
                              LINE LOGIC
    //////////////////////////////////////////////////////////////*/

    /// @notice The minimum percentage debt must make up of the borrow limit for a Safe to be saved.
    /// @dev A fixed point number where 1e18 represents 100% and 0 represents 0%.
    uint256 public minDebtPercentageForSaving;

    /// @notice Emitted when the minimum debt percentage for saving is updated.
    /// @param newDefaultFeePercentage The new minimum debt percentage for saving.
    event MinDebtPercentageForSavingUpdated(address indexed user, uint256 newDefaultFeePercentage);

    /// @notice Sets the minimum debt percentage.
    /// @param newMinDebtPercentageForSaving The new minimum debt percentage.
    function setMinDebtPercentageForSaving(uint256 newMinDebtPercentageForSaving) external requiresAuth {
        // A minimum debt percentage over 100% makes no sense.
        require(newMinDebtPercentageForSaving <= 1e18, "PERCENT_TOO_HIGH");

        // Update the minimum debt percentage.
        minDebtPercentageForSaving = newMinDebtPercentageForSaving;

        emit MinDebtPercentageForSavingUpdated(msg.sender, newMinDebtPercentageForSaving);
    }

    /*///////////////////////////////////////////////////////////////
                              SAVE LOGIC
    //////////////////////////////////////////////////////////////*/

    /// @notice Emitted a save is executed.
    /// @param user The user who executed the save.
    /// @param safe The Safe that was saved.
    /// @param vault The Vault that was lessed.
    /// @param feiAmount The amount of Fei that was lessed.
    event SafeSaved(address indexed user, TurboSafe indexed safe, ERC4626 indexed vault, uint256 feiAmount);

    /// @notice Save a Safe (call less on owner's behalf to prevent liquidation).
    /// @param safe The Safe to be saved.
    /// @param vault The Vault to less from.
    /// @param feiAmount The amount of Fei to less from the Safe.
    function save(
        TurboSafe safe,
        ERC4626 vault,
        uint256 feiAmount
    ) external requiresAuth nonReentrant {
        // Ensure the Safe is registered with the Master.
        require(master.getSafeId(safe) != 0);

        emit SafeSaved(msg.sender, safe, vault, feiAmount);

        // Cache the Safe's collateral asset, saves a warm SLOAD below.
        CERC20 assetTurboCToken = safe.assetTurboCToken();

        // Get the Safe's asset's collateral factor in the Turbo Fuse Pool.
        (, uint256 collateralFactor) = pool.markets(assetTurboCToken);

        // Compute the value of the Safe's collateral. Rounded down to favor saving.
        uint256 borrowLimit = assetTurboCToken
            .balanceOf(address(safe))
            .mulWadDown(assetTurboCToken.exchangeRateStored())
            .mulWadDown(collateralFactor)
            .mulWadDown(pool.oracle().getUnderlyingPrice(assetTurboCToken));

        // Compute the value of the Safe's debt. Rounding up to favor saving them.
        uint256 debtValue = feiTurboCToken.borrowBalanceCurrent(address(safe)).mulWadUp(
            pool.oracle().getUnderlyingPrice(feiTurboCToken)
        );

        // Ensure the Safe's debt percentage is high enough to justify saving, otherwise revert.
        require(
            borrowLimit != 0 && debtValue.divWadUp(borrowLimit) >= minDebtPercentageForSaving,
            "DEBT_PERCENT_TOO_LOW"
        );

        // Less the Fei from the Safe.
        safe.less(vault, feiAmount);
    }
}
