// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;
import "./interfaces/vault/IFYToken.sol";
import "./interfaces/vault/IJoin.sol";
import "./interfaces/vault/ICauldron.sol";
import "./interfaces/vault/IOracle.sol";
import "./interfaces/vault/DataTypes.sol";
import "./interfaces/yieldspace/IPool.sol";
import "./interfaces/external/IERC20.sol";
import "./interfaces/external/IERC2612.sol";
import "dss-interfaces/src/dss/DaiAbstract.sol";
import "./utils/access/AccessControl.sol";
import "./utils/token/TransferHelper.sol";
import "./interfaces/external/IWETH9.sol";
import "./math/WMul.sol";
import "./math/CastU256U128.sol";
import "./math/CastU128I128.sol";
import "./LadleStorage.sol";


/// @dev Ladle orchestrates contract calls throughout the Yield Protocol v2 into useful and efficient user oriented features.
contract Ladle is LadleStorage, AccessControl() {
    using WMul for uint256;
    using CastU256U128 for uint256;
    using CastU128I128 for uint128;
    using TransferHelper for IERC20;
    using TransferHelper for address payable;

    IWETH9 public immutable weth;

    constructor (ICauldron cauldron, IWETH9 weth_) LadleStorage(cauldron) {
        weth = weth_;
    }

    // ---- Data sourcing ----
    /// @dev Obtains a vault by vaultId from the Cauldron, and verifies that msg.sender is the owner
    function getOwnedVault(bytes12 vaultId)
        internal view returns(DataTypes.Vault memory vault)
    {
        vault = cauldron.vaults(vaultId);
        require (vault.owner == msg.sender, "Only vault owner");
    }

    /// @dev Obtains a series by seriesId from the Cauldron, and verifies that it exists
    function getSeries(bytes6 seriesId)
        internal view returns(DataTypes.Series memory series)
    {
        series = cauldron.series(seriesId);
        require (series.fyToken != IFYToken(address(0)), "Series not found");
    }

    /// @dev Obtains a join by assetId, and verifies that it exists
    function getJoin(bytes6 assetId)
        internal view returns(IJoin join)
    {
        join = joins[assetId];
        require (join != IJoin(address(0)), "Join not found");
    }

    /// @dev Obtains a pool by seriesId, and verifies that it exists
    function getPool(bytes6 seriesId)
        internal view returns(IPool pool)
    {
        pool = pools[seriesId];
        require (pool != IPool(address(0)), "Pool not found");
    }

    // ---- Administration ----

    /// @dev Add a new Join for an Asset, or replace an existing one for a new one.
    /// There can be only one Join per Asset. Until a Join is added, no tokens of that Asset can be posted or withdrawn.
    function addJoin(bytes6 assetId, IJoin join)
        external
        auth
    {
        address asset = cauldron.assets(assetId);
        require (asset != address(0), "Asset not found");
        require (join.asset() == asset, "Mismatched asset and join");
        joins[assetId] = join;
        emit JoinAdded(assetId, address(join));
    }

    /// @dev Add a new Pool for a Series, or replace an existing one for a new one.
    /// There can be only one Pool per Series. Until a Pool is added, it is not possible to borrow Base.
    function addPool(bytes6 seriesId, IPool pool)
        external
        auth
    {
        IFYToken fyToken = getSeries(seriesId).fyToken;
        require (fyToken == pool.fyToken(), "Mismatched pool fyToken and series");
        require (fyToken.underlying() == address(pool.base()), "Mismatched pool base and series");
        pools[seriesId] = pool;
        emit PoolAdded(seriesId, address(pool));
    }

    /// @dev Add or remove a module.
    function setModule(address module, bool set)
        external
        auth
    {
        modules[module] = set;
        emit ModuleSet(module, set);
    }

    /// @dev Set the fee parameter
    function setFee(uint256 fee)
        public
        auth    
    {
        borrowingFee = fee;
        emit FeeSet(fee);
    }

    // ---- Batching ----


    /// @dev Submit a series of calls for execution.
    /// Unlike `batch`, this function calls private functions, saving a CALL per function.
    /// It also caches the vault, which is useful in `build` + `pour` and `build` + `serve` combinations.
    function batch(
        Operation[] calldata operations,
        bytes[] calldata data
    ) external payable {
        require(operations.length == data.length, "Mismatched operation data");
        bytes12 cachedId;
        DataTypes.Vault memory vault;

        // Execute all operations in the batch. Conditionals ordered by expected frequency.
        for (uint256 i = 0; i < operations.length; i += 1) {

            Operation operation = operations[i];

            if (operation == Operation.BUILD) {
                (bytes12 vaultId, bytes6 seriesId, bytes6 ilkId) = abi.decode(data[i], (bytes12, bytes6, bytes6));
                (cachedId, vault) = (vaultId, _build(vaultId, seriesId, ilkId));   // Cache the vault that was just built
            
            } else if (operation == Operation.FORWARD_PERMIT) {
                (bytes6 id, bool isAsset, address spender, uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s) =
                    abi.decode(data[i], (bytes6, bool, address, uint256, uint256, uint8, bytes32, bytes32));
                _forwardPermit(id, isAsset, spender, amount, deadline, v, r, s);
            
            } else if (operation == Operation.JOIN_ETHER) {
                (bytes6 etherId) = abi.decode(data[i], (bytes6));
                _joinEther(etherId);
            
            } else if (operation == Operation.POUR) {
                (bytes12 vaultId, address to, int128 ink, int128 art) = abi.decode(data[i], (bytes12, address, int128, int128));
                if (cachedId != vaultId) (cachedId, vault) = (vaultId, getOwnedVault(vaultId));
                _pour(vaultId, vault, to, ink, art);
            
            } else if (operation == Operation.SERVE) {
                (bytes12 vaultId, address to, uint128 ink, uint128 base, uint128 max) = abi.decode(data[i], (bytes12, address, uint128, uint128, uint128));
                if (cachedId != vaultId) (cachedId, vault) = (vaultId, getOwnedVault(vaultId));
                _serve(vaultId, vault, to, ink, base, max);

            } else if (operation == Operation.ROLL) {
                (bytes12 vaultId, bytes6 newSeriesId, uint8 loan, uint128 max) = abi.decode(data[i], (bytes12, bytes6, uint8, uint128));
                if (cachedId != vaultId) (cachedId, vault) = (vaultId, getOwnedVault(vaultId));
                (vault,) = _roll(vaultId, vault, newSeriesId, loan, max);
            
            } else if (operation == Operation.FORWARD_DAI_PERMIT) {
                (bytes6 id, bool isAsset, address spender, uint256 nonce, uint256 deadline, bool allowed, uint8 v, bytes32 r, bytes32 s) =
                    abi.decode(data[i], (bytes6, bool, address, uint256, uint256, bool, uint8, bytes32, bytes32));
                _forwardDaiPermit(id, isAsset, spender, nonce, deadline, allowed, v, r, s);
            
            } else if (operation == Operation.TRANSFER_TO_POOL) {
                (bytes6 seriesId, bool base, uint128 wad) =
                    abi.decode(data[i], (bytes6, bool, uint128));
                IPool pool = getPool(seriesId);
                _transferToPool(pool, base, wad);
            
            } else if (operation == Operation.ROUTE) {
                (bytes6 seriesId, bytes memory poolCall) =
                    abi.decode(data[i], (bytes6, bytes));
                IPool pool = getPool(seriesId);
                _route(pool, poolCall);
            
            } else if (operation == Operation.EXIT_ETHER) {
                (address to) = abi.decode(data[i], (address));
                _exitEther(payable(to));
            
            } else if (operation == Operation.CLOSE) {
                (bytes12 vaultId, address to, int128 ink, int128 art) = abi.decode(data[i], (bytes12, address, int128, int128));
                if (cachedId != vaultId) (cachedId, vault) = (vaultId, getOwnedVault(vaultId));
                _close(vaultId, vault, to, ink, art);
            
            } else if (operation == Operation.REPAY) {
                (bytes12 vaultId, address to, int128 ink, uint128 min) = abi.decode(data[i], (bytes12, address, int128, uint128));
                if (cachedId != vaultId) (cachedId, vault) = (vaultId, getOwnedVault(vaultId));
                _repay(vaultId, vault, to, ink, min);
            
            } else if (operation == Operation.REPAY_VAULT) {
                (bytes12 vaultId, address to, int128 ink, uint128 max) = abi.decode(data[i], (bytes12, address, int128, uint128));
                if (cachedId != vaultId) (cachedId, vault) = (vaultId, getOwnedVault(vaultId));
                _repayVault(vaultId, vault, to, ink, max);

            } else if (operation == Operation.REPAY_LADLE) {
                (bytes12 vaultId) = abi.decode(data[i], (bytes12));
                if (cachedId != vaultId) (cachedId, vault) = (vaultId, getOwnedVault(vaultId));
                _repayLadle(vaultId, vault);

            } else if (operation == Operation.RETRIEVE) {
                (bytes6 assetId, bool isAsset, address to) = abi.decode(data[i], (bytes6, bool, address));
                _retrieve(assetId, isAsset, to);

            } else if (operation == Operation.TRANSFER_TO_FYTOKEN) {
                (bytes6 seriesId, uint256 amount) = abi.decode(data[i], (bytes6, uint256));
                IFYToken fyToken = getSeries(seriesId).fyToken;
                _transferToFYToken(fyToken, amount);
            
            } else if (operation == Operation.REDEEM) {
                (bytes6 seriesId, address to, uint256 amount) = abi.decode(data[i], (bytes6, address, uint256));
                IFYToken fyToken = getSeries(seriesId).fyToken;
                _redeem(fyToken, to, amount);
            
            } else if (operation == Operation.STIR) {
                (bytes12 from, bytes12 to, uint128 ink, uint128 art) = abi.decode(data[i], (bytes12, bytes12, uint128, uint128));
                _stir(from, to, ink, art);  // Too complicated to use caching here
            
            } else if (operation == Operation.TWEAK) {
                (bytes12 vaultId, bytes6 seriesId, bytes6 ilkId) = abi.decode(data[i], (bytes12, bytes6, bytes6));
                if (cachedId != vaultId) (cachedId, vault) = (vaultId, getOwnedVault(vaultId));
                vault = _tweak(vaultId, seriesId, ilkId);

            } else if (operation == Operation.GIVE) {
                (bytes12 vaultId, address to) = abi.decode(data[i], (bytes12, address));
                if (cachedId != vaultId) (cachedId, vault) = (vaultId, getOwnedVault(vaultId));
                vault = _give(vaultId, to);
                delete vault;   // Clear the cache, since the vault doesn't necessarily belong to msg.sender anymore
                cachedId = bytes12(0);

            } else if (operation == Operation.DESTROY) {
                (bytes12 vaultId) = abi.decode(data[i], (bytes12));
                if (cachedId != vaultId) (cachedId, vault) = (vaultId, getOwnedVault(vaultId));
                _destroy(vaultId);
                delete vault;   // Clear the cache
                cachedId = bytes12(0);
            
            } else if (operation == Operation.MODULE) {
                (address module, bytes memory moduleCall) = abi.decode(data[i], (address, bytes));
                _moduleCall(module, moduleCall);
            
            }
        }
    }

    // ---- Vault management ----

    /// @dev Create a new vault, linked to a series (and therefore underlying) and a collateral
    function _build(bytes12 vaultId, bytes6 seriesId, bytes6 ilkId)
        private
        returns(DataTypes.Vault memory vault)
    {
        return cauldron.build(msg.sender, vaultId, seriesId, ilkId);
    }

    /// @dev Change a vault series or collateral.
    function _tweak(bytes12 vaultId, bytes6 seriesId, bytes6 ilkId)
        private
        returns(DataTypes.Vault memory vault)
    {
        // tweak checks that the series and the collateral both exist and that the collateral is approved for the series
        return cauldron.tweak(vaultId, seriesId, ilkId);
    }

    /// @dev Give a vault to another user.
    function _give(bytes12 vaultId, address receiver)
        private
        returns(DataTypes.Vault memory vault)
    {
        return cauldron.give(vaultId, receiver);
    }

    /// @dev Destroy an empty vault. Used to recover gas costs.
    function _destroy(bytes12 vaultId)
        private
    {
        cauldron.destroy(vaultId);
    }

    // ---- Asset and debt management ----

    /// @dev Move collateral and debt between vaults.
    function _stir(bytes12 from, bytes12 to, uint128 ink, uint128 art)
        private
        returns (DataTypes.Balances memory, DataTypes.Balances memory)
    {
        if (ink > 0) require (cauldron.vaults(from).owner == msg.sender, "Only origin vault owner");
        if (art > 0) require (cauldron.vaults(to).owner == msg.sender, "Only destination vault owner");
        return cauldron.stir(from, to, ink, art);
    }

    /// @dev Add collateral and borrow from vault, pull assets from and push borrowed asset to user
    /// Or, repay to vault and remove collateral, pull borrowed asset from and push assets to user
    /// Borrow only before maturity.
    function _pour(bytes12 vaultId, DataTypes.Vault memory vault, address to, int128 ink, int128 art)
        private
        returns (DataTypes.Balances memory balances)
    {
        DataTypes.Series memory series;
        if (art != 0) series = getSeries(vault.seriesId);

        int128 fee;
        if (art > 0) fee = ((series.maturity - block.timestamp) * uint256(int256(art)).wmul(borrowingFee)).u128().i128();

        // Update accounting
        balances = cauldron.pour(vaultId, ink, art + fee);

        // Manage collateral
        if (ink != 0) {
            IJoin ilkJoin = getJoin(vault.ilkId);
            if (ink > 0) ilkJoin.join(vault.owner, uint128(ink));
            if (ink < 0) ilkJoin.exit(to, uint128(-ink));
        }

        // Manage debt tokens
        if (art != 0) {
            if (art > 0) series.fyToken.mint(to, uint128(art));
            else series.fyToken.burn(msg.sender, uint128(-art));
        }
    }

    /// @dev Add collateral and borrow from vault, so that a precise amount of base is obtained by the user.
    /// The base is obtained by borrowing fyToken and buying base with it in a pool.
    /// Only before maturity.
    function _serve(bytes12 vaultId, DataTypes.Vault memory vault, address to, uint128 ink, uint128 base, uint128 max)
        private
        returns (DataTypes.Balances memory balances, uint128 art)
    {
        IPool pool = getPool(vault.seriesId);
        
        art = pool.buyBasePreview(base);
        balances = _pour(vaultId, vault, address(pool), ink.i128(), art.i128());
        pool.buyBase(to, base, max);
    }

    /// @dev Repay vault debt using underlying token at a 1:1 exchange rate, without trading in a pool.
    /// It can add or remove collateral at the same time.
    /// The debt to repay is denominated in fyToken, even if the tokens pulled from the user are underlying.
    /// The debt to repay must be entered as a negative number, as with `pour`.
    /// Debt cannot be acquired with this function.
    function _close(bytes12 vaultId, DataTypes.Vault memory vault, address to, int128 ink, int128 art)
        private
        returns (DataTypes.Balances memory balances)
    {
        require (art < 0, "Only repay debt");                                          // When repaying debt in `frob`, art is a negative value. Here is the same for consistency.

        // Calculate debt in fyToken terms
        DataTypes.Series memory series = getSeries(vault.seriesId);
        uint128 amt = _debtInBase(vault.seriesId, series, uint128(-art));

        // Update accounting
        balances = cauldron.pour(vaultId, ink, art);

        // Manage collateral
        if (ink != 0) {
            IJoin ilkJoin = getJoin(vault.ilkId);
            if (ink > 0) ilkJoin.join(vault.owner, uint128(ink));
            if (ink < 0) ilkJoin.exit(to, uint128(-ink));
        }

        // Manage underlying
        IJoin baseJoin = getJoin(series.baseId);
        baseJoin.join(msg.sender, amt);
    }

    /// @dev Calculate a debt amount for a series in base terms
    function _debtInBase(bytes6 seriesId, DataTypes.Series memory series, uint128 art)
        private
        returns (uint128 amt)
    {
        if (uint32(block.timestamp) >= series.maturity) {
            amt = uint256(art).wmul(cauldron.accrual(seriesId)).u128();
        } else {
            amt = art;
        }
    }

    /// @dev Repay debt by selling base in a pool and using the resulting fyToken
    /// The base tokens need to be already in the pool, unaccounted for.
    /// Only before maturity. After maturity use close.
    function _repay(bytes12 vaultId, DataTypes.Vault memory vault, address to, int128 ink, uint128 min)
        private
        returns (DataTypes.Balances memory balances, uint128 art)
    {
        DataTypes.Series memory series = getSeries(vault.seriesId);
        IPool pool = getPool(vault.seriesId);

        art = pool.sellBase(address(series.fyToken), min);
        balances = _pour(vaultId, vault, to, ink, -(art.i128()));
    }

    /// @dev Repay all debt in a vault by buying fyToken from a pool with base.
    /// The base tokens need to be already in the pool, unaccounted for. The surplus base will be returned to msg.sender.
    /// Only before maturity. After maturity use close.
    function _repayVault(bytes12 vaultId, DataTypes.Vault memory vault, address to, int128 ink, uint128 max)
        private
        returns (DataTypes.Balances memory balances, uint128 base)
    {
        DataTypes.Series memory series = getSeries(vault.seriesId);
        IPool pool = getPool(vault.seriesId);

        balances = cauldron.balances(vaultId);
        base = pool.buyFYToken(address(series.fyToken), balances.art, max);
        balances = _pour(vaultId, vault, to, ink, -(balances.art.i128()));
        pool.retrieveBase(msg.sender);
    }

    /// @dev Change series and debt of a vault.
    function _roll(bytes12 vaultId, DataTypes.Vault memory vault, bytes6 newSeriesId, uint8 loan, uint128 max)
        private
        returns (DataTypes.Vault memory, DataTypes.Balances memory)
    {
        DataTypes.Series memory series = getSeries(vault.seriesId);
        DataTypes.Series memory newSeries = getSeries(newSeriesId);
        DataTypes.Balances memory balances = cauldron.balances(vaultId);
        
        uint128 newDebt;
        {
            IPool pool = getPool(newSeriesId);
            IFYToken fyToken = IFYToken(newSeries.fyToken);
            IJoin baseJoin = getJoin(series.baseId);

            // Calculate debt in fyToken terms
            uint128 amt = _debtInBase(vault.seriesId, series, balances.art);

            // Mint fyToken to the pool, as a kind of flash loan
            fyToken.mint(address(pool), amt * loan);                // Loan is the size of the flash loan relative to the debt amount, 2 should be safe most of the time

            // Buy the base required to pay off the debt in series 1, and find out the debt in series 2
            newDebt = pool.buyBase(address(baseJoin), amt, max);
            baseJoin.join(address(baseJoin), amt);                  // Repay the old series debt

            pool.retrieveFYToken(address(fyToken));                 // Get the surplus fyToken
            fyToken.burn(address(fyToken), (amt * loan) - newDebt);    // Burn the surplus
        }

        newDebt += ((newSeries.maturity - block.timestamp) * uint256(newDebt).wmul(borrowingFee)).u128();  // Add borrowing fee, also stops users form rolling to a mature series

        return cauldron.roll(vaultId, newSeriesId, newDebt.i128() - balances.art.i128()); // Change the series and debt for the vault
    }

    // ---- Ladle as a token holder ----

    /// @dev Use fyToken in the Ladle to repay debt.
    function _repayLadle(bytes12 vaultId, DataTypes.Vault memory vault)
        private
        returns (DataTypes.Balances memory balances)
    {
        DataTypes.Series memory series = getSeries(vault.seriesId);
        balances = cauldron.balances(vaultId);
        
        uint256 amount = series.fyToken.balanceOf(address(this));
        amount = amount <= balances.art ? amount : balances.art;

        // Update accounting
        balances = cauldron.pour(vaultId, 0, -(amount.u128().i128()));
        series.fyToken.burn(address(this), amount);
    }

    /// @dev Retrieve any asset or fyToken in the Ladle
    function _retrieve(bytes6 id, bool isAsset, address to) 
        private
        returns (uint256 amount)
    {
        IERC20 token = IERC20(findToken(id, isAsset));
        amount = token.balanceOf(address(this));
        token.safeTransfer(to, amount);
    }

    // ---- Liquidations ----

    /// @dev Allow liquidation contracts to move assets to wind down vaults
    function settle(bytes12 vaultId, address user, uint128 ink, uint128 art)
        external
        auth
    {
        DataTypes.Vault memory vault = getOwnedVault(vaultId);
        DataTypes.Series memory series = getSeries(vault.seriesId);

        cauldron.slurp(vaultId, ink, art);                                                  // Remove debt and collateral from the vault

        if (ink != 0) {                                                                     // Give collateral to the user
            IJoin ilkJoin = getJoin(vault.ilkId);
            ilkJoin.exit(user, ink);
        }
        if (art != 0) {                                                                     // Take underlying from user
            IJoin baseJoin = getJoin(series.baseId);
            baseJoin.join(user, art);
        }
    }

    // ---- Permit management ----

    /// @dev From an id, which can be an assetId or a seriesId, find the resulting asset or fyToken
    function findToken(bytes6 id, bool isAsset)
        private view returns (address token)
    {
        token = isAsset ? cauldron.assets(id) : address(getSeries(id).fyToken);
        require (token != address(0), "Token not found");
    }

    /// @dev Execute an ERC2612 permit for the selected asset or fyToken
    function _forwardPermit(bytes6 id, bool isAsset, address spender, uint256 amount, uint256 deadline, uint8 v, bytes32 r, bytes32 s)
        private
    {
        IERC2612 token = IERC2612(findToken(id, isAsset));
        token.permit(msg.sender, spender, amount, deadline, v, r, s);
    }

    /// @dev Execute a Dai-style permit for the selected asset or fyToken
    function _forwardDaiPermit(bytes6 id, bool isAsset, address spender, uint256 nonce, uint256 deadline, bool allowed, uint8 v, bytes32 r, bytes32 s)
        private
    {
        DaiAbstract token = DaiAbstract(findToken(id, isAsset));
        token.permit(msg.sender, spender, nonce, deadline, allowed, v, r, s);
    }

    // ---- Ether management ----

    /// @dev The WETH9 contract will send ether to BorrowProxy on `weth.withdraw` using this function.
    receive() external payable { }

    /// @dev Accept Ether, wrap it and forward it to the WethJoin
    /// This function should be called first in a batch, and the Join should keep track of stored reserves
    /// Passing the id for a join that doesn't link to a contract implemnting IWETH9 will fail
    function _joinEther(bytes6 etherId)
        private
        returns (uint256 ethTransferred)
    {
        ethTransferred = address(this).balance;
        IJoin wethJoin = getJoin(etherId);
        weth.deposit{ value: ethTransferred }();   // TODO: Test gas savings using WETH10 `depositTo`
        IERC20(address(weth)).safeTransfer(address(wethJoin), ethTransferred);
    }

    /// @dev Unwrap Wrapped Ether held by this Ladle, and send the Ether
    /// This function should be called last in a batch, and the Ladle should have no reason to keep an WETH balance
    function _exitEther(address payable to)
        private
        returns (uint256 ethTransferred)
    {
        ethTransferred = weth.balanceOf(address(this));
        weth.withdraw(ethTransferred);   // TODO: Test gas savings using WETH10 `withdrawTo`
        to.safeTransferETH(ethTransferred);
    }

    // ---- Pool router ----

    /// @dev Allow users to trigger a token transfer to a pool through the ladle, to be used with batch
    function _transferToPool(IPool pool, bool base, uint128 wad)
        private
    {
        IERC20 token = base ? pool.base() : pool.fyToken();
        token.safeTransferFrom(msg.sender, address(pool), wad);
    }

    /// @dev Allow users to route calls to a pool, to be used with batch
    function _route(IPool pool, bytes memory data)
        private
        returns (bool success, bytes memory result)
    {
        (success, result) = address(pool).call(data);
        if (!success) revert(RevertMsgExtractor.getRevertMsg(result));
    }

    // ---- FYToken router ----

    /// @dev Allow users to trigger a token transfer to a pool through the ladle, to be used with batch
    function _transferToFYToken(IFYToken fyToken, uint256 wad)
        private
    {
        IERC20(fyToken).safeTransferFrom(msg.sender, address(fyToken), wad);
    }

    /// @dev Allow users to redeem fyToken, to be used with batch.
    /// If 0 is passed as the amount to redeem, it redeems the fyToken balance of the Ladle instead.
    function _redeem(IFYToken fyToken, address to, uint256 wad)
        private
        returns (uint256)
    {
        return fyToken.redeem(to, wad != 0 ? wad : fyToken.balanceOf(address(this)));
    }

    // ---- Module router ----

    /// @dev Allow users to use functionality coded in a module, to be used with batch
    function _moduleCall(address module, bytes memory moduleCall)
        private
        returns (bool success, bytes memory result)
    {
        require (modules[module], "Unregistered module");
        (success, result) = module.delegatecall(moduleCall);
        if (!success) revert(RevertMsgExtractor.getRevertMsg(result));
    }
}