// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

import {IConvenience} from './interfaces/IConvenience.sol';
import {IFactory} from '@timeswap-labs/timeswap-v1-core/contracts/interfaces/IFactory.sol';
import {IWETH} from './interfaces/IWETH.sol';
import {IDue} from './interfaces/IDue.sol';
import {IPair} from '@timeswap-labs/timeswap-v1-core/contracts/interfaces/IPair.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {ITimeswapMintCallback} from '@timeswap-labs/timeswap-v1-core/contracts/interfaces/callback/ITimeswapMintCallback.sol';
import {ITimeswapLendCallback} from '@timeswap-labs/timeswap-v1-core/contracts/interfaces/callback/ITimeswapLendCallback.sol';
import {ITimeswapBorrowCallback} from '@timeswap-labs/timeswap-v1-core/contracts/interfaces/callback/ITimeswapBorrowCallback.sol';
import {Mint} from './libraries/Mint.sol';
import {Burn} from './libraries/Burn.sol';
import {Lend} from './libraries/Lend.sol';
import {Withdraw} from './libraries/Withdraw.sol';
import {Borrow} from './libraries/Borrow.sol';
import {Pay} from './libraries/Pay.sol';
import {SafeTransfer} from './libraries/SafeTransfer.sol';
import {DeployNative} from './libraries/DeployNative.sol';

/// @title Timeswap Convenience
/// @author Timeswap Labs
/// @notice It is recommnded to use this contract to interact with Timeswap Core contract.
/// @notice All error messages are abbreviated and can be found in the documentation.
contract TimeswapConvenience is IConvenience {
    using SafeTransfer for IERC20;
    using Mint for mapping(IERC20 => mapping(IERC20 => mapping(uint256 => Native)));
    using Burn for mapping(IERC20 => mapping(IERC20 => mapping(uint256 => Native)));
    using Lend for mapping(IERC20 => mapping(IERC20 => mapping(uint256 => Native)));
    using Withdraw for mapping(IERC20 => mapping(IERC20 => mapping(uint256 => Native)));
    using Borrow for mapping(IERC20 => mapping(IERC20 => mapping(uint256 => Native)));
    using Pay for mapping(IERC20 => mapping(IERC20 => mapping(uint256 => Native)));
    using DeployNative for mapping(IERC20 => mapping(IERC20 => mapping(uint256 => Native)));

    /* ===== MODEL ===== */

    /// @inheritdoc IConvenience
    IFactory public immutable override factory;
    /// @inheritdoc IConvenience
    IWETH public immutable override weth;

    /// @dev Stores the addresses of the Liquidty, Bond, Insurance, Collateralized Debt token contracts.
    mapping(IERC20 => mapping(IERC20 => mapping(uint256 => Native))) private natives;

    /* ===== VIEW ===== */

    /// @inheritdoc IConvenience
    function getNative(
        IERC20 asset,
        IERC20 collateral,
        uint256 maturity
    ) external view override returns (Native memory) {
        return natives[asset][collateral][maturity];
    }

    /* ===== INIT ===== */

    /// @dev Initializes the Convenience contract.
    /// @param _factory The address of factory contract used by this contract.
    /// @param _weth The address of the Wrapped ETH contract.
    constructor(IFactory _factory, IWETH _weth) {
        factory = _factory;
        weth = _weth;
    }

    /* ===== UPDATE ===== */

    receive() external payable {}

    /// @inheritdoc IConvenience
    function newLiquidity(NewLiquidity calldata params)
        external
        override
        returns (
            uint256 liquidityOut,
            uint256 id,
            IPair.Due memory dueOut
        )
    {
        (liquidityOut, id, dueOut) = natives.newLiquidity(this, factory, params);
    }

    /// @inheritdoc IConvenience
    function newLiquidityETHAsset(NewLiquidityETHAsset calldata params)
        external
        payable
        override
        returns (
            uint256 liquidityOut,
            uint256 id,
            IPair.Due memory dueOut
        )
    {
        (liquidityOut, id, dueOut) = natives.newLiquidityETHAsset(this, factory, weth, params);
    }

    /// @inheritdoc IConvenience
    function newLiquidityETHCollateral(NewLiquidityETHCollateral calldata params)
        external
        payable
        override
        returns (
            uint256 liquidityOut,
            uint256 id,
            IPair.Due memory dueOut
        )
    {
        (liquidityOut, id, dueOut) = natives.newLiquidityETHCollateral(this, factory, weth, params);
    }

    /// @inheritdoc IConvenience
    function liquidityGivenAsset(LiquidityGivenAsset calldata params)
        external
        override
        returns (
            uint256 liquidityOut,
            uint256 id,
            IPair.Due memory dueOut
        )
    {
        (liquidityOut, id, dueOut) = natives.liquidityGivenAsset(this, factory, params);
    }

    /// @inheritdoc IConvenience
    function liquidityGivenAssetETHAsset(LiquidityGivenAssetETHAsset calldata params)
        external
        payable
        override
        returns (
            uint256 liquidityOut,
            uint256 id,
            IPair.Due memory dueOut
        )
    {
        (liquidityOut, id, dueOut) = natives.liquidityGivenAssetETHAsset(this, factory, weth, params);
    }

    /// @inheritdoc IConvenience
    function liquidityGivenAssetETHCollateral(LiquidityGivenAssetETHCollateral calldata params)
        external
        payable
        override
        returns (
            uint256 liquidityOut,
            uint256 id,
            IPair.Due memory dueOut
        )
    {
        (liquidityOut, id, dueOut) = natives.liquidityGivenAssetETHCollateral(this, factory, weth, params);
    }

    /// @inheritdoc IConvenience
    function liquidityGivenDebt(LiquidityGivenDebt calldata params)
        external
        override
        returns (
            uint256 liquidityOut,
            uint112 assetIn,
            uint256 id,
            IPair.Due memory dueOut
        )
    {
        (liquidityOut, assetIn, id, dueOut) = natives.liquidityGivenDebt(this, factory, params);
    }

    /// @inheritdoc IConvenience
    function liquidityGivenDebtETHAsset(LiquidityGivenDebtETHAsset calldata params)
        external
        payable
        override
        returns (
            uint256 liquidityOut,
            uint112 assetIn,
            uint256 id,
            IPair.Due memory dueOut
        )
    {
        (liquidityOut, assetIn, id, dueOut) = natives.liquidityGivenDebtETHAsset(this, factory, weth, params);
    }

    /// @inheritdoc IConvenience
    function liquidityGivenDebtETHCollateral(LiquidityGivenDebtETHCollateral calldata params)
        external
        payable
        override
        returns (
            uint256 liquidityOut,
            uint112 assetIn,
            uint256 id,
            IPair.Due memory dueOut
        )
    {
        (liquidityOut, assetIn, id, dueOut) = natives.liquidityGivenDebtETHCollateral(this, factory, weth, params);
    }

    /// @inheritdoc IConvenience
    function liquidityGivenCollateral(LiquidityGivenCollateral calldata params)
        external
        override
        returns (
            uint256 liquidityOut,
            uint112 assetIn,
            uint256 id,
            IPair.Due memory dueOut
        )
    {
        (liquidityOut, assetIn, id, dueOut) = natives.liquidityGivenCollateral(this, factory, params);
    }

    /// @inheritdoc IConvenience
    function liquidityGivenCollateralETHAsset(LiquidityGivenCollateralETHAsset calldata params)
        external
        payable
        override
        returns (
            uint256 liquidityOut,
            uint112 assetIn,
            uint256 id,
            IPair.Due memory dueOut
        )
    {
        (liquidityOut, assetIn, id, dueOut) = natives.liquidityGivenCollateralETHAsset(this, factory, weth, params);
    }

    /// @inheritdoc IConvenience
    function liquidityGivenCollateralETHCollateral(LiquidityGivenCollateralETHCollateral calldata params)
        external
        payable
        override
        returns (
            uint256 liquidityOut,
            uint112 assetIn,
            uint256 id,
            IPair.Due memory dueOut
        )
    {
        (liquidityOut, assetIn, id, dueOut) = natives.liquidityGivenCollateralETHCollateral(
            this,
            factory,
            weth,
            params
        );
    }

    /// @inheritdoc IConvenience
    function removeLiquidity(RemoveLiquidity calldata params)
        external
        override
        returns (IPair.Tokens memory tokensOut)
    {
        tokensOut = natives.removeLiquidity(factory, params);
    }

    /// @inheritdoc IConvenience
    function removeLiquidityETHAsset(RemoveLiquidityETHAsset calldata params)
        external
        override
        returns (IPair.Tokens memory tokensOut)
    {
        tokensOut = natives.removeLiquidityETHAsset(factory, weth, params);
    }

    /// @inheritdoc IConvenience
    function removeLiquidityETHCollateral(RemoveLiquidityETHCollateral calldata params)
        external
        override
        returns (IPair.Tokens memory tokensOut)
    {
        tokensOut = natives.removeLiquidityETHCollateral(factory, weth, params);
    }

    /// @inheritdoc IConvenience
    function lendGivenBond(LendGivenBond calldata params) external override returns (IPair.Claims memory claimsOut) {
        claimsOut = natives.lendGivenBond(this, factory, params);
    }

    /// @inheritdoc IConvenience
    function lendGivenBondETHAsset(LendGivenBondETHAsset calldata params)
        external
        payable
        override
        returns (IPair.Claims memory claimsOut)
    {
        claimsOut = natives.lendGivenBondETHAsset(this, factory, weth, params);
    }

    /// @inheritdoc IConvenience
    function lendGivenBondETHCollateral(LendGivenBondETHCollateral calldata params)
        external
        payable
        override
        returns (IPair.Claims memory claimsOut)
    {
        claimsOut = natives.lendGivenBondETHCollateral(this, factory, weth, params);
    }

    /// @inheritdoc IConvenience
    function lendGivenInsurance(LendGivenInsurance calldata params)
        external
        override
        returns (IPair.Claims memory claimsOut)
    {
        claimsOut = natives.lendGivenInsurance(this, factory, params);
    }

    /// @inheritdoc IConvenience
    function lendGivenInsuranceETHAsset(LendGivenInsuranceETHAsset calldata params)
        external
        payable
        override
        returns (IPair.Claims memory claimsOut)
    {
        claimsOut = natives.lendGivenInsuranceETHAsset(this, factory, weth, params);
    }

    /// @inheritdoc IConvenience
    function lendGivenInsuranceETHCollateral(LendGivenInsuranceETHCollateral calldata params)
        external
        override
        returns (IPair.Claims memory claimsOut)
    {
        claimsOut = natives.lendGivenInsuranceETHCollateral(this, factory, weth, params);
    }

    /// @inheritdoc IConvenience
    function lendGivenPercent(LendGivenPercent calldata params)
        external
        override
        returns (IPair.Claims memory claimsOut)
    {
        claimsOut = natives.lendGivenPercent(this, factory, params);
    }

    /// @inheritdoc IConvenience
    function lendGivenPercentETHAsset(LendGivenPercentETHAsset calldata params)
        external
        payable
        override
        returns (IPair.Claims memory claimsOut)
    {
        claimsOut = natives.lendGivenPercentETHAsset(this, factory, weth, params);
    }

    /// @inheritdoc IConvenience
    function lendGivenPercentETHCollateral(LendGivenPercentETHCollateral calldata params)
        external
        override
        returns (IPair.Claims memory claimsOut)
    {
        claimsOut = natives.lendGivenPercentETHCollateral(this, factory, weth, params);
    }

    /// @inheritdoc IConvenience
    function collect(Collect calldata params) external override returns (IPair.Tokens memory tokensOut) {
        tokensOut = natives.collect(factory, params);
    }

    /// @inheritdoc IConvenience
    function collectETHAsset(CollectETHAsset calldata params)
        external
        override
        returns (IPair.Tokens memory tokensOut)
    {
        tokensOut = natives.collectETHAsset(factory, weth, params);
    }

    /// @inheritdoc IConvenience
    function collectETHCollateral(CollectETHCollateral calldata params)
        external
        override
        returns (IPair.Tokens memory tokensOut)
    {
        tokensOut = natives.collectETHCollateral(factory, weth, params);
    }

    /// @inheritdoc IConvenience
    function borrowGivenDebt(BorrowGivenDebt calldata params)
        external
        override
        returns (uint256 id, IPair.Due memory dueOut)
    {
        (id, dueOut) = natives.borrowGivenDebt(this, factory, params);
    }

    /// @inheritdoc IConvenience
    function borrowGivenDebtETHAsset(BorrowGivenDebtETHAsset calldata params)
        external
        override
        returns (uint256 id, IPair.Due memory dueOut)
    {
        (id, dueOut) = natives.borrowGivenDebtETHAsset(this, factory, weth, params);
    }

    /// @inheritdoc IConvenience
    function borrowGivenDebtETHCollateral(BorrowGivenDebtETHCollateral calldata params)
        external
        payable
        override
        returns (uint256 id, IPair.Due memory dueOut)
    {
        (id, dueOut) = natives.borrowGivenDebtETHCollateral(this, factory, weth, params);
    }

    /// @inheritdoc IConvenience
    function borrowGivenCollateral(BorrowGivenCollateral calldata params)
        external
        override
        returns (uint256 id, IPair.Due memory dueOut)
    {
        (id, dueOut) = natives.borrowGivenCollateral(this, factory, params);
    }

    /// @inheritdoc IConvenience
    function borrowGivenCollateralETHAsset(BorrowGivenCollateralETHAsset calldata params)
        external
        override
        returns (uint256 id, IPair.Due memory dueOut)
    {
        (id, dueOut) = natives.borrowGivenCollateralETHAsset(this, factory, weth, params);
    }

    /// @inheritdoc IConvenience
    function borrowGivenCollateralETHCollateral(BorrowGivenCollateralETHCollateral calldata params)
        external
        payable
        override
        returns (uint256 id, IPair.Due memory dueOut)
    {
        (id, dueOut) = natives.borrowGivenCollateralETHCollateral(this, factory, weth, params);
    }

    /// @inheritdoc IConvenience
    function borrowGivenPercent(BorrowGivenPercent calldata params)
        external
        override
        returns (uint256 id, IPair.Due memory dueOut)
    {
        (id, dueOut) = natives.borrowGivenPercent(this, factory, params);
    }

    /// @inheritdoc IConvenience
    function borrowGivenPercentETHAsset(BorrowGivenPercentETHAsset calldata params)
        external
        override
        returns (uint256 id, IPair.Due memory dueOut)
    {
        (id, dueOut) = natives.borrowGivenPercentETHAsset(this, factory, weth, params);
    }

    /// @inheritdoc IConvenience
    function borrowGivenPercentETHCollateral(BorrowGivenPercentETHCollateral calldata params)
        external
        payable
        override
        returns (uint256 id, IPair.Due memory dueOut)
    {
        (id, dueOut) = natives.borrowGivenPercentETHCollateral(this, factory, weth, params);
    }

    /// @inheritdoc IConvenience
    function repay(Repay memory params) external override returns (uint128 assetIn, uint128 collateralOut) {
        (assetIn, collateralOut) = natives.pay(factory, params);
    }

    /// @inheritdoc IConvenience
    function repayETHAsset(RepayETHAsset memory params)
        external
        payable
        override
        returns (uint128 assetIn, uint128 collateralOut)
    {
        (assetIn, collateralOut) = natives.payETHAsset(factory, weth, params);
    }

    /// @inheritdoc IConvenience
    function repayETHCollateral(RepayETHCollateral memory params)
        external
        override
        returns (uint128 assetIn, uint128 collateralOut)
    {
        (assetIn, collateralOut) = natives.payETHCollateral(factory, weth, params);
    }

    /// @inheritdoc IConvenience
    function deployNative(Deploy memory params) external override {
        natives.deploy(this, factory, params);
    }

    /// @inheritdoc ITimeswapMintCallback
    function timeswapMintCallback(
        uint112 assetIn,
        uint112 collateralIn,
        bytes calldata data
    ) external override {
        (IERC20 asset, IERC20 collateral, address assetFrom, address collateralFrom) = abi.decode(
            data,
            (IERC20, IERC20, address, address)
        );
        IPair pair = factory.getPair(asset, collateral);

        require(msg.sender == address(pair), 'E701');

        if (assetFrom == address(this)) {
            weth.deposit{value: assetIn}();
            asset.safeTransfer(pair, assetIn);
        } else {
            asset.safeTransferFrom(assetFrom, pair, assetIn);
        }

        if (collateralFrom == address(this)) {
            weth.deposit{value: collateralIn}();
            collateral.safeTransfer(pair, collateralIn);
        } else {
            collateral.safeTransferFrom(collateralFrom, pair, collateralIn);
        }
    }

    /// @inheritdoc ITimeswapLendCallback
    function timeswapLendCallback(uint112 assetIn, bytes calldata data) external override {
        (IERC20 asset, IERC20 collateral, address from) = abi.decode(data, (IERC20, IERC20, address));
        IPair pair = factory.getPair(asset, collateral);

        require(msg.sender == address(pair), 'E701');

        if (from == address(this)) {
            weth.deposit{value: assetIn}();
            asset.safeTransfer(pair, assetIn);
        } else {
            asset.safeTransferFrom(from, pair, assetIn);
        }
    }

    /// @inheritdoc ITimeswapBorrowCallback
    function timeswapBorrowCallback(uint112 collateralIn, bytes calldata data) external override {
        (IERC20 asset, IERC20 collateral, address from) = abi.decode(data, (IERC20, IERC20, address));
        IPair pair = factory.getPair(asset, collateral);
        require(msg.sender == address(pair), 'E701');
        if (from == address(this)) {
            weth.deposit{value: collateralIn}();
            collateral.safeTransfer(pair, collateralIn);
        } else {
            collateral.safeTransferFrom(from, pair, collateralIn);
        }
    }

    /// @inheritdoc IConvenience
    function collateralizedDebtCallback(
        IPair pair,
        uint256 maturity,
        uint128 assetIn,
        bytes calldata data
    ) external override {
        (IERC20 asset, IERC20 collateral, address from) = abi.decode(data, (IERC20, IERC20, address));

        IDue collateralizedDebt = natives[asset][collateral][maturity].collateralizedDebt;

        require(msg.sender == address(collateralizedDebt), 'E701');

        if (from == address(this)) {
            weth.deposit{value: assetIn}();
            asset.safeTransfer(pair, assetIn);
        } else {
            asset.safeTransferFrom(from, pair, assetIn);
        }
    }
}
