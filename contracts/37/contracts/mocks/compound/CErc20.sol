// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./CTokenMock.sol";
import "./CTokenInterfaces.sol";

/// Yield Bearing Token for Compound - CErc20 / CToken
contract CErc20 is CTokenMock, CErc20Interface {
    using SafeERC20 for IERC20;

    constructor(
        ComptrollerMock comptrollerInterface,
        address underlyingAsset,
        string memory name,
        string memory symbol
    ) CTokenMock(comptrollerInterface, name, symbol) {
        underlying = underlyingAsset;
    }

    /// @notice Sender supplies assets into the market and receives cTokens in exchange
    /// @dev Accrues interest whether or not the operation succeeds, unless reverted
    /// @param mintAmount The amount of the underlying asset to supply
    /// @return uint 0=success, otherwise a failure (see ErrorReporter.sol for details)
    function mint(uint mintAmount) external override returns (uint) {
        ComptrollerMock mock = ComptrollerMock(address(comptroller));
        if (mock.mockFailNextDepositOrRedeem()) {
            mock.setFailNextDepositOrRedeem(false);
            return 1;
        }
        (uint err, ) = mintInternal(mintAmount);
        return err;
    }

    /// @notice Sender redeems cTokens in exchange for the underlying asset
    /// @dev Accrues interest whether or not the operation succeeds, unless reverted
    /// @param redeemTokens The number of cTokens to redeem into underlying
    /// @return uint 0=success, otherwise a failure (see ErrorReporter.sol for details)
    function redeem(uint redeemTokens) external override returns (uint) {
        ComptrollerMock mock = ComptrollerMock(address(comptroller));
        if (mock.mockFailNextDepositOrRedeem()) {
            mock.setFailNextDepositOrRedeem(false);
            return 1;
        }

        // Amount of underlying asset to be redeemed:
        //  redeemAmount = redeemTokens x exchangeRate
        uint256 exchangeRate = exchangeRateStored();
        uint256 redeemAmount = (redeemTokens * exchangeRate) / 1e18;

        // burn the yield tokens
        _burn(msg.sender, redeemTokens);

        // transfer backing tokens to redeemer
        IERC20(underlying).safeTransfer(msg.sender, redeemAmount);
        return 0; // success
    }

    function doTransferIn(address from, uint amount) internal override returns (uint) {
        IERC20 backingToken = IERC20(underlying);
        backingToken.safeTransferFrom(from, address(this), amount);
        return amount;
    }
}
