// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "./IFYToken.sol";
import "./IOracle.sol";
import "./DataTypes.sol";


interface ICauldron {

    /// @dev Rate (borrowing rate) accruals oracle for an underlying
    function rateOracles(bytes6 baseId) external view returns (IOracle);

    /// @dev An user can own one or more Vaults, with each vault being able to borrow from a single series.
    function vaults(bytes12 vault) external view returns (DataTypes.Vault memory);

    /// @dev Series available in Cauldron.
    function series(bytes6 seriesId) external view returns (DataTypes.Series memory);

    /// @dev Assets available in Cauldron.
    function assets(bytes6 assetsId) external view returns (address);

    /// @dev Each vault records debt and collateral balances_.
    function balances(bytes12 vault) external view returns (DataTypes.Balances memory);

    /// @dev Time at which a vault entered liquidation.
    function auctions(bytes12 vault) external view returns (uint32);

    /// @dev Create a new vault, linked to a series (and therefore underlying) and up to 5 collateral types
    function build(address owner, bytes12 vaultId, bytes6 seriesId, bytes6 ilkId) external returns (DataTypes.Vault memory);

    /// @dev Destroy an empty vault. Used to recover gas costs.
    function destroy(bytes12 vault) external;

    /// @dev Change a vault series and/or collateral types.
    function tweak(bytes12 vaultId, bytes6 seriesId, bytes6 ilkId) external returns (DataTypes.Vault memory);

    /// @dev Give a vault to another user.
    function give(bytes12 vaultId, address receiver) external returns (DataTypes.Vault memory);

    /// @dev Move collateral and debt between vaults.
    function stir(bytes12 from, bytes12 to, uint128 ink, uint128 art) external returns (DataTypes.Balances memory, DataTypes.Balances memory);

    /// @dev Manipulate a vault debt and collateral.
    function pour(bytes12 vaultId, int128 ink, int128 art) external returns (DataTypes.Balances memory);

    /// @dev Change series and debt of a vault.
    /// The module calling this function also needs to buy underlying in the pool for the new series, and sell it in pool for the old series.
    function roll(bytes12 vaultId, bytes6 seriesId, int128 art) external returns (DataTypes.Vault memory, DataTypes.Balances memory);

    /// @dev Give a non-timestamped vault to another user, and timestamp it.
    /// To be used for liquidation engines.
    function grab(bytes12 vault, address receiver) external;

    /// @dev Reduce debt and collateral from a vault, ignoring collateralization checks.
    function slurp(bytes12 vaultId, uint128 ink, uint128 art) external returns (DataTypes.Balances memory);

    // ==== Accounting ====

    /// @dev Record the borrowing rate at maturity for a series
    function mature(bytes6 seriesId) external;
    
    /// @dev Retrieve the rate accrual since maturity, maturing if necessary.
    function accrual(bytes6 seriesId) external returns (uint256);
}