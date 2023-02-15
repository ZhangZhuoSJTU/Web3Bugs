// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.10;

import {ERC20} from "solmate/tokens/ERC20.sol";
import {Auth, Authority} from "solmate/auth/Auth.sol";
import {ReentrancyGuard} from "solmate/utils/ReentrancyGuard.sol";
import {SafeTransferLib} from "solmate/utils/SafeTransferLib.sol";

import {Fei} from "../interfaces/Fei.sol";
import {CERC20} from "../interfaces/CERC20.sol";

import {TurboSafe} from "../TurboSafe.sol";
import {TurboMaster} from "../TurboMaster.sol";

/// @title Turbo Gibber
/// @author Transmissions11
/// @notice Atomic impounder module.
contract TurboGibber is Auth, ReentrancyGuard {
    using SafeTransferLib for Fei;

    /*///////////////////////////////////////////////////////////////
                               IMMUTABLES
    //////////////////////////////////////////////////////////////*/

    /// @notice The Master contract.
    /// @dev Used to validate Safes are legitimate.
    TurboMaster public immutable master;

    /// @notice The Fei token on the network.
    Fei public immutable fei;

    /// @notice The Fei cToken in the Turbo Fuse Pool.
    CERC20 public immutable feiTurboCToken;

    /*///////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    /// @notice Creates a new Turbo Gibber contract.
    /// @param _master The Master of the Gibber.
    /// @param _owner The owner of the Gibber.
    /// @param _authority The Authority of the Gibber.
    constructor(
        TurboMaster _master,
        address _owner,
        Authority _authority
    ) Auth(_owner, _authority) {
        master = _master;

        fei = Fei(address(master.fei()));

        feiTurboCToken = master.pool().cTokensByUnderlying(fei);

        // Preemptively approve to the Fei cToken in the Turbo Fuse Pool.
        fei.safeApprove(address(feiTurboCToken), type(uint256).max);
    }

    /*///////////////////////////////////////////////////////////////
                          ATOMIC IMPOUND LOGIC
    //////////////////////////////////////////////////////////////*/

    /// @notice Emitted an impound is executed.
    /// @param user The user who executed the impound.
    /// @param safe The Safe that was impounded.
    /// @param feiAmount The amount of Fei that was repaid.
    /// @param assetAmount The amount of assets impounded.
    event ImpoundExecuted(address indexed user, TurboSafe indexed safe, uint256 feiAmount, uint256 assetAmount);

    /// @notice Impound a safe.
    /// @param safe The Safe to be impounded.
    /// @param feiAmount The amount of Fei to repay the Safe's debt with.
    /// @param assetAmount The amount of assets to impound.
    /// @param to The recipient of the impounded collateral tokens.
    function impound(
        TurboSafe safe,
        uint256 feiAmount,
        uint256 assetAmount,
        address to
    ) external requiresAuth nonReentrant {
        // Ensure the Safe is registered with the Master.
        require(master.getSafeId(safe) != 0);

        emit ImpoundExecuted(msg.sender, safe, feiAmount, assetAmount);

        // Mint the Fei amount requested.
        fei.mint(address(this), feiAmount);

        // Repay the safe's Fei debt with the minted Fei, ensuring to catch cToken errors.
        require(feiTurboCToken.repayBorrowBehalf(address(safe), feiAmount) == 0, "REPAY_FAILED");

        // Impound some of the safe's collateral and send it to the chosen recipient.
        safe.gib(to, assetAmount);
    }

    /// @notice Impound all of a safe's collateral.
    /// @param safe The Safe to be impounded.
    /// @param to The recipient of the impounded collateral tokens.
    function impoundAll(TurboSafe safe, address to) external requiresAuth nonReentrant {
        // Ensure the Safe is registered with the Master.
        require(master.getSafeId(safe) != 0);

        // Get the asset cToken in the Turbo Fuse Pool.
        CERC20 assetTurboCToken = safe.assetTurboCToken();

        // Get the amount of assets to impound from the Safe.
        uint256 assetAmount = assetTurboCToken.balanceOfUnderlying(address(safe));

        // Get the amount of Fei debt to repay for the Safe.
        uint256 feiAmount = feiTurboCToken.borrowBalanceCurrent(address(safe));

        emit ImpoundExecuted(msg.sender, safe, feiAmount, assetAmount);

        // Mint the Fei amount requested.
        fei.mint(address(this), feiAmount);

        // Repay the safe's Fei debt with the minted Fei, ensuring to catch cToken errors.
        require(feiTurboCToken.repayBorrowBehalf(address(safe), feiAmount) == 0, "REPAY_FAILED");

        // Impound all of the safe's collateral and send it to the chosen recipient.
        safe.gib(to, assetAmount);
    }
}
