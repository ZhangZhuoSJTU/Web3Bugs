// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.10;

import {ERC20} from "solmate/tokens/ERC20.sol";
import {ERC4626} from "solmate/mixins/ERC4626.sol";
import {Auth, Authority} from "solmate/auth/Auth.sol";
import {SafeTransferLib} from "solmate/utils/SafeTransferLib.sol";

import {FuseAdmin} from "./interfaces/FuseAdmin.sol";
import {Comptroller} from "./interfaces/Comptroller.sol";

import {TurboClerk} from "./modules/TurboClerk.sol";
import {TurboGibber} from "./modules/TurboGibber.sol";
import {TurboBooster} from "./modules/TurboBooster.sol";

import {TurboSafe} from "./TurboSafe.sol";

/// @title Turbo Master
/// @author Transmissions11
/// @notice Factory for creating and managing Turbo Safes.
/// @dev Must be authorized to call the Turbo Fuse Pool's FuseAdmin.
contract TurboMaster is Auth {
    using SafeTransferLib for ERC20;

    /*///////////////////////////////////////////////////////////////
                               IMMUTABLES
    //////////////////////////////////////////////////////////////*/

    /// @notice The Turbo Fuse Pool the Safes will interact with.
    Comptroller public immutable pool;

    /// @notice The Fei token on the network.
    ERC20 public immutable fei;

    /*///////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    /// @notice Creates a new Turbo Master contract.
    /// @param _pool The Turbo Fuse Pool the Master will use.
    /// @param _fei The Fei token on the network.
    /// @param _owner The owner of the Master.
    /// @param _authority The Authority of the Master.
    constructor(
        Comptroller _pool,
        ERC20 _fei,
        address _owner,
        Authority _authority
    ) Auth(_owner, _authority) {
        pool = _pool;

        fei = _fei;

        // Prevent the first safe from getting id 0.
        safes.push(TurboSafe(address(0)));
    }

    /*///////////////////////////////////////////////////////////////
                            BOOSTER STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @notice The Booster module used by the Master and its Safes.
    TurboBooster public booster;

    /// @notice Emitted when the Booster is updated.
    /// @param user The user who triggered the update of the Booster.
    /// @param newBooster The new Booster contract used by the Master.
    event BoosterUpdated(address indexed user, TurboBooster newBooster);

    /// @notice Update the Booster used by the Master.
    /// @param newBooster The new Booster contract to be used by the Master.
    function setBooster(TurboBooster newBooster) external requiresAuth {
        booster = newBooster;

        emit BoosterUpdated(msg.sender, newBooster);
    }

    /*///////////////////////////////////////////////////////////////
                             CLERK STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @notice The Clerk module used by the Master and its Safes.
    TurboClerk public clerk;

    /// @notice Emitted when the Clerk is updated.
    /// @param user The user who triggered the update of the Clerk.
    /// @param newClerk The new Clerk contract used by the Master.
    event ClerkUpdated(address indexed user, TurboClerk newClerk);

    /// @notice Update the Clerk used by the Master.
    /// @param newClerk The new Clerk contract to be used by the Master.
    function setClerk(TurboClerk newClerk) external requiresAuth {
        clerk = newClerk;

        emit ClerkUpdated(msg.sender, newClerk);
    }

    /*///////////////////////////////////////////////////////////////
                  DEFAULT SAFE AUTHORITY CONFIGURATION
    //////////////////////////////////////////////////////////////*/

    /// @notice The default authority to be used by created Safes.
    Authority public defaultSafeAuthority;

    /// @notice Emitted when the default safe authority is updated.
    /// @param user The user who triggered the update of the default safe authority.
    /// @param newDefaultSafeAuthority The new default authority to be used by created Safes.
    event DefaultSafeAuthorityUpdated(address indexed user, Authority newDefaultSafeAuthority);

    /// @notice Set the default authority to be used by created Safes.
    /// @param newDefaultSafeAuthority The new default safe authority.
    function setDefaultSafeAuthority(Authority newDefaultSafeAuthority) external requiresAuth {
        // Update the default safe authority.
        defaultSafeAuthority = newDefaultSafeAuthority;

        emit DefaultSafeAuthorityUpdated(msg.sender, newDefaultSafeAuthority);
    }

    /*///////////////////////////////////////////////////////////////
                             SAFE STORAGE
    //////////////////////////////////////////////////////////////*/

    /// @notice The total Fei currently boosting Vaults.
    uint256 public totalBoosted;

    /// @notice Maps Safe addresses to the id they are stored under in the Safes array.
    mapping(TurboSafe => uint256) public getSafeId;

    /// @notice Maps Vault addresses to the total amount of Fei they've being boosted with.
    mapping(ERC4626 => uint256) public getTotalBoostedForVault;

    /// @notice Maps collateral types to the total amount of Fei boosted by Safes using it as collateral.
    mapping(ERC20 => uint256) public getTotalBoostedAgainstCollateral;

    /// @notice An array of all Safes created by the Master.
    /// @dev The first Safe is purposely invalid to prevent any Safes from having an id of 0.
    TurboSafe[] public safes;

    /// @notice Returns all Safes created by the Master.
    /// @return An array of all Safes created by the Master.
    /// @dev This is provided because Solidity converts public arrays into index getters,
    /// but we need a way to allow external contracts and users to access the whole array.
    function getAllSafes() external view returns (TurboSafe[] memory) {
        return safes;
    }

    /*///////////////////////////////////////////////////////////////
                          SAFE CREATION LOGIC
    //////////////////////////////////////////////////////////////*/

    /// @notice Emitted when a new Safe is created.
    /// @param user The user who created the Safe.
    /// @param asset The asset of the Safe.
    /// @param safe The newly deployed Safe contract.
    /// @param id The index of the Safe in the safes array.
    event TurboSafeCreated(address indexed user, ERC20 indexed asset, TurboSafe safe, uint256 id);

    /// @notice Creates a new Turbo Safe which supports a specific asset.
    /// @param asset The ERC20 token that the Safe should accept.
    /// @return safe The newly deployed Turbo Safe which accepts the provided asset.
    function createSafe(ERC20 asset) external requiresAuth returns (TurboSafe safe, uint256 id) {
        // Create a new Safe using the default authority and provided asset.
        safe = new TurboSafe(msg.sender, defaultSafeAuthority, asset);

        // Add the safe to the list of Safes.
        safes.push(safe);

        unchecked {
            // Get the index/id of the new Safe.
            // Cannot underflow, we just pushed to it.
            id = safes.length - 1;
        }

        // Store the id/index of the new Safe.
        getSafeId[safe] = id;

        emit TurboSafeCreated(msg.sender, asset, safe, id);

        // Prepare a users array to whitelist the Safe.
        address[] memory users = new address[](1);
        users[0] = address(safe);

        // Prepare an enabled array to whitelist the Safe.
        bool[] memory enabled = new bool[](1);
        enabled[0] = true;

        // Whitelist the Safe to access the Turbo Fuse Pool.
        FuseAdmin(pool.admin())._setWhitelistStatuses(users, enabled);
    }

    /*///////////////////////////////////////////////////////////////
                          SAFE CALLBACK LOGIC
    //////////////////////////////////////////////////////////////*/

    /// @notice Callback triggered whenever a Safe boosts a Vault.
    /// @param asset The asset of the Safe.
    /// @param vault The Vault that was boosted.
    /// @param feiAmount The amount of Fei used to boost the Vault.
    function onSafeBoost(
        ERC20 asset,
        ERC4626 vault,
        uint256 feiAmount
    ) external {
        // Get the caller as a Safe instance.
        TurboSafe safe = TurboSafe(msg.sender);

        // Ensure the Safe was created by this Master.
        require(getSafeId[safe] != 0, "INVALID_SAFE");

        // Update the total amount of Fei being using to boost Vaults.
        totalBoosted += feiAmount;

        // Cache the new total boosted for the Vault.
        uint256 newTotalBoostedForVault;

        // Cache the new total boosted against the Vault's collateral.
        uint256 newTotalBoostedAgainstCollateral;

        unchecked {
            // Update the total amount of Fei being using to boost the Vault.
            // Cannot overflow because a Safe's total will never be greater than global total.
            getTotalBoostedForVault[vault] = (newTotalBoostedForVault = getTotalBoostedForVault[vault] + feiAmount);

            // Update the total amount of Fei boosted against the collateral type.
            // Cannot overflow because a collateral type's total will never be greater than global total.
            getTotalBoostedAgainstCollateral[asset] = (newTotalBoostedAgainstCollateral =
                getTotalBoostedAgainstCollateral[asset] +
                feiAmount);
        }

        // Check with the booster that the Safe is allowed to boost the Vault using this amount of Fei.
        require(
            booster.canSafeBoostVault(
                safe,
                asset,
                vault,
                feiAmount,
                newTotalBoostedForVault,
                newTotalBoostedAgainstCollateral
            ),
            "BOOSTER_REJECTED"
        );
    }

    /// @notice Callback triggered whenever a Safe withdraws from a Vault.
    /// @param asset The asset of the Safe.
    /// @param vault The Vault that was withdrawn from.
    /// @param feiAmount The amount of Fei withdrawn from the Vault.
    function onSafeLess(
        ERC20 asset,
        ERC4626 vault,
        uint256 feiAmount
    ) external {
        // Get the caller as a Safe instance.
        TurboSafe safe = TurboSafe(msg.sender);

        // Ensure the Safe was created by this Master.
        require(getSafeId[safe] != 0, "INVALID_SAFE");

        unchecked {
            // Update the total amount of Fei being using to boost the Vault.
            // Cannot underflow as the Safe validated the withdrawal amount before.
            getTotalBoostedForVault[vault] -= feiAmount;

            // Update the total amount of Fei being using to boost Vaults.
            // Cannot underflow as the Safe validated the withdrawal amount earlier.
            totalBoosted -= feiAmount;

            // Update the total amount of Fei boosted against the collateral type.
            // Cannot underflow as the Safe validated the withdrawal amount previously.
            getTotalBoostedAgainstCollateral[asset] -= feiAmount;
        }
    }

    /// @notice Callback triggered whenever a Safe harvests from a Vault.
    /// @param asset The asset of the Safe.
    /// @param vault The Vault that was harvested from.
    /// @param feiAmount The amount of Fei accrued as interest to the Safe.
    function onSafeSlurp(
        ERC20 asset,
        ERC4626 vault,
        uint256 feiAmount
    ) external {
        // Get the caller as a Safe instance.
        TurboSafe safe = TurboSafe(msg.sender);

        // Ensure the Safe was created by this Master.
        require(getSafeId[safe] != 0, "INVALID_SAFE");

        // Update the total amount of Fei being using to boost Vaults.
        totalBoosted += feiAmount;

        unchecked {
            // Update the total amount of Fei being using to boost the Vault.
            // Cannot overflow because a Safe's total will never be greater than global total.
            getTotalBoostedForVault[vault] += feiAmount;

            // Update the total amount of Fei boosted against the collateral type.
            // Cannot overflow because a collateral type's total will never be greater than global total.
            getTotalBoostedAgainstCollateral[asset] += feiAmount;
        }
    }

    /*///////////////////////////////////////////////////////////////
                              SWEEP LOGIC
    //////////////////////////////////////////////////////////////*/

    /// @notice Emitted a token is sweeped from the Master.
    /// @param user The user who sweeped the token from the Master.
    /// @param to The recipient of the sweeped tokens.
    /// @param amount The amount of the token that was sweeped.
    event TokenSweeped(address indexed user, address indexed to, ERC20 indexed token, uint256 amount);

    /// @notice Claim tokens sitting idly in the Master.
    /// @param to The recipient of the sweeped tokens.
    /// @param token The token to sweep and send.
    /// @param amount The amount of the token to sweep.
    function sweep(
        address to,
        ERC20 token,
        uint256 amount
    ) external requiresAuth {
        emit TokenSweeped(msg.sender, to, token, amount);

        // Transfer the sweeped tokens to the recipient.
        token.safeTransfer(to, amount);
    }
}
