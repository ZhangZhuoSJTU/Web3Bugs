// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../IPreparable.sol";
import "../../interfaces/IVault.sol";

interface ILiquidityPool is IPreparable {
    event Deposit(address indexed minter, uint256 depositAmount, uint256 mintedLpTokens);

    event DepositFor(
        address indexed minter,
        address indexed mintee,
        uint256 depositAmount,
        uint256 mintedLpTokens
    );

    event Redeem(address indexed redeemer, uint256 redeemAmount, uint256 redeemTokens);

    event LpTokenSet(address indexed lpToken);

    event StakerVaultSet(address indexed stakerVault);

    function redeem(uint256 redeemTokens) external returns (uint256);

    function redeem(uint256 redeemTokens, uint256 minRedeemAmount) external returns (uint256);

    function calcRedeem(address account, uint256 underlyingAmount) external returns (uint256);

    function deposit(uint256 mintAmount) external payable returns (uint256);

    function deposit(uint256 mintAmount, uint256 minTokenAmount) external payable returns (uint256);

    function depositAndStake(uint256 depositAmount, uint256 minTokenAmount)
        external
        payable
        returns (uint256);

    function depositFor(address account, uint256 depositAmount) external payable returns (uint256);

    function depositFor(
        address account,
        uint256 depositAmount,
        uint256 minTokenAmount
    ) external payable returns (uint256);

    function unstakeAndRedeem(uint256 redeemLpTokens, uint256 minRedeemAmount)
        external
        returns (uint256);

    function handleLpTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) external;

    function prepareNewVault(address _vault) external returns (bool);

    function executeNewVault() external returns (address);

    function executeNewMaxWithdrawalFee() external returns (uint256);

    function executeNewRequiredReserves() external returns (uint256);

    function executeNewReserveDeviation() external returns (uint256);

    function setLpToken(address _lpToken) external returns (bool);

    function setStaker() external returns (bool);

    function withdrawAll() external;

    function prepareNewRequiredReserves(uint256 _newRatio) external returns (bool);

    function resetRequiredReserves() external returns (bool);

    function prepareNewReserveDeviation(uint256 newRatio) external returns (bool);

    function resetNewReserveDeviation() external returns (bool);

    function prepareNewMinWithdrawalFee(uint256 newFee) external returns (bool);

    function executeNewMinWithdrawalFee() external returns (uint256);

    function resetNewMinWithdrawalFee() external returns (bool);

    function prepareNewMaxWithdrawalFee(uint256 newFee) external returns (bool);

    function resetNewMaxWithdrawalFee() external returns (bool);

    function prepareNewWithdrawalFeeDecreasePeriod(uint256 newPeriod) external returns (bool);

    function executeNewWithdrawalFeeDecreasePeriod() external returns (uint256);

    function resetNewWithdrawalFeeDecreasePeriod() external returns (bool);

    function resetNewVault() external returns (bool);

    function rebalanceVault() external;

    function getRequiredReserveRatio() external view returns (uint256);

    function getMaxReserveDeviationRatio() external view returns (uint256);

    function getMinWithdrawalFee() external view returns (uint256);

    function getMaxWithdrawalFee() external view returns (uint256);

    function getWithdrawalFeeDecreasePeriod() external view returns (uint256);

    function getNewCurrentFees(
        uint256 timeToWait,
        uint256 lastActionTimestamp,
        uint256 feeRatio
    ) external view returns (uint256);

    function getUnderlying() external view returns (address);

    function getLpToken() external view returns (address);

    function getWithdrawalFee(address account, uint256 amount) external view returns (uint256);

    function getVault() external view returns (IVault);

    function exchangeRate() external view returns (uint256);

    function totalUnderlying() external view returns (uint256);
}
