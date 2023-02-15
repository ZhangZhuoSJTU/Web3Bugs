// SPDX-License-Identifier: BUSL-1.1

pragma solidity 0.8.6;

import "@yield-protocol/vault-interfaces/ICauldron.sol";
import "@yield-protocol/vault-interfaces/DataTypes.sol";
import "./ConvexStakingWrapper.sol";

/// @title Convex staking wrapper for Yield platform
/// @notice Enables use of convex LP positions as collateral while still receiving rewards
contract ConvexYieldWrapper is ConvexStakingWrapper {
    using TransferHelper for IERC20;

    /// @notice Mapping to keep track of the user & their vaults
    mapping(address => bytes12[]) public vaults;

    ICauldron public cauldron;

    /// @notice Event called when a vault is added for a user
    /// @param account The account for which vault is added
    /// @param vaultId The vaultId to be added
    event VaultAdded(address indexed account, bytes12 indexed vaultId);

    /// @notice Event called when a vault is removed for a user
    /// @param account The account for which vault is removed
    /// @param vaultId The vaultId to be removed
    event VaultRemoved(address indexed account, bytes12 indexed vaultId);

    /// @notice Event called when tokens are rescued from the contract
    /// @param token Address of the token being rescued
    /// @param amount Amount of the token being rescued
    /// @param destination Address to which the rescued tokens have been sent
    event Recovered(address indexed token, uint256 amount, address indexed destination);

    constructor(
        address curveToken_,
        address convexToken_,
        address convexPool_,
        uint256 poolId_,
        address join_,
        ICauldron cauldron_,
        string memory name,
        string memory symbol,
        uint8 decimals
    ) ConvexStakingWrapper(curveToken_, convexToken_, convexPool_, poolId_, join_, name, symbol, decimals) {
        cauldron = cauldron_;
    }

    /// @notice Points the collateral vault to the join storing the wrappedConvex
    /// @param join_ Join which will store the wrappedConvex of the user
    function point(address join_) external auth {
        collateralVault = join_;
    }

    /// @notice Adds a vault to the user's vault list
    /// @param vaultId The id of the vault being added
    function addVault(bytes12 vaultId) external {
        address account = cauldron.vaults(vaultId).owner;
        require(account != address(0), "No owner for the vault");
        bytes12[] storage vaults_ = vaults[account];
        uint256 vaultsLength = vaults_.length;

        for (uint256 i = 0; i < vaultsLength; i++) {
            require(vaults_[i] != vaultId, "Vault already added");
        }
        vaults_.push(vaultId);
        vaults[account] = vaults_;
        emit VaultAdded(account, vaultId);
    }

    /// @notice Remove a vault from the user's vault list
    /// @param vaultId The id of the vault being removed
    /// @param account The user from whom the vault needs to be removed
    function removeVault(bytes12 vaultId, address account) public {
        address owner = cauldron.vaults(vaultId).owner;
        if (account != owner) {
            bytes12[] storage vaults_ = vaults[account];
            uint256 vaultsLength = vaults_.length;
            bool found;
            for (uint256 i = 0; i < vaultsLength; i++) {
                if (vaults_[i] == vaultId) {
                    bool isLast = i == vaultsLength - 1;
                    if (!isLast) {
                        vaults_[i] = vaults_[vaultsLength - 1];
                    }
                    vaults_.pop();
                    found = true;
                    emit VaultRemoved(account, vaultId);
                    break;
                }
            }
            require(found, "Vault not found");
            vaults[account] = vaults_;
        }
    }

    /// @notice Get user's balance of collateral deposited in various vaults
    /// @param account_ User's address for which balance is requested
    /// @return User's balance of collateral
    function _getDepositedBalance(address account_) internal view override returns (uint256) {
        if (account_ == address(0) || account_ == collateralVault) {
            return 0;
        }

        bytes12[] memory userVault = vaults[account_];

        //add up all balances of all vaults registered in the wrapper and owned by the account
        uint256 collateral;
        DataTypes.Balances memory balance;
        uint256 userVaultLength = userVault.length;
        for (uint256 i = 0; i < userVaultLength; i++) {
            if (cauldron.vaults(userVault[i]).owner == account_) {
                balance = cauldron.balances(userVault[i]);
                collateral = collateral + balance.ink;
            }
        }

        //add to balance of this token
        return _balanceOf[account_] + collateral;
    }

    /// @dev Wrap convex token held by this contract and forward it to the `to` address
    /// @param to_ Address to send the wrapped token to
    /// @param from_ Address of the user whose token is being wrapped
    function wrap(address to_, address from_) external {
        require(!isShutdown, "shutdown");
        uint256 amount_ = IERC20(convexToken).balanceOf(address(this));
        require(amount_ > 0, "No convex token to wrap");

        _checkpoint([address(0), from_]);
        _mint(to_, amount_);
        IRewardStaking(convexPool).stake(amount_);

        emit Deposited(msg.sender, to_, amount_, false);
    }

    /// @dev Unwrap Wrapped convex token held by this contract, and send the unwrapped convex token to the `to` address
    /// @param to_ Address to send the unwrapped convex token to
    function unwrap(address to_) external {
        require(!isShutdown, "shutdown");
        uint256 amount_ = _balanceOf[address(this)];
        require(amount_ > 0, "No wrapped convex token");

        _checkpoint([address(0), to_]);
        _burn(address(this), amount_);
        IRewardStaking(convexPool).withdraw(amount_, false);
        IERC20(convexToken).safeTransfer(to_, amount_);

        emit Withdrawn(to_, amount_, false);
    }

    /// @notice A simple function to recover any ERC20 tokens
    /// @param token_ Address of the token being rescued
    /// @param amount_ Amount of the token being rescued
    /// @param destination_ Address to which the rescued tokens have been sent
    function recoverERC20(
        address token_,
        uint256 amount_,
        address destination_
    ) external auth {
        require(amount_ != 0, "amount is 0");
        IERC20(token_).safeTransfer(destination_, amount_);
        emit Recovered(token_, amount_, destination_);
    }

    /// @notice A function to shutdown the contract & withdraw the staked convex tokens & transfer rewards
    /// @param rescueAddress_ Address to which the rescued tokens would be sent to
    function shutdownAndRescue(address rescueAddress_) external auth {
        uint256 balance_ = IRewardStaking(convexPool).balanceOf(address(this));

        if (balance_ != 0) {
            // Withdraw the convex tokens from the convex pool
            IRewardStaking(convexPool).withdraw(balance_, true);

            // Transfer the withdrawn convex tokens to rescue address
            IERC20(convexToken).safeTransfer(rescueAddress_, balance_);
        }
        // Shutdown the contract
        isShutdown = true;
    }
}
