// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./ATokenMock.sol";
import "./WadRayMath.sol";
import "../../protocols/aave/ILendingPool.sol";

contract AavePoolMock is ILendingPool {
    using WadRayMath for uint;

    // AAVE supports multi-reserve lending, but in this Mock we only support 1 reserve
    IERC20 private assetToken; // DAI
    ATokenMock public yieldToken; // aDAI
    uint128 private liquidityIndex; // the liquidity index in Ray (init:1ray=1e27)

    // used for mocks, it will force-fail the next deposit or redeem
    bool public mockFailNextDepositOrRedeem;

    /// @dev Initialize AAVE Mock with a single supported reserve.
    /// We only support 1 reserve right now.
    /// @param asset The single ERC20 reserve token, such as DAI
    constructor(
        IERC20 asset,
        uint128 index,
        uint8 decimals,
        string memory aTokenName,
        string memory aTokenSymbol
    ) {
        assetToken = asset;
        yieldToken = new ATokenMock(ILendingPool(address(this)), address(asset), decimals, aTokenName, aTokenSymbol);
        liquidityIndex = index; // default should be 1ray
    }

    /// @notice MOCK ONLY
    /// @dev Sets the current liquidity index for deposit() and getReserveNormalizedIncome()
    /// @param index Asset liquidity index. Expressed in ray (1e27)
    function setLiquidityIndex(uint128 index) public {
        liquidityIndex = index;
    }

    /// @notice MOCK ONLY
    function setFailNextDepositOrRedeem(bool fail) public {
        mockFailNextDepositOrRedeem = fail;
    }

    /// @dev Returns the normalized income per unit of asset
    /// @param asset The address of the underlying asset of the reserve
    /// @return The reserve's normalized income
    function getReserveNormalizedIncome(address asset) public view override returns (uint) {
        require(address(assetToken) == asset, "invalid reserve asset");
        return liquidityIndex;
    }

    /// @dev Deposits an `amount` of underlying asset into the reserve, receiving in return overlying aTokens.
    /// - E.g. User deposits 100 USDC and gets in return 100 aUSDC
    /// @param asset The address of the underlying asset to deposit
    /// @param amount The amount to be deposited
    /// @param onBehalfOf The address that will receive the aTokens, same as msg.sender if the user
    ///   wants to receive them on his own wallet, or a different address if the beneficiary of aTokens
    ///   is a different wallet
    function deposit(
        address asset,
        uint amount,
        address onBehalfOf,
        uint16 /*referralCode*/
    ) public override {
        require(address(assetToken) == asset, "invalid reserve asset");

        if (mockFailNextDepositOrRedeem) {
            setFailNextDepositOrRedeem(false);
            revert("random mock failure from aave");
        }

        // The AToken holds the asset
        address assetOwner = address(yieldToken);
        require(assetToken.transferFrom(msg.sender, assetOwner, amount), "transfer failed");

        // liquidity index controls how many additional tokens are minted
        uint amountScaled = (amount).rayDiv(liquidityIndex);
        yieldToken.mint(onBehalfOf, amountScaled);
    }

    /// @dev Withdraws an `amount` of underlying asset from the reserve, burning the equivalent aTokens owned
    /// E.g. User has 100 aUSDC, calls withdraw() and receives 100 USDC, burning the 100 aUSDC
    /// @param asset The address of the underlying asset to withdraw
    /// @param amount The underlying amount to be withdrawn
    ///   - Send the value type(uint256).max in order to withdraw the whole aToken balance
    /// @param to Address that will receive the underlying, same as msg.sender if the user
    ///   wants to receive it on his own wallet, or a different address if the beneficiary is a
    ///   different wallet
    /// @return The final amount withdrawn
    function withdraw(
        address asset,
        uint256 amount,
        address to
    ) external override returns (uint256) {
        require(address(assetToken) == asset, "invalid reserve asset");

        if (mockFailNextDepositOrRedeem) {
            setFailNextDepositOrRedeem(false);
            revert("random failure from aave");
        }

        yieldToken.burn(msg.sender, to, amount, uint256(liquidityIndex));
        return amount;
    }

    /// @notice MOCK ONLY
    /// @return Total deposited underlying assets of an user
    function getDeposit(address user) public view returns (uint) {
        return yieldToken.balanceOf(user);
    }
}
