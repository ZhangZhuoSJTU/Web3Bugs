// SPDX-License-Identifier: GPL-3.0-only
pragma solidity =0.7.6;
pragma abicoder v2;

import "../math/SafeInt256.sol";
import "../global/LibStorage.sol";
import "../global/Types.sol";
import "../global/Constants.sol";
import "interfaces/compound/CErc20Interface.sol";
import "interfaces/compound/CEtherInterface.sol";
import "@openzeppelin-0.7/contracts/math/SafeMath.sol";
import "@openzeppelin-0.7/contracts/token/ERC20/ERC20.sol";

/// @notice Handles all external token transfers and events
library TokenHandler {
    using SafeInt256 for int256;
    using SafeMath for uint256;

    function getAssetToken(uint256 currencyId) internal view returns (Token memory) {
        return _getToken(currencyId, false);
    }

    function getUnderlyingToken(uint256 currencyId) internal view returns (Token memory) {
        return _getToken(currencyId, true);
    }

    /// @notice Gets token data for a particular currency id, if underlying is set to true then returns
    /// the underlying token. (These may not always exist)
    function _getToken(uint256 currencyId, bool underlying) private view returns (Token memory) {
        mapping(uint256 => mapping(bool => TokenStorage)) storage store = LibStorage.getTokenStorage();
        TokenStorage storage tokenStorage = store[currencyId][underlying];

        return
            Token({
                tokenAddress: tokenStorage.tokenAddress,
                hasTransferFee: tokenStorage.hasTransferFee,
                // No overflow, restricted on storage
                decimals: int256(10**tokenStorage.decimalPlaces),
                tokenType: tokenStorage.tokenType,
                maxCollateralBalance: tokenStorage.maxCollateralBalance
            });
    }

    function redeem(
        Token memory assetToken,
        Token memory underlyingToken,
        uint256 assetAmountExternal
    ) internal returns (int256) {
        uint256 startingBalance;
        if (assetToken.tokenType == TokenType.cETH) {
            startingBalance = address(this).balance;
        } else if (assetToken.tokenType == TokenType.cToken) {
            startingBalance = IERC20(underlyingToken.tokenAddress).balanceOf(address(this));
        } else {
            revert(); // dev: non redeemable failure
        }

        uint256 success = CErc20Interface(assetToken.tokenAddress).redeem(assetAmountExternal);
        require(success == Constants.COMPOUND_RETURN_CODE_NO_ERROR, "Redeem");

        uint256 endingBalance;
        if (assetToken.tokenType == TokenType.cETH) {
            endingBalance = address(this).balance;
        } else {
            endingBalance = IERC20(underlyingToken.tokenAddress).balanceOf(address(this));
        }

        // Underlying token external precision
        return SafeInt256.toInt(endingBalance.sub(startingBalance));
    }

    function convertToInternal(Token memory token, int256 amount) internal pure returns (int256) {
        // If token decimals > INTERNAL_TOKEN_PRECISION:
        //  on deposit: resulting dust will accumulate to protocol
        //  on withdraw: protocol may lose dust amount. However, withdraws are only calculated based
        //    on a conversion from internal token precision to external token precision so therefore dust
        //    amounts cannot be specified for withdraws.
        // If token decimals < INTERNAL_TOKEN_PRECISION then this will add zeros to the
        // end of amount and will not result in dust.
        if (token.decimals == Constants.INTERNAL_TOKEN_PRECISION) return amount;
        return amount.mul(Constants.INTERNAL_TOKEN_PRECISION).div(token.decimals);
    }

    function convertToExternal(Token memory token, int256 amount) internal pure returns (int256) {
        if (token.decimals == Constants.INTERNAL_TOKEN_PRECISION) return amount;
        // If token decimals > INTERNAL_TOKEN_PRECISION then this will increase amount
        // by adding a number of zeros to the end and will not result in dust.
        // If token decimals < INTERNAL_TOKEN_PRECISION:
        //  on deposit: Deposits are specified in external token precision and there is no loss of precision when
        //      tokens are converted from external to internal precision
        //  on withdraw: this calculation will round down such that the protocol retains the residual cash balance
        return amount.mul(token.decimals).div(Constants.INTERNAL_TOKEN_PRECISION);
    }

}
