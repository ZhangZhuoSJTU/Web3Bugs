// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.10;

import "./curve/ICurve.sol";
import "./BaseStrategy.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * Strategy that handles non-UST tokens, by first converting them to UST via
 * Curve (https://curve.fi/), and only then depositing into EthAnchor
 */
contract NonUSTStrategy is BaseStrategy {
    using SafeERC20 for IERC20;

    // address of the Curve pool to use
    ICurve public curvePool;

    // index of the underlying token in the pool
    int128 public underlyingI;

    // index of the UST token in the pool
    int128 public ustI;

    constructor(
        address _vault,
        address _treasury,
        address _ethAnchorRouter,
        address _exchangeRateFeeder,
        IERC20 _ustToken,
        IERC20 _aUstToken,
        uint16 _perfFeePct,
        address _owner,
        address _curvePool,
        int128 _underlyingI,
        int128 _ustI
    )
        BaseStrategy(
            _vault,
            _treasury,
            _ethAnchorRouter,
            _exchangeRateFeeder,
            _ustToken,
            _aUstToken,
            _perfFeePct,
            _owner
        )
    {
        require(underlying != _ustToken, "invalid underlying");
        require(_curvePool != address(0), "0x addr");
        curvePool = ICurve(_curvePool);
        underlyingI = _underlyingI;
        ustI = _ustI;

        ustToken.safeApprove(_curvePool, type(uint256).max);
        underlying.safeApprove(_curvePool, type(uint256).max);
    }

    /**
     * Swaps the underlying currency for UST, and initiates a deposit of all
     * the converted UST into EthAnchor
     *
     * @notice since EthAnchor uses an asynchronous model, this function
     * only starts the deposit process, but does not finish it.
     */
    function doHardWork() external override(BaseStrategy) restricted {
        _swapUnderlyingToUst();
        _initDepositStable();
    }

    /**
     * Calls Curve to convert the existing underlying balance into UST
     */
    function _swapUnderlyingToUst() internal {
        uint256 underlyingBalance = _getUnderlyingBalance();
        if (underlyingBalance > 0) {
            // slither-disable-next-line unused-return
            curvePool.exchange_underlying(
                underlyingI,
                ustI,
                underlyingBalance,
                0
            );
        }
    }

    /**
     * Calls Curve to convert the existing UST back into the underlying token
     */
    function _swapUstToUnderlying() internal {
        uint256 ustBalance = _getUstBalance();
        if (ustBalance > 0) {
            // slither-disable-next-line unused-return
            curvePool.exchange_underlying(ustI, underlyingI, ustBalance, 0);
        }
    }

    /**
     * Calls EthAnchor with a pending redeem ID, and attempts to finish it.
     * Once UST is retrieved, convert it back to underlying via Curve
     *
     * @notice Must be called some time after `initRedeemStable()`. Will only work if
     * the EthAnchor bridge has finished processing the deposit.
     *
     * @param idx Id of the pending redeem operation
     */
    function finishRedeemStable(uint256 idx) public override(BaseStrategy) {
        super.finishRedeemStable(idx);
        _swapUstToUnderlying();
    }

    /**
     * Amount, expressed in the underlying currency, currently in the strategy
     *
     * @notice both held and invested amounts are included here, using the
     * latest known exchange rates to the underlying currency
     *
     * @return The total amount of underlying
     */
    function investedAssets()
        external
        view
        override(BaseStrategy)
        returns (uint256)
    {
        uint256 underlyingBalance = _getUnderlyingBalance();
        uint256 aUstBalance = _getAUstBalance() + pendingRedeems;

        uint256 ustAssets = ((exchangeRateFeeder.exchangeRateOf(
            address(aUstToken),
            true
        ) * aUstBalance) / 1e18) + pendingDeposits;
        return
            underlyingBalance +
            curvePool.get_dy_underlying(ustI, underlyingI, ustAssets);
    }
}
