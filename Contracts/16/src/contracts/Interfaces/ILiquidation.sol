//SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;
import "./Types.sol";
import "../lib/LibPerpetuals.sol";
import "../lib/LibLiquidation.sol";

interface ILiquidation {
    function calcAmountToReturn(
        uint256 escrowId,
        Perpetuals.Order[] memory orders,
        address traderContract
    ) external returns (uint256);

    function calcUnitsSold(
        Perpetuals.Order[] memory orders,
        address traderContract,
        uint256 receiptId
    ) external returns (uint256, uint256);

    function getLiquidationReceipt(uint256 id) external view returns (LibLiquidation.LiquidationReceipt memory);

    function liquidate(int256 amount, address account) external;

    function claimReceipt(
        uint256 receiptId,
        Perpetuals.Order[] memory orders,
        address traderContract
    ) external;

    function claimEscrow(uint256 receiptId) external;

    function currentLiquidationId() external view returns (uint256);

    function maxSlippage() external view returns (uint256);

    function releaseTime() external view returns (uint256);

    function minimumLeftoverGasCostMultiplier() external view returns (uint256);

    function transferOwnership(address newOwner) external;

    function setMaxSlippage(uint256 _maxSlippage) external;
}
