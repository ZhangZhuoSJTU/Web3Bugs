// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

import {IFactory} from '@timeswap-labs/timeswap-v1-core/contracts/interfaces/IFactory.sol';
import {IPair} from '@timeswap-labs/timeswap-v1-core/contracts/interfaces/IPair.sol';
import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {IMint} from './IMint.sol';
import {IBurn} from './IBurn.sol';
import {ILend} from './ILend.sol';
import {IWithdraw} from './IWithdraw.sol';
import {IBorrow} from './IBorrow.sol';
import {IPay} from './IPay.sol';
import {ILiquidity} from './ILiquidity.sol';
import {IClaim} from './IClaim.sol';
import {IDue} from './IDue.sol';
import {IWETH} from './IWETH.sol';
import {ITimeswapMintCallback} from '@timeswap-labs/timeswap-v1-core/contracts/interfaces/callback/ITimeswapMintCallback.sol';
import {ITimeswapLendCallback} from '@timeswap-labs/timeswap-v1-core/contracts/interfaces/callback/ITimeswapLendCallback.sol';
import {ITimeswapBorrowCallback} from '@timeswap-labs/timeswap-v1-core/contracts/interfaces/callback/ITimeswapBorrowCallback.sol';
import {IDeployNative} from './IDeployNative.sol';

/// @title Timeswap Convenience Interface
/// @author Ricsson W. Ngo
interface IConvenience is
    IMint,
    ILend,
    IWithdraw,
    IBorrow,
    IPay,
    IBurn,
    ITimeswapMintCallback,
    ITimeswapLendCallback,
    ITimeswapBorrowCallback,
    IDeployNative
{
    struct Native {
        ILiquidity liquidity;
        IClaim bond;
        IClaim insurance;
        IDue collateralizedDebt;
    }

    /* ===== VIEW ===== */

    /// @dev Return the address of the factory contract used by this contract.
    /// @return The address of the factory contract.
    function factory() external returns (IFactory);

    /// @dev Return the address of the Wrapped ETH contract.
    /// @return The address of WETH.
    function weth() external returns (IWETH);

    /// @dev Return the addresses of the Liquidty, Bond, Insurance, Collateralized Debt token contracts.
    /// @return The addresses of the native token contracts.
    function getNative(
        IERC20 asset,
        IERC20 collateral,
        uint256 maturity
    ) external view returns (Native memory);

    /// @dev Calls the mint function and creates a new pool.
    /// @dev If the pair does not exist, creates a new pair first.
    /// @dev Must have the asset ERC20 approve this contract before calling this function.
    /// @dev Must have the collateral ERC20 approve this contract before calling this function.
    /// @param params The parameters for this function found in IMint interface.
    /// @return liquidityOut The amount of liquidity balance received by liquidityTo.
    /// @return id The array index of the collateralized debt received by dueTo.
    /// @return dueOut The collateralized debt received by dueTo.
    function newLiquidity(NewLiquidity calldata params)
        external
        returns (
            uint256 liquidityOut,
            uint256 id,
            IPair.Due memory dueOut
        );

    /// @dev Calls the mint function and creates a new pool.
    /// @dev If the pair does not exist, creates a new pair first.
    /// @dev The asset deposited is ETH which will be wrapped as WETH.
    /// @dev Msg.value is the assetIn amount.
    /// @dev Must have the collateral ERC20 approve this contract before calling this function.
    /// @param params The parameters for this function found in IMint interface.
    /// @return liquidityOut The amount of liquidity balance received by liquidityTo.
    /// @return id The array index of the collateralized debt received by dueTo.
    /// @return dueOut The collateralized debt received by dueTo.
    function newLiquidityETHAsset(NewLiquidityETHAsset calldata params)
        external
        payable
        returns (
            uint256 liquidityOut,
            uint256 id,
            IPair.Due memory dueOut
        );

    /// @dev Calls the mint function and creates a new pool.
    /// @dev If the pair does not exist, creates a new pair first.
    /// @dev The collateral locked is ETH which will be wrapped as WETH.
    /// @dev Msg.value is the collateralIn amount.
    /// @dev Must have the asset ERC20 approve this contract before calling this function.
    /// @param params The parameters for this function found in IMint interface.
    /// @return liquidityOut The amount of liquidity balance received by liquidityTo.
    /// @return id The array index of the collateralized debt received by dueTo.
    /// @return dueOut The collateralized debt received by dueTo.
    function newLiquidityETHCollateral(NewLiquidityETHCollateral calldata params)
        external
        payable
        returns (
            uint256 liquidityOut,
            uint256 id,
            IPair.Due memory dueOut
        );

    /// @dev Calls the mint function and add more liquidity to an existing pool.
    /// @dev Must have the asset ERC20 approve this contract before calling this function.
    /// @dev Must have the collateral ERC20 approve this contract before calling this function.
    /// @param params The parameters for this function found in IMint interface.
    /// @return liquidityOut The amount of liquidity balance received by liquidityTo.
    /// @return id The array index of the collateralized debt received by dueTo.
    /// @return dueOut The collateralized debt received by dueTo.
    function liquidityGivenAsset(LiquidityGivenAsset calldata params)
        external
        returns (
            uint256 liquidityOut,
            uint256 id,
            IPair.Due memory dueOut
        );

    /// @dev Calls the mint function and add more liquidity to an existing pool.
    /// @dev The asset deposited is ETH which will be wrapped as WETH.
    /// @dev Msg.value is the assetIn amount.
    /// @dev Must have the collateral ERC20 approve this contract before calling this function.
    /// @param params The parameters for this function found in IMint interface.
    /// @return liquidityOut The amount of liquidity balance received by liquidityTo.
    /// @return id The array index of the collateralized debt received by dueTo.
    /// @return dueOut The collateralized debt received by dueTo.
    function liquidityGivenAssetETHAsset(LiquidityGivenAssetETHAsset calldata params)
        external
        payable
        returns (
            uint256 liquidityOut,
            uint256 id,
            IPair.Due memory dueOut
        );

    /// @dev Calls the mint function and add more liquidity to an existing pool.
    /// @dev The collateral ERC20 is the WETH contract.
    /// @dev The collateral locked is ETH which will be wrapped as WETH.
    /// @dev Msg.value is the maxCollateral amount. Any excess ETH will be returned to Msg.sender.
    /// @dev Must have the asset ERC20 approve this contract before calling this function.
    /// @param params The parameters for this function found in IMint interface.
    /// @return liquidityOut The amount of liquidity balance received by liquidityTo.
    /// @return id The array index of the collateralized debt received by dueTo.
    /// @return dueOut The collateralized debt received by dueTo.
    function liquidityGivenAssetETHCollateral(LiquidityGivenAssetETHCollateral calldata params)
        external
        payable
        returns (
            uint256 liquidityOut,
            uint256 id,
            IPair.Due memory dueOut
        );

    /// @dev Calls the mint function and add more liquidity to an existing pool.
    /// @dev Must have the asset ERC20 approve this contract before calling this function.
    /// @dev Must have the collateral ERC20 approve this contract before calling this function.
    /// @param params The parameters for this function found in IMint interface.
    /// @return liquidityOut The amount of liquidity balance received by liquidityTo.
    /// @return assetIn The amount of asset ERC20 lent by caller.
    /// @return id The array index of the collateralized debt received by dueTo.
    /// @return dueOut The collateralized debt received by dueTo.
    function liquidityGivenDebt(LiquidityGivenDebt calldata params)
        external
        returns (
            uint256 liquidityOut,
            uint112 assetIn,
            uint256 id,
            IPair.Due memory dueOut
        );

    /// @dev Calls the mint function and add more liquidity to an existing pool.
    /// @dev The asset deposited is ETH which will be wrapped as WETH.
    /// @dev Msg.value is the assetIn amount.
    /// @dev Must have the collateral ERC20 approve this contract before calling this function.
    /// @param params The parameters for this function found in IMint interface.
    /// @return liquidityOut The amount of liquidity balance received by liquidityTo.
    /// @return assetIn The amount of asset ERC20 lent by caller.
    /// @return id The array index of the collateralized debt received by dueTo.
    /// @return dueOut The collateralized debt received by dueTo.
    function liquidityGivenDebtETHAsset(LiquidityGivenDebtETHAsset calldata params)
        external
        payable
        returns (
            uint256 liquidityOut,
            uint112 assetIn,
            uint256 id,
            IPair.Due memory dueOut
        );

    /// @dev Calls the mint function and add more liquidity to an existing pool.
    /// @dev The collateral ERC20 is the WETH contract.
    /// @dev The collateral locked is ETH which will be wrapped as WETH.
    /// @dev Msg.value is the maxCollateral amount. Any excess ETH will be returned to Msg.sender.
    /// @dev Must have the asset ERC20 approve this contract before calling this function.
    /// @param params The parameters for this function found in IMint interface.
    /// @return liquidityOut The amount of liquidity balance received by liquidityTo.
    /// @return assetIn The amount of asset ERC20 lent by caller.
    /// @return id The array index of the collateralized debt received by dueTo.
    /// @return dueOut The collateralized debt received by dueTo.
    function liquidityGivenDebtETHCollateral(LiquidityGivenDebtETHCollateral calldata params)
        external
        payable
        returns (
            uint256 liquidityOut,
            uint112 assetIn,
            uint256 id,
            IPair.Due memory dueOut
        );

    /// @dev Calls the mint function and add more liquidity to an existing pool.
    /// @dev Must have the asset ERC20 approve this contract before calling this function.
    /// @dev Must have the collateral ERC20 approve this contract before calling this function.
    /// @param params The parameters for this function found in IMint interface.
    /// @return liquidityOut The amount of liquidity balance received by liquidityTo.
    /// @return assetIn The amount of asset ERC20 lent by caller.
    /// @return id The array index of the collateralized debt received by dueTo.
    /// @return dueOut The collateralized debt received by dueTo.
    function liquidityGivenCollateral(LiquidityGivenCollateral calldata params)
        external
        returns (
            uint256 liquidityOut,
            uint112 assetIn,
            uint256 id,
            IPair.Due memory dueOut
        );

    /// @dev Calls the mint function and add more liquidity to an existing pool.
    /// @dev The asset deposited is ETH which will be wrapped as WETH.
    /// @dev Msg.value is the assetIn amount.
    /// @dev Must have the collateral ERC20 approve this contract before calling this function.
    /// @param params The parameters for this function found in IMint interface.
    /// @return liquidityOut The amount of liquidity balance received by liquidityTo.
    /// @return assetIn The amount of asset ERC20 lent by caller.
    /// @return id The array index of the collateralized debt received by dueTo.
    /// @return dueOut The collateralized debt received by dueTo.
    function liquidityGivenCollateralETHAsset(LiquidityGivenCollateralETHAsset calldata params)
        external
        payable
        returns (
            uint256 liquidityOut,
            uint112 assetIn,
            uint256 id,
            IPair.Due memory dueOut
        );

    /// @dev Calls the mint function and add more liquidity to an existing pool.
    /// @dev The collateral ERC20 is the WETH contract.
    /// @dev The collateral locked is ETH which will be wrapped as WETH.
    /// @dev Msg.value is the maxCollateral amount. Any excess ETH will be returned to Msg.sender.
    /// @dev Must have the asset ERC20 approve this contract before calling this function.
    /// @param params The parameters for this function found in IMint interface.
    /// @return liquidityOut The amount of liquidity balance received by liquidityTo.
    /// @return assetIn The amount of asset ERC20 lent by caller.
    /// @return id The array index of the collateralized debt received by dueTo.
    /// @return dueOut The collateralized debt received by dueTo.
    function liquidityGivenCollateralETHCollateral(LiquidityGivenCollateralETHCollateral calldata params)
        external
        payable
        returns (
            uint256 liquidityOut,
            uint112 assetIn,
            uint256 id,
            IPair.Due memory dueOut
        );

    /// @dev Calls the burn funtion and withdraw liquiidty from a pool.
    /// @param params The parameters for this function found in IBurn interface.
    /// @return tokensOut The amount of asset ERC20 and collateral ERC20 received by assetTo and collateralTo.
    function removeLiquidity(RemoveLiquidity calldata params) external returns (IPair.Tokens memory tokensOut);

    /// @dev Calls the burn funtion and withdraw liquiidty from a pool.
    /// @dev The asset received is ETH which will be unwrapped from WETH.
    /// @param params The parameters for this function found in IBurn interface.
    /// @return tokensOut The amount of asset ERC20 and collateral ERC20 received by assetTo and collateralTo.
    function removeLiquidityETHAsset(RemoveLiquidityETHAsset calldata params)
        external
        returns (IPair.Tokens memory tokensOut);

    /// @dev Calls the burn funtion and withdraw liquiidty from a pool.
    /// @dev The collateral received is ETH which will be unwrapped from WETH.
    /// @param params The parameters for this function found in IBurn interface.
    /// @return tokensOut The amount of asset ERC20 and collateral ERC20 received by assetTo and collateralTo.
    function removeLiquidityETHCollateral(RemoveLiquidityETHCollateral calldata params)
        external
        returns (IPair.Tokens memory tokensOut);

    /// @dev Calls the lend function and deposit asset into a pool.
    /// @dev Calls given the bond received by bondTo.
    /// @dev Must have the asset ERC20 approve this contract before calling this function.
    /// @param params The parameters for this function found in ILend interface.
    /// @return claimsOut The amount of bond ERC20 and insurance ERC20 received by bondTo and insuranceTo.
    function lendGivenBond(LendGivenBond calldata params) external returns (IPair.Claims memory claimsOut);

    /// @dev Calls the lend function and deposit asset into a pool.
    /// @dev Calls given the bond received by bondTo.
    /// @dev The asset deposited is ETH which will be wrapped as WETH.
    /// @param params The parameters for this function found in ILend interface.
    /// @return claimsOut The amount of bond ERC20 and insurance ERC20 received by bondTo and insuranceTo.
    function lendGivenBondETHAsset(LendGivenBondETHAsset calldata params)
        external
        payable
        returns (IPair.Claims memory claimsOut);

    /// @dev Calls the lend function and deposit asset into a pool.
    /// @dev Calls given the bond received by bondTo.
    /// @dev Must have the asset ERC20 approve this contract before calling this function.
    /// @param params The parameters for this function found in ILend interface.
    /// @return claimsOut The amount of bond ERC20 and insurance ERC20 received by bondTo and insuranceTo.
    function lendGivenBondETHCollateral(LendGivenBondETHCollateral calldata params)
        external
        payable
        returns (IPair.Claims memory claimsOut);

    /// @dev Calls the lend function and deposit asset into a pool.
    /// @dev Calls given the insurance received by insuranceTo.
    /// @dev Must have the asset ERC20 approve this contract before calling this function.
    /// @param params The parameters for this function found in ILend interface.
    /// @return claimsOut The amount of bond ERC20 and insurance ERC20 received by bondTo and insuranceTo.
    function lendGivenInsurance(LendGivenInsurance calldata params) external returns (IPair.Claims memory claimsOut);

    /// @dev Calls the lend function and deposit asset into a pool.
    /// @dev Calls given the insurance received by insuranceTo.
    /// @dev The asset deposited is ETH which will be wrapped as WETH.
    /// @param params The parameters for this function found in ILend interface.
    /// @return claimsOut The amount of bond ERC20 and insurance ERC20 received by bondTo and insuranceTo.
    function lendGivenInsuranceETHAsset(LendGivenInsuranceETHAsset calldata params)
        external
        payable
        returns (IPair.Claims memory claimsOut);

    /// @dev Calls the lend function and deposit asset into a pool.
    /// @dev Calls given the insurance received by insuranceTo.
    /// @dev Must have the asset ERC20 approve this contract before calling this function.
    /// @param params The parameters for this function found in ILend interface.
    /// @return claimsOut The amount of bond ERC20 and insurance ERC20 received by bondTo and insuranceTo.
    function lendGivenInsuranceETHCollateral(LendGivenInsuranceETHCollateral calldata params)
        external
        returns (IPair.Claims memory claimsOut);

    /// @dev Calls the lend function and deposit asset into a pool.
    /// @dev Calls given percentage ratio of bond and insurance.
    /// @dev Must have the asset ERC20 approve this contract before calling this function.
    /// @param params The parameters for this function found in ILend interface.
    /// @return claimsOut The amount of bond ERC20 and insurance ERC20 received by bondTo and insuranceTo.
    function lendGivenPercent(LendGivenPercent calldata params) external returns (IPair.Claims memory claimsOut);

    /// @dev Calls the lend function and deposit asset into a pool.
    /// @dev Calls given percentage ratio of bond and insurance.
    /// @dev The asset deposited is ETH which will be wrapped as WETH.
    /// @param params The parameters for this function found in ILend interface.
    /// @return claimsOut The amount of bond ERC20 and insurance ERC20 received by bondTo and insuranceTo.
    function lendGivenPercentETHAsset(LendGivenPercentETHAsset calldata params)
        external
        payable
        returns (IPair.Claims memory claimsOut);

    /// @dev Calls the lend function and deposit asset into a pool.
    /// @dev Calls given percentage ratio of bond and insurance.
    /// @dev Must have the asset ERC20 approve this contract before calling this function.
    /// @param params The parameters for this function found in ILend interface.
    /// @return claimsOut The amount of bond ERC20 and insurance ERC20 received by bondTo and insuranceTo.
    function lendGivenPercentETHCollateral(LendGivenPercentETHCollateral calldata params)
        external
        returns (IPair.Claims memory claimsOut);

    /// @dev Calls the withdraw function and withdraw asset and collateral from a pool.
    /// @param params The parameters for this function found in IWithdraw interface.
    /// @return tokensOut The amount of asset ERC20 and collateral ERC20 received by assetTo and collateralTo.
    function collect(Collect calldata params) external returns (IPair.Tokens memory tokensOut);

    /// @dev Calls the withdraw function and withdraw asset and collateral from a pool.
    /// @dev The asset received is ETH which will be unwrapped from WETH.
    /// @param params The parameters for this function found in IWithdraw interface.
    /// @return tokensOut The amount of asset ERC20 and collateral ERC20 received by assetTo and collateralTo.
    function collectETHAsset(CollectETHAsset calldata params) external returns (IPair.Tokens memory tokensOut);

    /// @dev Calls the withdraw function and withdraw asset and collateral from a pool.
    /// @dev The collateral received is ETH which will be unwrapped from WETH.
    /// @param params The parameters for this function found in IWithdraw interface.
    /// @return tokensOut The amount of asset ERC20 and collateral ERC20 received by assetTo and collateralTo.
    function collectETHCollateral(CollectETHCollateral calldata params)
        external
        returns (IPair.Tokens memory tokensOut);

    /// @dev Calls the borrow function and borrow asset from a pool and locking collateral into the pool.
    /// @dev Calls given the debt received by dueTo.
    /// @dev Must have the collateral ERC20 approve this contract before calling this function.
    /// @param params The parameters for this function found in IBorrow interface.
    /// @return id The token id of collateralized debt ERC721 received by dueTo.
    /// @return dueOut The collateralized debt ERC721 received by dueTo.
    function borrowGivenDebt(BorrowGivenDebt calldata params) external returns (uint256 id, IPair.Due memory dueOut);

    /// @dev Calls the borrow function and borrow asset from a pool and locking collateral into the pool.
    /// @dev Calls given the debt received by dueTo.
    /// @dev Must have the collateral ERC20 approve this contract before calling this function.
    /// @param params The parameters for this function found in IBorrow interface.
    /// @return id The token id of collateralized debt ERC721 received by dueTo.
    /// @return dueOut The collateralized debt ERC721 received by dueTo.
    function borrowGivenDebtETHAsset(BorrowGivenDebtETHAsset calldata params)
        external
        returns (uint256 id, IPair.Due memory dueOut);

    /// @dev Calls the borrow function and borrow asset from a pool and locking collateral into the pool.
    /// @dev Calls given the debt received by dueTo.
    /// @dev The collateral locked is ETH which will be wrapped as WETH.
    /// @param params The parameters for this function found in IBorrow interface.
    /// @return id The token id of collateralized debt ERC721 received by dueTo.
    /// @return dueOut The collateralized debt ERC721 received by dueTo.
    function borrowGivenDebtETHCollateral(BorrowGivenDebtETHCollateral calldata params)
        external
        payable
        returns (uint256 id, IPair.Due memory dueOut);

    /// @dev Calls the borrow function and borrow asset from a pool and locking collateral into the pool.
    /// @dev Calls given the collateral locked.
    /// @dev Must have the collateral ERC20 approve this contract before calling this function.
    /// @param params The parameters for this function found in IBorrow interface.
    /// @return id The token id of collateralized debt ERC721 received by dueTo.
    /// @return dueOut The collateralized debt ERC721 received by dueTo.
    function borrowGivenCollateral(BorrowGivenCollateral calldata params)
        external
        returns (uint256 id, IPair.Due memory dueOut);

    /// @dev Calls the borrow function and borrow asset from a pool and locking collateral into the pool.
    /// @dev Calls given the collateral locked.
    /// @dev Must have the collateral ERC20 approve this contract before calling this function.
    /// @param params The parameters for this function found in IBorrow interface.
    /// @return id The token id of collateralized debt ERC721 received by dueTo.
    /// @return dueOut The collateralized debt ERC721 received by dueTo.
    function borrowGivenCollateralETHAsset(BorrowGivenCollateralETHAsset calldata params)
        external
        returns (uint256 id, IPair.Due memory dueOut);

    /// @dev Calls the borrow function and borrow asset from a pool and locking collateral into the pool.
    /// @dev Calls given the collateral locked.
    /// @dev The collateral locked is ETH which will be wrapped as WETH.
    /// @param params The parameters for this function found in IBorrow interface.
    /// @return id The token id of collateralized debt ERC721 received by dueTo.
    /// @return dueOut The collateralized debt ERC721 received by dueTo.
    function borrowGivenCollateralETHCollateral(BorrowGivenCollateralETHCollateral calldata params)
        external
        payable
        returns (uint256 id, IPair.Due memory dueOut);

    /// @dev Calls the borrow function and borrow asset from a pool and locking collateral into the pool.
    /// @dev Calls given percentage ratio of debt and collateral.
    /// @dev Must have the collateral ERC20 approve this contract before calling this function.
    /// @param params The parameters for this function found in IBorrow interface.
    /// @return id The token id of collateralized debt ERC721 received by dueTo.
    /// @return dueOut The collateralized debt ERC721 received by dueTo.
    function borrowGivenPercent(BorrowGivenPercent calldata params)
        external
        returns (uint256 id, IPair.Due memory dueOut);

    /// @dev Calls the borrow function and borrow asset from a pool and locking collateral into the pool.
    /// @dev Calls given percentage ratio of debt and collateral.
    /// @dev Must have the collateral ERC20 approve this contract before calling this function.
    /// @param params The parameters for this function found in IBorrow interface.
    /// @return id The token id of collateralized debt ERC721 received by dueTo.
    /// @return dueOut The collateralized debt ERC721 received by dueTo.
    function borrowGivenPercentETHAsset(BorrowGivenPercentETHAsset calldata params)
        external
        returns (uint256 id, IPair.Due memory dueOut);

    /// @dev Calls the borrow function and borrow asset from a pool and locking collateral into the pool.
    /// @dev Calls given percentage ratio of debt and collateral.
    /// @dev The collateral locked is ETH which will be wrapped as WETH.
    /// @param params The parameters for this function found in IBorrow interface.
    /// @return id The token id of collateralized debt ERC721 received by dueTo.
    /// @return dueOut The collateralized debt ERC721 received by dueTo.
    function borrowGivenPercentETHCollateral(BorrowGivenPercentETHCollateral calldata params)
        external
        payable
        returns (uint256 id, IPair.Due memory dueOut);

    /// @dev Calls the pay function and withdraw collateral from a pool given debt is paid or being paid.
    /// @dev If there is debt being paid, must have the asset ERC20 approve this contract before calling this function.
    /// @dev Possible to pay debt of collateralized debt not owned by msg.sender, which means no collateral is withdraw.
    /// @param params The parameters for this function found in IPay interface.
    /// @return assetIn The total amount of asset ERC20 paid.
    /// @return collateralOut The total amount of collateral ERC20 receceived by to;
    function repay(Repay memory params) external returns (uint128 assetIn, uint128 collateralOut);

    /// @dev Calls the pay function and withdraw collateral from a pool given debt is paid or being paid.
    //// @dev The asset being paid is ETH which will be wrapped as WETH.
    /// @dev Possible to pay debt of collateralized debt not owned by msg.sender, which means no collateral is withdraw.
    /// @param params The parameters for this function found in IPay interface.
    /// @return assetIn The total amount of asset ERC20 paid.
    /// @return collateralOut The total amount of collateral ERC20 receceived by to;
    function repayETHAsset(RepayETHAsset memory params)
        external
        payable
        returns (uint128 assetIn, uint128 collateralOut);

    /// @dev Calls the pay function and withdraw collateral from a pool given debt is paid or being paid.
    /// @dev The collateral received is ETH which will be unwrapped from WETH.
    /// @dev If there is debt being paid, must have the asset ERC20 approve this contract before calling this function.
    /// @dev Possible to pay debt of collateralized debt not owned by msg.sender, which means no collateral is withdraw.
    /// @param params The parameters for this function found in IPay interface.
    /// @return assetIn The total amount of asset ERC20 paid.
    /// @return collateralOut The total amount of collateral ERC20 receceived by to;
    function repayETHCollateral(RepayETHCollateral memory params)
        external
        returns (uint128 assetIn, uint128 collateralOut);

    /// @dev Create native token contracts.
    /// @param params The parameters for this function found in IDeployNative interface.
    function deployNative(Deploy memory params) external;

    /// @dev In the implementation you must pay the asset token owed for the pay transaction.
    /// The caller of this method must be checked to be a Collateralized Debt ERC721 deployed by the canonical TimeswapConvenience.
    /// @param pair The address of the pair contract from collateralized debt token.
    /// @param maturity The maturity of the pair contract from collateralized debt token.
    /// @param assetIn The amount of asset tokens owed due to the pool for the pay transaction
    /// @param data Any data passed through by the caller via the ITimeswapPair#pay call
    function collateralizedDebtCallback(
        IPair pair,
        uint256 maturity,
        uint128 assetIn,
        bytes calldata data
    ) external;
}
