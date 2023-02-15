// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.10;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../../../../libraries/AccountEncoding.sol";

import "../../../../interfaces/actions/topup/ITopUpHandler.sol";
import "../../../../interfaces/ICTokenRegistry.sol";
import "../../../../interfaces/vendor/CToken.sol";
import "../../../../interfaces/vendor/ExponentialNoError.sol";
import "../../../../interfaces/vendor/Comptroller.sol";
import "../../../../libraries/Errors.sol";
import "../../../../libraries/ScaledMath.sol";
import "../../../../libraries/UncheckedMath.sol";

contract CompoundHandler is ITopUpHandler, ExponentialNoError {
    using ScaledMath for uint256;
    using UncheckedMath for uint256;
    using SafeERC20 for IERC20;
    using AccountEncoding for bytes32;

    struct AccountLiquidityLocalVars {
        uint256 sumCollateral;
        uint256 sumBorrow;
        uint256 cTokenBalance;
        uint256 borrowBalance;
        uint256 exchangeRateMantissa;
        uint256 oraclePriceMantissa;
        Exp collateralFactor;
        Exp exchangeRate;
        Exp oraclePrice;
        Exp tokensToDenom;
    }

    Comptroller public immutable comptroller;
    ICTokenRegistry public immutable cTokenRegistry;

    constructor(address comptrollerAddress, address _cTokenRegistry) {
        comptroller = Comptroller(comptrollerAddress);
        cTokenRegistry = ICTokenRegistry(_cTokenRegistry);
    }

    /**
     * @notice Executes the top-up of a position.
     * @param account Account holding the position.
     * @param underlying Underlying for top-up.
     * @param amount Amount to top-up by.
     * @return `true` if successful.
     */
    function topUp(
        bytes32 account,
        address underlying,
        uint256 amount,
        bytes calldata extra
    ) external payable override returns (bool) {
        bool repayDebt = abi.decode(extra, (bool));
        address ctoken = cTokenRegistry.fetchCToken(underlying);
        uint256 initialTokens = IERC20(ctoken).balanceOf(address(this));

        address addr = account.addr();

        if (repayDebt) {
            amount -= _repayAnyDebt(addr, underlying, amount, ctoken);
            if (amount == 0) return true;
        }

        uint256 err;
        if (underlying == address(0)) {
            CEthToken(ctoken).mint{value: amount}();
        } else {
            IERC20(underlying).safeTransferFrom(msg.sender, address(this), amount);
            _approve(underlying, address(ctoken));
            err = CToken(ctoken).mint(amount);
        }
        require(err == 0, Error.FAILED_MINT);

        uint256 newTokens = IERC20(ctoken).balanceOf(address(this));
        uint256 mintedTokens = newTokens - initialTokens;

        bool success = IERC20(ctoken).transfer(addr, mintedTokens);
        require(success, Error.FAILED_TRANSFER);
        return true;
    }

    /**
     * @notice Returns the collateralization ratio of the user.
     *         A result of 1.5 (x1e18) means that the user has a 150% collateralization ratio.
     * @param account account for which to check the factor.
     * @return User factor.
     */
    function getUserFactor(bytes32 account, bytes memory) external view override returns (uint256) {
        (uint256 sumCollateral, uint256 sumBorrow) = _getAccountBorrowsAndSupply(account.addr());
        if (sumBorrow == 0) {
            return type(uint256).max;
        }
        return sumCollateral.scaledDiv(sumBorrow);
    }

    /**
     * @notice Repays any existing debt for the given underlying.
     * @param account Account for which to repay the debt.
     * @param underlying The underlying token to repay the debt for.
     * @param maximum The maximum amount of debt to repay.
     * @return The amount of debt that was repaid in the underlying.
     */
    function _repayAnyDebt(
        address account,
        address underlying,
        uint256 maximum,
        address ctoken
    ) internal returns (uint256) {
        uint256 debt = CToken(ctoken).borrowBalanceCurrent(account);
        if (debt == 0) return 0;
        if (debt > maximum) debt = maximum;

        uint256 err;
        if (underlying == address(0)) {
            CEthToken(ctoken).repayBorrowBehalf{value: debt}(account);
        } else {
            IERC20(underlying).safeTransferFrom(msg.sender, address(this), debt);
            _approve(underlying, address(ctoken));
            err = CToken(ctoken).repayBorrowBehalf(account, debt);
        }
        require(err == 0, Error.FAILED_REPAY_BORROW);

        return debt;
    }

    /**
     * @dev Approves infinite spending for the given spender.
     * @param token The token to approve for.
     * @param spender The spender to approve.
     */
    function _approve(address token, address spender) internal {
        if (IERC20(token).allowance(address(this), spender) > 0) return;
        IERC20(token).safeApprove(spender, type(uint256).max);
    }

    function _getAccountBorrowsAndSupply(address account) internal view returns (uint256, uint256) {
        AccountLiquidityLocalVars memory vars; // Holds all our calculation results
        uint256 oErr;

        Comptroller comptroller_ = comptroller;
        PriceOracle oracle = comptroller_.oracle();
        // For each asset the account is in
        CToken[] memory assets = comptroller_.getAssetsIn(account);
        uint256 length_ = assets.length;
        for (uint256 i; i < length_; i = i.uncheckedInc()) {
            CToken asset = assets[i];

            // Read the balances and exchange rate from the cToken
            (oErr, vars.cTokenBalance, vars.borrowBalance, vars.exchangeRateMantissa) = asset
                .getAccountSnapshot(account);
            require(oErr == 0, Error.FAILED_METHOD_CALL);
            (, uint256 collateralFactorMantissa, ) = comptroller_.markets(address(asset));
            vars.collateralFactor = Exp({mantissa: collateralFactorMantissa});
            vars.exchangeRate = Exp({mantissa: vars.exchangeRateMantissa});

            // Get the normalized price of the asset
            vars.oraclePriceMantissa = oracle.getUnderlyingPrice(asset);
            require(vars.oraclePriceMantissa != 0, Error.FAILED_METHOD_CALL);
            vars.oraclePrice = Exp({mantissa: vars.oraclePriceMantissa});

            // Pre-compute a conversion factor from tokens -> ether (normalized price value)
            vars.tokensToDenom = mul_(
                mul_(vars.collateralFactor, vars.exchangeRate),
                vars.oraclePrice
            );

            // sumCollateral += tokensToDenom * cTokenBalance
            vars.sumCollateral = mul_ScalarTruncateAddUInt(
                vars.tokensToDenom,
                vars.cTokenBalance,
                vars.sumCollateral
            );

            // sumBorrow += oraclePrice * borrowBalance
            vars.sumBorrow = mul_ScalarTruncateAddUInt(
                vars.oraclePrice,
                vars.borrowBalance,
                vars.sumBorrow
            );
        }

        return (vars.sumCollateral, vars.sumBorrow);
    }
}
