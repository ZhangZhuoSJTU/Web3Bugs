// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IVault {
    //
    // Structs
    //
    struct ClaimParams {
        uint16 pct;
        address beneficiary;
        bytes data;
    }

    struct DepositParams {
        uint256 amount;
        ClaimParams[] claims;
        uint256 lockedUntil;
    }

    //
    // Events
    //

    event DepositMinted(
        uint256 indexed id,
        uint256 groupId,
        uint256 amount,
        uint256 shares,
        address indexed depositor,
        address indexed claimer,
        uint256 claimerId,
        uint256 lockedUntil
    );

    event DepositBurned(uint256 indexed id, uint256 shares, address indexed to);

    event InvestPercentageUpdated(uint256 percentage);

    event Invested(uint256 amount);

    //
    // Public API
    //

    /**
     * Update the invested amount;
     */
    function updateInvested() external;

    /**
     * Calculates underlying investable amount.
     *
     * @return the investable amount
     */
    function investableAmount() external view returns (uint256);

    /**
     * Update invest percentage
     *
     * Emits {InvestPercentageUpdated} event
     *
     * @param _investPct the new invest percentage
     */
    function setInvestPerc(uint16 _investPct) external;

    /**
     * Percentage of the total underlying to invest in the strategy
     */
    function investPerc() external view returns (uint256);

    /**
     * Minimum lock period for each deposit
     */
    function underlying() external view returns (IERC20);

    /**
     * Minimum lock period for each deposit
     */
    function minLockPeriod() external view returns (uint256);

    /**
     * Total amount of underlying currently controlled by the
     * vault and the its strategy.
     */
    function totalUnderlying() external view returns (uint256);

    /**
     * Total amount of shares
     */
    function totalShares() external view returns (uint256);

    /**
     * Computes the amount of yield available for an an address.
     *
     * @param _to address to consider.
     *
     * @return amount of yield for @param _to.
     */
    function yieldFor(address _to) external view returns (uint256);

    /**
     * Transfers all the yield generated for the caller to
     *
     * @param _to Address that will receive the yield.
     */
    function claimYield(address _to) external;

    /**
     * Creates a new deposit
     *
     * @param _params Deposit params
     */
    function deposit(DepositParams calldata _params) external;

    /**
     * Withdraws the principal from the deposits with the ids provided in @param _ids and sends it to @param _to.
     *
     * It fails if the vault is underperforming and there are not enough funds
     * to withdraw the expected amount.
     *
     * @param _to Address that will receive the funds.
     * @param _ids Array with the ids of the deposits.
     */
    function withdraw(address _to, uint256[] memory _ids) external;

    /**
     * Withdraws the principal from the deposits with the ids provided in @param _ids and sends it to @param _to.
     *
     * When the vault is underperforming it withdraws the funds with a loss.
     *
     * @param _to Address that will receive the funds.
     * @param _ids Array with the ids of the deposits.
     */
    function forceWithdraw(address _to, uint256[] memory _ids) external;

    /**
     * Changes the strategy used by the vault.
     *
     * @param _strategy the new strategy's address.
     */
    function setStrategy(address _strategy) external;
}
