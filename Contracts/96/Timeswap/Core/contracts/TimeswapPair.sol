// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

import {IPair} from './interfaces/IPair.sol';
import {IFactory} from './interfaces/IFactory.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {TimeswapMath} from './libraries/TimeswapMath.sol';
import {SafeERC20} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {Array} from './libraries/Array.sol';
import {Callback} from './libraries/Callback.sol';
import {BlockNumber} from './libraries/BlockNumber.sol';

/// @title Timeswap Pair
/// @author Timeswap Labs
/// @notice It is recommended to use Timeswap Convenience to interact with this contract.
/// @notice All error messages are coded and can be found in the documentation.
contract TimeswapPair is IPair {
    using SafeERC20 for IERC20;
    using Array for Due[];

    /* ===== MODEL ===== */

    /// @inheritdoc IPair
    IFactory public immutable override factory;
    /// @inheritdoc IPair
    IERC20 public immutable override asset;
    /// @inheritdoc IPair
    IERC20 public immutable override collateral;
    /// @inheritdoc IPair
    uint16 public immutable override fee;
    /// @inheritdoc IPair
    uint16 public immutable override protocolFee;

    /// @inheritdoc IPair
    uint256 public override protocolFeeStored;

    /// @dev Stores the individual states of each Pool.
    mapping(uint256 => Pool) private pools;

    /// @dev Stores the access state for reentrancy guard.
    uint256 private locked = 1;

    /* ===== VIEW =====*/

    /// @inheritdoc IPair
    function feeStored(uint256 maturity)
        external
        view
        override
        returns (uint256) 
    {
        return pools[maturity].state.feeStored;
    }

    /// @inheritdoc IPair
    function constantProduct(uint256 maturity)
        external
        view
        override
        returns (uint112, uint112, uint112)
    {
        State storage state = pools[maturity].state;
        return (state.x, state.y, state.z);
    }

    /// @inheritdoc IPair
    function totalReserves(uint256 maturity) external view override returns (Tokens memory) {
        return pools[maturity].state.reserves;
    }

    /// @inheritdoc IPair
    function totalLiquidity(uint256 maturity) external view override returns (uint256) {
        return pools[maturity].state.totalLiquidity;
    }

    /// @inheritdoc IPair
    function liquidityOf(uint256 maturity, address owner) external view override returns (uint256) {
        return pools[maturity].liquidities[owner];
    }

    /// @inheritdoc IPair
    function totalClaims(uint256 maturity) external view override returns (Claims memory) {
        return pools[maturity].state.totalClaims;
    }

    /// @inheritdoc IPair
    function claimsOf(uint256 maturity, address owner) external view override returns (Claims memory) {
        return pools[maturity].claims[owner];
    }

    /// @inheritdoc IPair
    function totalDebtCreated(uint256 maturity) external view override returns (uint120) {
        return pools[maturity].state.totalDebtCreated;
    }

    /// @inheritdoc IPair
    function totalDuesOf(uint256 maturity, address owner) external view override returns (uint256) {
        return pools[maturity].dues[owner].length;
    }

    /// @inheritdoc IPair
    function dueOf(uint256 maturity, address owner, uint256 id) external view override returns (Due memory) {
        return pools[maturity].dues[owner][id];
    }

    /* ===== INIT ===== */

    /// @dev Initializes the Pair contract.
    /// @dev Called by the Timeswap factory contract.
    /// @param _asset The address of the ERC20 being lent and borrowed.
    /// @param _collateral The address of the ERC20 as the collateral.
    /// @param _fee The chosen fee rate.
    /// @param _protocolFee The chosen protocol fee rate.
    constructor(
        IERC20 _asset,
        IERC20 _collateral,
        uint16 _fee,
        uint16 _protocolFee
    ) {
        factory = IFactory(msg.sender);
        asset = _asset;
        collateral = _collateral;
        fee = _fee;
        protocolFee = _protocolFee;
    }

    /* ===== MODIFIER ===== */

    /// @dev The modifier for reentrancy guard.
    modifier lock() {
        require(locked == 1, 'E211');
        locked = 2;
        _;
        locked = 1;
    }

    /* ===== UPDATE ===== */

    /// @inheritdoc IPair
    function mint(MintParam calldata param)
        external
        override
        lock
        returns (
            uint256 assetIn,
            uint256 liquidityOut,
            uint256 id,
            Due memory dueOut
        )
    {   
        require(block.timestamp < param.maturity, 'E202');
        unchecked { require(param.maturity - block.timestamp < 0x100000000, 'E208'); }
        require(param.liquidityTo != address(0), 'E201');
        require(param.dueTo != address(0), 'E201');
        require(param.liquidityTo != address(this), 'E204');
        require(param.dueTo != address(this), 'E204');
        require(param.xIncrease != 0, 'E205');
        require(param.yIncrease != 0, 'E205');
        require(param.zIncrease != 0, 'E205');
        
        Pool storage pool = pools[param.maturity];

        uint256 feeStoredIncrease;
        (liquidityOut, dueOut, feeStoredIncrease) = TimeswapMath.mint(
            param.maturity,
            pool.state,
            param.xIncrease,
            param.yIncrease,
            param.zIncrease
        );

        require(liquidityOut != 0, 'E212');
        pool.state.totalLiquidity += liquidityOut;
        pool.liquidities[param.liquidityTo] += liquidityOut;

        pool.state.feeStored += feeStoredIncrease;


        id = pool.dues[param.dueTo].insert(dueOut);

        pool.state.reserves.asset += param.xIncrease;
        pool.state.reserves.collateral += dueOut.collateral;
        pool.state.totalDebtCreated += dueOut.debt;

        pool.state.x += param.xIncrease;
        pool.state.y += param.yIncrease;
        pool.state.z += param.zIncrease;

        assetIn = param.xIncrease;
        assetIn += feeStoredIncrease;
        Callback.mint(asset, collateral, assetIn, dueOut.collateral, param.data);

        emit Sync(param.maturity, pool.state.x, pool.state.y, pool.state.z);
        emit Mint(
            param.maturity, 
            msg.sender, 
            param.liquidityTo, 
            param.dueTo, 
            assetIn, 
            liquidityOut, 
            id, 
            dueOut,
            feeStoredIncrease
        );
    }

    /// @inheritdoc IPair
    function burn(BurnParam calldata param) 
        external 
        override 
        lock 
        returns (
            uint256 assetOut, 
            uint128 collateralOut
        ) 
    {
        require(block.timestamp >= param.maturity, 'E203');
        require(param.assetTo != address(0), 'E201');
        require(param.collateralTo != address(0), 'E201');
        require(param.assetTo != address(this), 'E204');
        require(param.collateralTo != address(this), 'E204');
        require(param.liquidityIn != 0, 'E205');

        Pool storage pool = pools[param.maturity];
        require(pool.state.totalLiquidity > 0, 'E206');

        uint128 _assetOut;
        uint256 feeOut;
        (_assetOut, collateralOut, feeOut) = TimeswapMath.burn(
            pool.state,
            param.liquidityIn
        );

        pool.state.totalLiquidity -= param.liquidityIn;

        pool.liquidities[msg.sender] -= param.liquidityIn;

        assetOut = _assetOut;
        assetOut += feeOut;

        if (assetOut != 0) {
            pool.state.reserves.asset -= _assetOut;
            pool.state.feeStored -= feeOut;
            asset.safeTransfer(param.assetTo, assetOut);
        }
        if (collateralOut != 0) {
            pool.state.reserves.collateral -= collateralOut;
            collateral.safeTransfer(param.collateralTo, collateralOut);
        }

        emit Burn(
            param.maturity,
            msg.sender, 
            param.assetTo, 
            param.collateralTo, 
            param.liquidityIn, 
            assetOut, 
            collateralOut,
            feeOut
        );
    }

    /// @inheritdoc IPair
    function lend(LendParam calldata param) 
        external 
        override 
        lock 
        returns (
            uint256 assetIn,
            Claims memory claimsOut
        ) 
    {
        require(block.timestamp < param.maturity, 'E202');
        require(param.bondTo != address(0), 'E201');
        require(param.insuranceTo != address(0), 'E201');
        require(param.bondTo != address(this), 'E204');
        require(param.insuranceTo != address(this), 'E204');
        require(param.xIncrease != 0, 'E205');

        Pool storage pool = pools[param.maturity];
        require(pool.state.totalLiquidity != 0, 'E206');

        uint256 feeStoredIncrease;
        uint256 protocolFeeStoredIncrease;
        (claimsOut, feeStoredIncrease, protocolFeeStoredIncrease) = TimeswapMath.lend(
            param.maturity,
            pool.state,
            param.xIncrease,
            param.yDecrease,
            param.zDecrease,
            fee,
            protocolFee
        );

        pool.state.feeStored += feeStoredIncrease;
        protocolFeeStored += protocolFeeStoredIncrease;

        pool.state.totalClaims.bondPrincipal += claimsOut.bondPrincipal;
        pool.state.totalClaims.bondInterest += claimsOut.bondInterest;
        pool.state.totalClaims.insurancePrincipal += claimsOut.insurancePrincipal;
        pool.state.totalClaims.insuranceInterest += claimsOut.insuranceInterest;

        pool.claims[param.bondTo].bondPrincipal += claimsOut.bondPrincipal;
        pool.claims[param.bondTo].bondInterest += claimsOut.bondInterest;
        pool.claims[param.insuranceTo].insurancePrincipal += claimsOut.insurancePrincipal;
        pool.claims[param.insuranceTo].insuranceInterest += claimsOut.insuranceInterest;

        pool.state.reserves.asset += param.xIncrease;

        pool.state.x += param.xIncrease;
        pool.state.y -= param.yDecrease;
        pool.state.z -= param.zDecrease;

        assetIn = param.xIncrease;
        assetIn += feeStoredIncrease;
        assetIn += protocolFeeStoredIncrease;

        Callback.lend(asset, assetIn, param.data);

        emit Sync(param.maturity, pool.state.x, pool.state.y, pool.state.z);
        emit Lend(
            param.maturity,
            msg.sender, 
            param.bondTo, 
            param.insuranceTo, 
            assetIn, 
            claimsOut,
            feeStoredIncrease,
            protocolFeeStoredIncrease
        );
    }

    /// @inheritdoc IPair
    function withdraw(WithdrawParam calldata param)
        external 
        override 
        lock 
        returns (
            Tokens memory tokensOut
        ) 
    {
        require(block.timestamp >= param.maturity, 'E203');
        require(param.assetTo != address(0), 'E201');
        require(param.collateralTo != address(0), 'E201');
        require(param.assetTo != address(this), 'E204');
        require(param.collateralTo != address(this), 'E204');
        require(
            param.claimsIn.bondPrincipal != 0 || 
            param.claimsIn.bondInterest != 0 ||
            param.claimsIn.insurancePrincipal != 0 ||
            param.claimsIn.insuranceInterest != 0, 
            'E205'
        );

        Pool storage pool = pools[param.maturity];

        tokensOut = TimeswapMath.withdraw(pool.state, param.claimsIn);

        pool.state.totalClaims.bondPrincipal -= param.claimsIn.bondPrincipal;
        pool.state.totalClaims.bondInterest -= param.claimsIn.bondInterest;
        pool.state.totalClaims.insurancePrincipal -= param.claimsIn.insurancePrincipal;
        pool.state.totalClaims.insuranceInterest -= param.claimsIn.insuranceInterest;

        Claims storage sender = pool.claims[msg.sender];

        sender.bondPrincipal -= param.claimsIn.bondPrincipal;
        sender.bondInterest -= param.claimsIn.bondInterest;
        sender.insurancePrincipal -= param.claimsIn.insurancePrincipal;
        sender.insuranceInterest -= param.claimsIn.insuranceInterest;

        if (tokensOut.asset != 0) {
            pool.state.reserves.asset -= tokensOut.asset;
            asset.safeTransfer(param.assetTo, tokensOut.asset);
        }
        if (tokensOut.collateral != 0) {
            pool.state.reserves.collateral -= tokensOut.collateral;
            collateral.safeTransfer(param.collateralTo, tokensOut.collateral);
        }

        emit Withdraw(
            param.maturity,
            msg.sender, 
            param.assetTo, 
            param.collateralTo, 
            param.claimsIn, 
            tokensOut
        );
    }

    /// @inheritdoc IPair
    function borrow(BorrowParam calldata param)
        external 
        override 
        lock 
        returns (
            uint256 assetOut,
            uint256 id, 
            Due memory dueOut
        ) 
    {
        require(block.timestamp < param.maturity, 'E202');
        require(param.assetTo != address(0), 'E201');
        require(param.dueTo != address(0), 'E201');
        require(param.assetTo != address(this), 'E204');
        require(param.dueTo != address(this), 'E204');
        require(param.xDecrease != 0, 'E205');

        Pool storage pool = pools[param.maturity];
        require(pool.state.totalLiquidity != 0, 'E206');

        uint256 feeStoredIncrease;
        uint256 protocolFeeStoredIncrease;
        (dueOut, feeStoredIncrease, protocolFeeStoredIncrease) = TimeswapMath.borrow(
            param.maturity,
            pool.state,
            param.xDecrease,
            param.yIncrease,
            param.zIncrease,
            fee,
            protocolFee
        );

        pool.state.feeStored += feeStoredIncrease;
        protocolFeeStored += protocolFeeStoredIncrease;

        id = pool.dues[param.dueTo].insert(dueOut);

        pool.state.reserves.asset -= param.xDecrease;
        pool.state.reserves.collateral += dueOut.collateral;
        pool.state.totalDebtCreated += dueOut.debt;

        pool.state.x -= param.xDecrease;
        pool.state.y += param.yIncrease;
        pool.state.z += param.zIncrease;

        assetOut = param.xDecrease;
        assetOut -= feeStoredIncrease;
        assetOut -= protocolFeeStoredIncrease;

        asset.safeTransfer(param.assetTo, assetOut);

        Callback.borrow(collateral, dueOut.collateral, param.data);

        emit Sync(param.maturity, pool.state.x, pool.state.y, pool.state.z);
        emit Borrow(
            param.maturity, 
            msg.sender, 
            param.assetTo, 
            param.dueTo, 
            assetOut, 
            id, 
            dueOut,
            feeStoredIncrease,
            protocolFeeStoredIncrease
        );
    }

    /// @inheritdoc IPair
    function pay(PayParam calldata param)
        external 
        override 
        lock 
        returns (
            uint128 assetIn, 
            uint128 collateralOut
        ) 
    {
        require(block.timestamp < param.maturity, 'E202');
        require(param.owner != address(0), 'E201');
        require(param.to != address(0), 'E201');
        require(param.to != address(this), 'E204');
        require(param.ids.length == param.assetsIn.length, 'E205');
        require(param.ids.length == param.collateralsOut.length, 'E205');

        Pool storage pool = pools[param.maturity];

        Due[] storage dues = pool.dues[param.owner];
        require(dues.length >= param.ids.length, 'E205');

        for (uint256 i; i < param.ids.length;) {
            Due storage due = dues[param.ids[i]];
            require(due.startBlock != BlockNumber.get(), 'E207');
            if (param.owner != msg.sender) require(param.collateralsOut[i] == 0, 'E213');
            require(uint256(assetIn) * due.collateral >= uint256(collateralOut) * due.debt, 'E303');
            due.debt -= param.assetsIn[i];
            due.collateral -= param.collateralsOut[i];
            assetIn += param.assetsIn[i];
            collateralOut += param.collateralsOut[i];
            unchecked { ++i; }
        }

        pool.state.reserves.asset += assetIn;
        pool.state.reserves.collateral -= collateralOut;

        if (collateralOut != 0) collateral.safeTransfer(param.to, collateralOut);

        if (assetIn != 0) Callback.pay(asset, assetIn, param.data);

        emit Pay(
            param.maturity, 
            msg.sender, 
            param.to, 
            param.owner, 
            param.ids, 
            param.assetsIn, 
            param.collateralsOut, 
            assetIn, 
            collateralOut
        );
    }

    /// @inheritdoc IPair
    function collectProtocolFee(address to) external override lock returns (uint256 protocolFeeOut) {
        require(msg.sender == factory.owner(), 'E216');

        protocolFeeOut = protocolFeeStored;
        protocolFeeStored = 0;

        asset.safeTransfer(to, protocolFeeOut);

        emit CollectProtocolFee(msg.sender, to, protocolFeeOut);
    }
}
