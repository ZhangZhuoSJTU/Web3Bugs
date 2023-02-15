// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.4;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IPCVDeposit} from "../pcv/IPCVDeposit.sol";
import {GlobalRateLimitedMinter} from "../utils/GlobalRateLimitedMinter.sol";

/**
 * @title Fei Peg Stability Module
 * @author Fei Protocol
 * @notice  The Fei PSM is a contract which pulls reserve assets from PCV Deposits in order to exchange FEI at $1 of underlying assets with a fee.
 * `mint()` - buy FEI for $1 of underlying tokens
 * `redeem()` - sell FEI back for $1 of the same
 *
 *
 * The contract is a
 * OracleRef - to determine price of underlying, and
 * RateLimitedReplenishable - to stop infinite mints and related DOS issues
 *
 * Inspired by MakerDAO PSM, code written without reference
 */
interface INonCustodialPSM {
    // ----------- Public State Changing API -----------

    /// @notice mint `amountFeiOut` FEI to address `to` for `amountIn` underlying tokens
    /// @dev see getMintAmountOut() to pre-calculate amount out
    function mint(
        address to,
        uint256 amountIn,
        uint256 minAmountOut
    ) external returns (uint256 amountFeiOut);

    /// @notice redeem `amountFeiIn` FEI for `amountOut` underlying tokens and send to address `to`
    /// @dev see getRedeemAmountOut() to pre-calculate amount out
    function redeem(
        address to,
        uint256 amountFeiIn,
        uint256 minAmountOut
    ) external returns (uint256 amountOut);

    // ----------- Governor or Admin Only State Changing API -----------

    /// @notice set the mint fee vs oracle price in basis point terms
    function setMintFee(uint256 newMintFeeBasisPoints) external;

    /// @notice set the redemption fee vs oracle price in basis point terms
    function setRedeemFee(uint256 newRedeemFeeBasisPoints) external;

    /// @notice set the target for sending surplus reserves
    function setPCVDeposit(IPCVDeposit newTarget) external;

    /// @notice set the target to call for FEI minting
    function setGlobalRateLimitedMinter(GlobalRateLimitedMinter newMinter)
        external;

    /// @notice withdraw ERC20 from the contract
    function withdrawERC20(
        address token,
        address to,
        uint256 amount
    ) external;

    // ----------- Getters -----------

    /// @notice calculate the amount of FEI out for a given `amountIn` of underlying
    function getMintAmountOut(uint256 amountIn)
        external
        view
        returns (uint256 amountFeiOut);

    /// @notice calculate the amount of underlying out for a given `amountFeiIn` of FEI
    function getRedeemAmountOut(uint256 amountFeiIn)
        external
        view
        returns (uint256 amountOut);

    /// @notice the maximum mint amount out
    function getMaxMintAmountOut() external view returns (uint256);

    /// @notice the mint fee vs oracle price in basis point terms
    function mintFeeBasisPoints() external view returns (uint256);

    /// @notice the redemption fee vs oracle price in basis point terms
    function redeemFeeBasisPoints() external view returns (uint256);

    /// @notice the underlying token exchanged for FEI
    function underlyingToken() external view returns (IERC20);

    /// @notice the PCV deposit target to deposit and withdraw from
    function pcvDeposit() external view returns (IPCVDeposit);

    /// @notice Rate Limited Minter contract that will be called when FEI needs to be minted
    function rateLimitedMinter()
        external
        view
        returns (GlobalRateLimitedMinter);

    /// @notice the max mint and redeem fee in basis points
    function MAX_FEE() external view returns (uint256);

    // ----------- Events -----------

    /// @notice event emitted when a new max fee is set
    event MaxFeeUpdate(uint256 oldMaxFee, uint256 newMaxFee);

    /// @notice event emitted when a new mint fee is set
    event MintFeeUpdate(uint256 oldMintFee, uint256 newMintFee);

    /// @notice event emitted when a new redeem fee is set
    event RedeemFeeUpdate(uint256 oldRedeemFee, uint256 newRedeemFee);

    /// @notice event emitted when reservesThreshold is updated
    event ReservesThresholdUpdate(
        uint256 oldReservesThreshold,
        uint256 newReservesThreshold
    );

    /// @notice event emitted when surplus target is updated
    event PCVDepositUpdate(IPCVDeposit oldTarget, IPCVDeposit newTarget);

    /// @notice event emitted upon a redemption
    event Redeem(address to, uint256 amountFeiIn, uint256 amountAssetOut);

    /// @notice event emitted when fei gets minted
    event Mint(address to, uint256 amountIn, uint256 amountFeiOut);

    /// @notice event emitted when ERC20 tokens get withdrawn
    event WithdrawERC20(
        address indexed _caller,
        address indexed _token,
        address indexed _to,
        uint256 _amount
    );

    /// @notice event emitted when global rate limited minter is updated
    event GlobalRateLimitedMinterUpdate(
        GlobalRateLimitedMinter oldMinter,
        GlobalRateLimitedMinter newMinter
    );

    /// @notice event that is emitted when redemptions are paused
    event RedemptionsPaused(address account);

    /// @notice event that is emitted when redemptions are unpaused
    event RedemptionsUnpaused(address account);

    /// @notice event that is emitted when minting is paused
    event MintingPaused(address account);

    /// @notice event that is emitted when minting is unpaused
    event MintingUnpaused(address account);
}
