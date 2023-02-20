// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./wfCashLogic.sol";
import "../interfaces/IERC4626.sol";

contract wfCashERC4626 is IERC4626, wfCashLogic {
    constructor(INotionalV2 _notional, WETH9 _weth) wfCashLogic(_notional, _weth) {}

    /** @dev See {IERC4626-asset} */
    function asset() public view override returns (address) {
        (IERC20 underlyingToken, bool isETH) = getToken(true);
        return isETH ? address(WETH) : address(underlyingToken);
    }

    function _getMaturedValue() private view returns (uint256) {
        // If the fCash has matured we use the cash balance instead.
        uint16 currencyId = getCurrencyId();
        // We cannot settle an account in a view method, so this may fail if the account has not been settled
        // after maturity. This can be done by anyone so it should not be an issue
        (int256 cashBalance, /* */, /* */) = NotionalV2.getAccountBalance(currencyId, address(this));
        int256 underlyingExternal = NotionalV2.convertCashBalanceToExternal(currencyId, cashBalance, true);
        require(underlyingExternal > 0, "Must Settle");

        return uint256(underlyingExternal);
    }

    function _getPresentValue(uint256 fCashAmount) private view returns (uint256) {
        (/* */, int256 precision) = getUnderlyingToken();
        // Get the present value of the fCash held by the contract, this is returned in 8 decimal precision
        (uint16 currencyId, uint40 maturity) = getDecodedID();
        int256 pvInternal = NotionalV2.getPresentfCashValue(
            currencyId,
            maturity,
            int256(fCashAmount), // total supply cannot overflow as fCash overflows at uint88
            block.timestamp,
            false
        );

        int256 pvExternal = (pvInternal * precision) / Constants.INTERNAL_TOKEN_PRECISION;
        // PV should always be >= 0 since we are lending
        require(pvExternal >= 0);
        return uint256(pvExternal);
    }

    /** @dev See {IERC4626-totalAssets} */
    function totalAssets() public view override returns (uint256) {
        return hasMatured() ?  _getMaturedValue() : _getPresentValue(totalSupply());
    }

    /** @dev See {IERC4626-convertToShares} */
    function convertToShares(uint256 assets) public view override returns (uint256 shares) {
        uint256 supply = totalSupply();
        if (supply == 0) {
            // Scales assets by the value of a single unit of fCash
            uint256 unitfCashValue = _getPresentValue(uint256(Constants.INTERNAL_TOKEN_PRECISION));
            return (assets * uint256(Constants.INTERNAL_TOKEN_PRECISION)) / unitfCashValue;
        }

        return (assets * totalSupply()) / totalAssets();
    }

    /** @dev See {IERC4626-convertToAssets} */
    function convertToAssets(uint256 shares) public view override returns (uint256 assets) {
        uint256 supply = totalSupply();
        if (supply == 0) {
            // Catch the edge case where totalSupply causes a divide by zero error
            return _getPresentValue(shares);
        }

        return (shares * totalAssets()) / supply;
    }

    /** @dev See {IERC4626-maxDeposit} */
    function maxDeposit(address) public view override returns (uint256) {
        return hasMatured() ? 0 : type(uint256).max;
    }

    /** @dev See {IERC4626-maxMint} */
    function maxMint(address) public view override returns (uint256) {
        return hasMatured() ? 0 : type(uint88).max;
    }

    /** @dev See {IERC4626-maxWithdraw} */
    function maxWithdraw(address owner) public view override returns (uint256) {
        return previewWithdraw(balanceOf(owner));
    }

    /** @dev See {IERC4626-maxRedeem} */
    function maxRedeem(address owner) public view override returns (uint256) {
        return balanceOf(owner);
    }

    /** @dev See {IERC4626-previewDeposit} */
    function previewDeposit(uint256 assets) public view override returns (uint256) {
        if (hasMatured()) {
            return 0;
        } else {
            // This is how much fCash received from depositing assets
            (uint16 currencyId, uint40 maturity) = getDecodedID();
            (uint256 fCashAmount, /* */, /* */) = NotionalV2.getfCashLendFromDeposit(
                currencyId,
                assets,
                maturity,
                0,
                block.timestamp,
                true
            );

            return fCashAmount;
        }
    }

    /** @dev See {IERC4626-previewMint} */
    function previewMint(uint256 shares) public view override returns (uint256) {
        if (hasMatured()) {
            return 0;
        } else {
            // This is how much fCash received from depositing assets
            (uint16 currencyId, uint40 maturity) = getDecodedID();
            (uint256 depositAmountUnderlying, /* */, /* */, /* */) = NotionalV2.getDepositFromfCashLend(
                currencyId,
                shares,
                maturity,
                0,
                block.timestamp
            );

            return depositAmountUnderlying;
        }
    }

    /** @dev See {IERC4626-previewWithdraw} */
    function previewWithdraw(uint256 assets) public view override returns (uint256 shares) {
        if (hasMatured()) {
            shares = convertToShares(assets);
        } else {
            // If withdrawing non-matured assets, we sell them on the market (i.e. borrow)
            (uint16 currencyId, uint40 maturity) = getDecodedID();
            (shares, /* */, /* */) = NotionalV2.getfCashBorrowFromPrincipal(
                currencyId,
                assets,
                maturity,
                0,
                block.timestamp,
                true
            );
        }
    }

    /** @dev See {IERC4626-previewRedeem} */
    function previewRedeem(uint256 shares) public view override returns (uint256 assets) {
        if (hasMatured()) {
            assets = convertToAssets(shares);
        } else {
            // If withdrawing non-matured assets, we sell them on the market (i.e. borrow)
            (uint16 currencyId, uint40 maturity) = getDecodedID();
            (assets, /* */, /* */, /* */) = NotionalV2.getPrincipalFromfCashBorrow(
                currencyId,
                shares,
                maturity,
                0,
                block.timestamp
            );
        }
    }

    /** @dev See {IERC4626-deposit} */
    function deposit(uint256 assets, address receiver) public override returns (uint256) {
        uint256 shares = previewDeposit(assets);
        // Will revert if matured
        _mintInternal(assets, _safeUint88(shares), receiver, 0, true);
        emit Deposit(msg.sender, receiver, assets, shares);
        return shares;
    }

    /** @dev See {IERC4626-mint} */
    function mint(uint256 shares, address receiver) public override returns (uint256) {
        uint256 assets = previewMint(shares);
        // Will revert if matured
        _mintInternal(assets, _safeUint88(shares), receiver, 0, true);
        emit Deposit(msg.sender, receiver, assets, shares);
        return assets;
    }

    /** @dev See {IERC4626-withdraw} */
    function withdraw(
        uint256 assets,
        address receiver,
        address owner
    ) public override returns (uint256) {
        uint256 shares = previewWithdraw(assets);

        if (msg.sender != owner) {
            _spendAllowance(owner, msg.sender, shares);
        }
        _redeemInternal(shares, receiver, owner);

        emit Withdraw(msg.sender, receiver, owner, assets, shares);

        return shares;
    }

    /** @dev See {IERC4626-redeem} */
    function redeem(
        uint256 shares,
        address receiver,
        address owner
    ) public override returns (uint256) {
        // It is more accurate and gas efficient to check the balance of the
        // receiver here than rely on the previewRedeem method.
        uint256 balanceBefore = IERC20(asset()).balanceOf(receiver);

        if (msg.sender != owner) {
            _spendAllowance(owner, msg.sender, shares);
        }
        _redeemInternal(shares, receiver, owner);

        uint256 balanceAfter = IERC20(asset()).balanceOf(receiver);
        uint256 assets = balanceAfter - balanceBefore;
        emit Withdraw(msg.sender, receiver, owner, assets, shares);
        return assets;
    }

    function _redeemInternal(
        uint256 shares,
        address receiver,
        address owner
    ) private {
        bytes memory userData = abi.encode(
            RedeemOpts({
                redeemToUnderlying: true,
                transferfCash: false,
                receiver: receiver,
                maxImpliedRate: 0
            })
        );

        // No operator data
        _burn(owner, shares, userData, "");
    }

    function _safeNegInt88(uint256 x) private pure returns (int88) {
        int256 y = -int256(x);
        require(int256(type(int88).min) <= y);
        return int88(y);
    }
}