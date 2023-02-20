// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Trust} from "@rari-capital/solmate/src/auth/Trust.sol";

import "../lib/PercentMath.sol";
import "../vault/IVault.sol";
import "./IStrategy.sol";
import "./anchor/IEthAnchorRouter.sol";
import "./anchor/IExchangeRateFeeder.sol";

// import "./Controllable.sol";

/**
 * Base strategy that handles UST tokens and invests them via the EthAnchor
 * protocol (https://docs.anchorprotocol.com/ethanchor/ethanchor)
 */
abstract contract BaseStrategy is IStrategy, Trust {
    using SafeERC20 for IERC20;
    using PercentMath for uint256;

    event PerfFeeClaimed(uint256 amount);
    event PerfFeePctUpdated(uint256 pct);

    struct Operation {
        address operator;
        uint256 amount;
    }

    IERC20 public override(IStrategy) underlying;
    // Vault address
    address public override(IStrategy) vault;

    // address of the treasury
    address public treasury;

    // address for the UST token
    IERC20 public ustToken;

    // address for the aUST token (wrapped Anchor UST, received to accrue interest for an Anchor deposit)
    IERC20 public aUstToken;

    // performance fee taken by the treasury on profits
    uint16 public perfFeePct;

    // external contract to interact with EthAnchor
    IEthAnchorRouter public ethAnchorRouter;

    // external exchange rate provider
    IExchangeRateFeeder public exchangeRateFeeder;

    // amount currently pending in deposits to EthAnchor
    uint256 public pendingDeposits;

    // amount currently pending redeemption from EthAnchor
    uint256 public pendingRedeems;

    // deposit operations history
    Operation[] public depositOperations;

    // redeem operations history
    Operation[] public redeemOperations;

    // amount of UST converted (used to calculate yield)
    uint256 public convertedUst;

    // restructs a function to be called only by the vault or governance
    modifier restricted() {
        require(msg.sender == vault || isTrusted[msg.sender], "restricted");

        _;
    }

    modifier onlyVault() {
        require(msg.sender == vault, "only vault");

        _;
    }

    constructor(
        address _vault,
        address _treasury,
        address _ethAnchorRouter,
        address _exchangeRateFeeder,
        IERC20 _ustToken,
        IERC20 _aUstToken,
        uint16 _perfFeePct,
        address _owner
    ) Trust(_owner) {
        require(_ethAnchorRouter != address(0), "0x addr");
        require(_exchangeRateFeeder != address(0), "0x addr");
        require(address(_ustToken) != address(0), "0x addr");
        require(address(_aUstToken) != address(0), "0x addr");
        require(PercentMath.validPerc(_perfFeePct), "invalid pct");

        treasury = _treasury;
        vault = _vault;
        underlying = IVault(_vault).underlying();
        ethAnchorRouter = IEthAnchorRouter(_ethAnchorRouter);
        exchangeRateFeeder = IExchangeRateFeeder(_exchangeRateFeeder);
        ustToken = _ustToken;
        aUstToken = _aUstToken;
        perfFeePct = _perfFeePct;

        // pre-approve EthAnchor router to transact all UST and aUST
        ustToken.safeApprove(_ethAnchorRouter, type(uint256).max);
        aUstToken.safeApprove(_ethAnchorRouter, type(uint256).max);
    }

    /**
     * Initiates a deposit of all the currently held UST into EthAnchor
     *
     * @notice since EthAnchor uses an asynchronous model, this function
     * only starts the deposit process, but does not finish it.
     */
    function doHardWork() external virtual override(IStrategy) restricted {
        _initDepositStable();
    }

    function _initDepositStable() internal {
        uint256 ustBalance = _getUstBalance();
        require(ustBalance > 0, "balance 0");
        pendingDeposits += ustBalance;
        address _operator = ethAnchorRouter.initDepositStable(ustBalance);
        depositOperations.push(
            Operation({operator: _operator, amount: ustBalance})
        );
    }

    /**
     * Calls EthAnchor with a pending deposit ID, and attempts to finish it.
     *
     * @notice Must be called some time after `doHardWork()`. Will only work if
     * the EthAnchor bridge has finished processing the deposit.
     *
     * @param idx Id of the pending deposit operation
     */
    function finishDepositStable(uint256 idx) external {
        require(depositOperations.length > idx, "not running");
        Operation storage operation = depositOperations[idx];
        ethAnchorRouter.finishDepositStable(operation.operator);

        pendingDeposits -= operation.amount;
        convertedUst += operation.amount;

        operation.operator = depositOperations[depositOperations.length - 1]
            .operator;
        operation.amount = depositOperations[depositOperations.length - 1]
            .amount;
        depositOperations.pop();
    }

    /**
     * Initiates a withdrawal of UST from EthAnchor
     *
     * @notice since EthAnchor uses an asynchronous model, this function
     * only starts the redeem process, but does not finish it.
     *
     * @param amount Amount of aUST to redeem
     */
    function initRedeemStable(uint256 amount) public restricted {
        uint256 aUstBalance = _getAUstBalance();
        require(amount > 0, "amount 0");
        require(aUstBalance >= amount, "insufficient");
        pendingRedeems += amount;
        address _operator = ethAnchorRouter.initRedeemStable(amount);
        redeemOperations.push(Operation({operator: _operator, amount: amount}));
    }

    /**
     * Calls EthAnchor with a pending redeem ID, and attempts to finish it.
     *
     * @notice Must be called some time after `initRedeemStable()`. Will only work if
     * the EthAnchor bridge has finished processing the deposit.
     *
     * @param idx Id of the pending redeem operation
     */
    function finishRedeemStable(uint256 idx) public virtual {
        require(redeemOperations.length > idx, "not running");
        Operation storage operation = redeemOperations[idx];
        uint256 aUstBalance = _getAUstBalance() + pendingRedeems;
        uint256 originalUst = (convertedUst * operation.amount) / aUstBalance;
        uint256 ustBalanceBefore = _getUstBalance();

        ethAnchorRouter.finishRedeemStable(operation.operator);

        uint256 redeemedAmount = _getUstBalance() - ustBalanceBefore;
        uint256 perfFee = redeemedAmount > originalUst
            ? (redeemedAmount - originalUst).percOf(perfFeePct)
            : 0;
        if (perfFee > 0) {
            ustToken.safeTransfer(treasury, perfFee);
            emit PerfFeeClaimed(perfFee);
        }
        convertedUst -= originalUst;
        pendingRedeems -= operation.amount;

        operation.operator = redeemOperations[redeemOperations.length - 1]
            .operator;
        operation.amount = redeemOperations[redeemOperations.length - 1].amount;
        redeemOperations.pop();
    }

    /**
     * Withdraws the entire amount back to the vault
     *
     * @notice since some of the amount may be deposited into EthAnchor, this
     * call may not withdraw all the funds right away. It will start a redeem
     * process on EthAnchor, but this function must be called again a second
     * time once that is finished.
     */
    function withdrawAllToVault() external override(IStrategy) restricted {
        uint256 aUstBalance = _getAUstBalance();
        if (aUstBalance > 0) {
            initRedeemStable(aUstBalance);
        }
        uint256 underlyingBalance = _getUnderlyingBalance();
        if (underlyingBalance > 0) {
            underlying.safeTransfer(vault, underlyingBalance);
        }
    }

    /**
     * Withdraws a specified amount back to the vault
     *
     * @notice Unlike `withdrawToVault`, this function only considers the
     * amount currently not invested, but only what is currently held by the
     * strategy
     *
     * @param amount Amount to withdraw
     */
    function withdrawToVault(uint256 amount)
        external
        override(IStrategy)
        restricted
    {
        underlying.safeTransfer(vault, amount);
    }

    /**
     * Updates the performance fee
     *
     * @notice Can only be called by governance
     *
     * @param _perfFeePct The new performance fee %
     */
    function setPerfFeePct(uint16 _perfFeePct) external restricted {
        require(PercentMath.validPerc(_perfFeePct), "invalid pct");
        perfFeePct = _perfFeePct;
        emit PerfFeePctUpdated(_perfFeePct);
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
        virtual
        override(IStrategy)
        returns (uint256)
    {
        uint256 underlyingBalance = _getUnderlyingBalance() + pendingDeposits;
        uint256 aUstBalance = _getAUstBalance() + pendingRedeems;

        return
            underlyingBalance +
            ((exchangeRateFeeder.exchangeRateOf(address(aUstToken), true) *
                aUstBalance) / 1e18);
    }

    // Amount of underlying tokens in the strategy
    function _getUnderlyingBalance() internal view returns (uint256) {
        return underlying.balanceOf(address(this));
    }

    // Amount of UST tokens in the strategy
    function _getUstBalance() internal view returns (uint256) {
        return ustToken.balanceOf(address(this));
    }

    // Amount of aUST tokens in the strategy
    function _getAUstBalance() internal view returns (uint256) {
        return aUstToken.balanceOf(address(this));
    }

    // Amount of pending deposit operations
    function depositOperationLength() external view returns (uint256) {
        return depositOperations.length;
    }

    // Amount of pending redeem operations
    function redeemOperationLength() external view returns (uint256) {
        return redeemOperations.length;
    }
}
