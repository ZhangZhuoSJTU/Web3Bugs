// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.9;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

import "../../../interfaces/IGasBank.sol";
import "../../../interfaces/pool/ILiquidityPool.sol";
import "../../../interfaces/ISwapperRegistry.sol";
import "../../../interfaces/IController.sol";
import "../../../interfaces/IStakerVault.sol";
import "../../../interfaces/ISwapper.sol";
import "../../../interfaces/actions/topup/ITopUpHandler.sol";
import "../../../interfaces/actions/topup/ITopUpAction.sol";
import "../../../interfaces/actions/IActionFeeHandler.sol";

import "../../../libraries/AddressProviderHelpers.sol";
import "../../../libraries/Errors.sol";
import "../../../libraries/ScaledMath.sol";
import "../../../libraries/EnumerableExtensions.sol";

import "../../access/Authorization.sol";
import "../../utils/Preparable.sol";

/**
 * @notice The logic here should really be part of the top-up action
 * but is split in a library to circumvent the byte-code size limit
 */
library TopUpActionLibrary {
    using SafeERC20 for IERC20;
    using ScaledMath for uint256;
    using AddressProviderHelpers for IAddressProvider;

    function lockFunds(
        address stakerVaultAddress,
        address payer,
        address token,
        uint256 lockAmount,
        uint256 depositAmount
    ) external {
        uint256 amountLeft = lockAmount;
        IStakerVault stakerVault = IStakerVault(stakerVaultAddress);

        // stake deposit amount
        if (depositAmount > 0) {
            depositAmount = depositAmount > amountLeft ? amountLeft : depositAmount;
            IERC20(token).safeTransferFrom(payer, address(this), depositAmount);
            IERC20(token).safeApprove(stakerVaultAddress, depositAmount);
            stakerVault.stake(depositAmount);
            stakerVault.increaseActionLockedBalance(payer, depositAmount);
            amountLeft -= depositAmount;
        }

        // use stake vault allowance if available and required
        if (amountLeft > 0) {
            uint256 balance = stakerVault.balanceOf(payer);
            uint256 allowance = stakerVault.allowance(payer, address(this));
            uint256 availableFunds = balance < allowance ? balance : allowance;
            if (availableFunds >= amountLeft) {
                stakerVault.transferFrom(payer, address(this), amountLeft);
                amountLeft = 0;
            }
        }

        require(amountLeft == 0, Error.INSUFFICIENT_UPDATE_BALANCE);
    }

    /**
     * @dev Computes and returns the amount of LP tokens of type `token` that will be received in exchange for an `amount` of the underlying.
     */
    function calcExchangeAmount(
        IAddressProvider addressProvider,
        address token,
        address actionToken,
        uint256 amount
    ) external view returns (uint256) {
        ILiquidityPool pool = addressProvider.getPoolForToken(token);
        uint256 rate = pool.exchangeRate();
        address underlying = pool.getUnderlying();
        if (underlying == actionToken) {
            return amount.scaledDivRoundUp(rate);
        }

        ISwapper swapper = getSwapper(addressProvider, underlying, actionToken);
        uint256 swapperRate = swapper.getRate(underlying, actionToken);
        return amount.scaledDivRoundUp(rate.scaledMul(swapperRate));
    }

    function getSwapper(
        IAddressProvider addressProvider,
        address underlying,
        address actionToken
    ) public view returns (ISwapper) {
        address swapperRegistry = addressProvider.getSwapperRegistry();
        address swapper = ISwapperRegistry(swapperRegistry).getSwapper(underlying, actionToken);
        require(swapper != address(0), Error.SWAP_PATH_NOT_FOUND);
        return ISwapper(swapper);
    }
}

contract TopUpAction is ITopUpAction, Authorization, Preparable, Initializable {
    using ScaledMath for uint256;
    using ScaledMath for uint128;
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;
    using EnumerableSet for EnumerableSet.Bytes32Set;
    using EnumerableExtensions for EnumerableSet.AddressSet;
    using AddressProviderHelpers for IAddressProvider;

    /**
     * @dev Temporary struct to hold local variables in execute
     * and avoid the stack being "too deep"
     */
    struct ExecuteLocalVars {
        uint256 minActionAmountToTopUp;
        uint256 actionTokenAmount;
        uint256 depositTotalFeesAmount;
        uint256 actionAmountWithFees;
        uint256 userFactor;
        uint256 rate;
        uint256 depositAmountWithFees;
        uint256 depositAmountWithoutFees;
        uint256 actionFee;
        uint256 totalActionTokenAmount;
        uint128 totalTopUpAmount;
        bool success;
        bytes topupResult;
        uint256 gasBankBalance;
        uint256 initialGas;
        uint256 gasConsumed;
        uint256 userGasPrice;
        uint256 estimatedRequiredGas;
        uint256 estimatedRequiredWeiForGas;
        uint256 requiredWeiForGas;
        uint256 reimbursedWeiForGas;
        address underlying;
        bool removePosition;
    }

    EnumerableSet.AddressSet private _usableTokens;

    uint256 internal constant _INITIAL_ESTIMATED_GAS_USAGE = 500_000;

    bytes32 internal constant _ACTION_FEE_KEY = "ActionFee";
    bytes32 internal constant _FEE_HANDLER_KEY = "FeeHandler";
    bytes32 internal constant _TOP_UP_HANDLER_KEY = "TopUpHandler";
    bytes32 internal constant _ESTIMATED_GAS_USAGE_KEY = "EstimatedGasUsage";
    bytes32 internal constant _MAX_SWAPPER_SLIPPAGE_KEY = "MaxSwapperSlippage";

    uint256 internal constant _MAX_ACTION_FEE = 0.5 * 1e18;
    uint256 internal constant _MIN_SWAPPER_SLIPPAGE = 0.6 * 1e18;
    uint256 internal constant _MAX_SWAPPER_SLIPPAGE = 0.95 * 1e18;

    IController public immutable controller;
    IAddressProvider public immutable addressProvider;

    EnumerableSet.Bytes32Set internal _supportedProtocols;

    /// @notice mapping of (payer -> account -> protocol -> Record)
    mapping(address => mapping(bytes32 => mapping(bytes32 => Record))) private _positions;

    mapping(address => RecordMeta[]) internal _userPositions;

    EnumerableSet.AddressSet internal _usersWithPositions;

    constructor(IController _controller)
        Authorization(_controller.addressProvider().getRoleManager())
    {
        controller = _controller;
        addressProvider = controller.addressProvider();
        _setConfig(_ESTIMATED_GAS_USAGE_KEY, _INITIAL_ESTIMATED_GAS_USAGE);
    }

    receive() external payable {
        // solhint-disable-previous-line no-empty-blocks
    }

    function initialize(
        address feeHandler,
        bytes32[] calldata protocols,
        address[] calldata handlers
    ) external initializer onlyGovernance {
        require(protocols.length == handlers.length, Error.INVALID_ARGUMENT);
        _setConfig(_FEE_HANDLER_KEY, feeHandler);
        _setConfig(_MAX_SWAPPER_SLIPPAGE_KEY, _MAX_SWAPPER_SLIPPAGE);
        for (uint256 i = 0; i < protocols.length; i++) {
            bytes32 protocolKey = _getProtocolKey(protocols[i]);
            _setConfig(protocolKey, handlers[i]);
            _updateTopUpHandler(protocols[i], address(0), handlers[i]);
        }
    }

    /**
     * @notice Register a top up action.
     * @dev The `depositAmount` must be greater or equal to the `totalTopUpAmount` (which is denominated in `actionToken`).
     * @param account Account to be topped up (first 20 bytes will typically be the address).
     * @param depositAmount Amount of `depositToken` that will be locked.
     * @param protocol Protocol which holds position to be topped up.
     * @param record containing the data for the position to register
     */
    function register(
        bytes32 account,
        bytes32 protocol,
        uint128 depositAmount,
        Record memory record
    ) external payable returns (bool) {
        require(_supportedProtocols.contains(protocol), Error.PROTOCOL_NOT_FOUND);
        require(record.singleTopUpAmount > 0, Error.INVALID_AMOUNT);
        require(record.threshold > ScaledMath.ONE, Error.INVALID_AMOUNT);
        require(record.singleTopUpAmount <= record.totalTopUpAmount, Error.INVALID_AMOUNT);
        require(
            _positions[msg.sender][account][protocol].threshold == 0,
            Error.POSITION_ALREADY_EXISTS
        );
        require(_isSwappable(record.depositToken, record.actionToken), Error.SWAP_PATH_NOT_FOUND);
        require(isUsable(record.depositToken), Error.TOKEN_NOT_USABLE);

        uint256 gasDeposit = (record.totalTopUpAmount.divRoundUp(record.singleTopUpAmount)) *
            record.maxFee *
            getEstimatedGasUsage();

        require(msg.value >= gasDeposit, Error.VALUE_TOO_LOW_FOR_GAS);

        uint256 totalLockAmount = _calcExchangeAmount(
            record.depositToken,
            record.actionToken,
            record.totalTopUpAmount
        );
        _lockFunds(msg.sender, record.depositToken, totalLockAmount, depositAmount);

        addressProvider.getGasBank().depositFor{value: msg.value}(msg.sender);

        record.depositTokenBalance = uint128(totalLockAmount);
        _positions[msg.sender][account][protocol] = record;
        _userPositions[msg.sender].push(RecordMeta(account, protocol));
        _usersWithPositions.add(msg.sender);

        emit Register(
            account,
            protocol,
            record.threshold,
            msg.sender,
            record.depositToken,
            totalLockAmount,
            record.actionToken,
            record.singleTopUpAmount,
            record.totalTopUpAmount,
            record.maxFee,
            record.extra
        );
        return true;
    }

    /**
     * @notice See overloaded version of `execute` for more details.
     */
    function execute(
        address payer,
        bytes32 account,
        address beneficiary,
        bytes32 protocol
    ) external override returns (bool) {
        return execute(payer, account, beneficiary, protocol, 0);
    }

    /**
     * @notice Delete a position to back on the given protocol for `account`.
     * @param account Account holding the position.
     * @param protocol Protocol the position is held on.
     * @param unstake If the tokens should be unstaked from vault.
     * @return `true` if successful.
     */
    function resetPosition(
        bytes32 account,
        bytes32 protocol,
        bool unstake
    ) external override returns (bool) {
        address payer = msg.sender;
        Record memory position = _positions[payer][account][protocol];
        require(position.threshold != 0, Error.NO_POSITION_EXISTS);

        address vault = addressProvider.getStakerVault(position.depositToken); // will revert if vault does not exist
        IStakerVault staker = IStakerVault(vault);
        staker.decreaseActionLockedBalance(payer, position.depositTokenBalance);
        if (unstake) {
            staker.unstake(position.depositTokenBalance);
            IERC20(position.depositToken).safeTransfer(payer, position.depositTokenBalance);
        } else {
            staker.transfer(payer, position.depositTokenBalance);
        }

        _removePosition(payer, account, protocol);
        addressProvider.getGasBank().withdrawUnused(payer);
        return true;
    }

    /**
     * @notice Execute top up handler update (with time delay enforced).
     * @dev Needs to be called after the update was prepared. Fails if called before time delay is met.
     * @param protocol Protocol for which a new handler should be executed.
     * @return Address of new handler.
     */
    function executeTopUpHandler(bytes32 protocol) external override returns (address) {
        address oldHandler = _getHandler(protocol, false);
        address newHandler = _executeAddress(_getProtocolKey(protocol));

        _updateTopUpHandler(protocol, oldHandler, newHandler);
        return newHandler;
    }

    /**
     * @notice Reset new top up handler deadline for a protocol.
     * @param protocol Protocol for which top up handler deadline should be reset.
     * @return `true` if successful.
     */
    function resetTopUpHandler(bytes32 protocol) external onlyGovernance returns (bool) {
        return _resetAddressConfig(_getProtocolKey(protocol));
    }

    /**
     * @notice Prepare action fee update.
     * @param newActionFee New fee to set.
     * @return `true` if success.
     */
    function prepareActionFee(uint256 newActionFee) external onlyGovernance returns (bool) {
        require(newActionFee <= _MAX_ACTION_FEE, Error.INVALID_AMOUNT);
        return _prepare(_ACTION_FEE_KEY, newActionFee);
    }

    /**
     * @notice Execute action fee update (with time delay enforced).
     * @dev Needs to be called after the update was prepared. Fails if called before time delay is met.
     * @return `true` if successful.
     */
    function executeActionFee() external override returns (uint256) {
        return _executeUInt256(_ACTION_FEE_KEY);
    }

    /**
     * @notice Reset action fee deadline.
     * @return `true` if successful.
     */
    function resetActionFee() external onlyGovernance returns (bool) {
        return _resetUInt256Config(_ACTION_FEE_KEY);
    }

    /**
     * @notice Prepare swapper slippage update.
     * @param newSwapperSlippage New slippage to set.
     * @return `true` if success.
     */
    function prepareSwapperSlippage(uint256 newSwapperSlippage)
        external
        onlyGovernance
        returns (bool)
    {
        require(
            newSwapperSlippage >= _MIN_SWAPPER_SLIPPAGE &&
                newSwapperSlippage <= _MAX_SWAPPER_SLIPPAGE,
            Error.INVALID_AMOUNT
        );
        return _prepare(_MAX_SWAPPER_SLIPPAGE_KEY, newSwapperSlippage);
    }

    /**
     * @notice Execute swapper slippage update (with time delay enforced).
     * @dev Needs to be called after the update was prepared. Fails if called before time delay is met.
     * @return `true` if successful.
     */
    function executeSwapperSlippage() external override returns (uint256) {
        return _executeUInt256(_MAX_SWAPPER_SLIPPAGE_KEY);
    }

    /**
     * @notice Reset action fee deadline.
     * @return `true` if successful.
     */
    function resetSwapperSlippage() external onlyGovernance returns (bool) {
        return _resetUInt256Config(_MAX_SWAPPER_SLIPPAGE_KEY);
    }

    /** Set fee handler */
    /**
     * @notice Prepare update of fee handler.
     * @param handler New fee handler.
     * @return `true` if success.
     */
    function prepareFeeHandler(address handler) external onlyGovernance returns (bool) {
        return _prepare(_FEE_HANDLER_KEY, handler);
    }

    /**
     * @notice Execute update of fee handler (with time delay enforced).
     * @dev Needs to be called after the update was prepraed. Fails if called before time delay is met.
     * @return `true` if successful.
     */
    function executeFeeHandler() external override returns (address) {
        return _executeAddress(_FEE_HANDLER_KEY);
    }

    /**
     * @notice Reset the handler deadline.
     * @return `true` if success.
     */
    function resetFeeHandler() external onlyGovernance returns (bool) {
        return _resetAddressConfig(_FEE_HANDLER_KEY);
    }

    /**
     * @notice Prepare update of estimated gas usage.
     * @param gasUsage New estimated gas usage.
     * @return `true` if success.
     */
    function prepareEstimatedGasUsage(uint256 gasUsage) external onlyGovernance returns (bool) {
        return _prepare(_ESTIMATED_GAS_USAGE_KEY, gasUsage);
    }

    /**
     * @notice Execute update of gas usage (with time delay enforced).
     * @return `true` if successful.
     */
    function executeEstimatedGasUsage() external returns (uint256) {
        return _executeUInt256(_ESTIMATED_GAS_USAGE_KEY);
    }

    /**
     * @notice Reset the gas usage deadline.
     * @return `true` if success.
     */
    function resetGasUsage() external onlyGovernance returns (bool) {
        return _resetUInt256Config(_ESTIMATED_GAS_USAGE_KEY);
    }

    /**
     * @notice Add a new deposit token that is supported by the action.
     * @dev There is a separate check for whether the usable token (i.e. deposit token)
     *      is swappable for some action token.
     * @param token Address of deposit token that can be used by the action.
     */
    function addUsableToken(address token) external override onlyGovernance returns (bool) {
        return _usableTokens.add(token);
    }

    /**
     * @notice Computes the total amount of ETH (as wei) required to pay for all
     * the top-ups assuming the maximum gas price and the current estimated gas
     * usage of a top-up
     */
    function getEthRequiredForGas(address payer) external view override returns (uint256) {
        uint256 totalEthRequired = 0;
        RecordMeta[] memory userRecordsMeta = _userPositions[payer];
        uint256 gasUsagePerCall = getEstimatedGasUsage();
        uint256 length = userRecordsMeta.length;
        for (uint256 i = 0; i < length; i++) {
            RecordMeta memory meta = userRecordsMeta[i];
            Record memory record = _positions[payer][meta.account][meta.protocol];
            uint256 totalCalls = record.totalTopUpAmount.divRoundUp(record.singleTopUpAmount);
            totalEthRequired += totalCalls * gasUsagePerCall * record.maxFee;
        }
        return totalEthRequired;
    }

    /**
     * @notice Returns a list of positions for the given payer
     */
    function getUserPositions(address payer) external view override returns (RecordMeta[] memory) {
        return _userPositions[payer];
    }

    /**
     * @notice Get a list supported protocols.
     * @return List of supported protocols.
     */
    function getSupportedProtocols() external view override returns (bytes32[] memory) {
        uint256 length = _supportedProtocols.length();
        bytes32[] memory protocols = new bytes32[](length);
        for (uint256 i = 0; i < length; i++) {
            protocols[i] = _supportedProtocols.at(i);
        }
        return protocols;
    }

    /*
     * @notice Gets a list of users that have an active position.
     * @dev Uses cursor pagination.
     * @param cursor The cursor for pagination (should start at 0 for first call).
     * @param howMany Maximum number of users to return in this pagination request.
     * @return users List of users that have an active position.
     * @return nextCursor The cursor to use for the next pagination request.
     */
    function usersWithPositions(uint256 cursor, uint256 howMany)
        external
        view
        override
        returns (address[] memory users, uint256 nextCursor)
    {
        uint256 length = _usersWithPositions.length();
        if (cursor >= length) return (new address[](0), 0);
        if (howMany >= length - cursor) {
            howMany = length - cursor;
        }

        address[] memory usersWithPositions_ = new address[](howMany);
        for (uint256 i = 0; i < howMany; i++) {
            usersWithPositions_[i] = _usersWithPositions.at(i + cursor);
        }

        return (usersWithPositions_, cursor + howMany);
    }

    /**
     * @notice Get a list of all tokens usable for this action.
     * @dev This refers to all tokens that can be used as deposit tokens.
     * @return Array of addresses of usable tokens.
     */
    function getUsableTokens() external view override returns (address[] memory) {
        return _usableTokens.toArray();
    }

    /**
     * @notice Retrieves the topup handler for the given `protocol`
     */
    function getTopUpHandler(bytes32 protocol) external view returns (address) {
        return _getHandler(protocol, false);
    }

    /**
     * @notice Successfully tops up a position if it's conditions are met.
     * @dev pool and vault funds are rebalanced after withdrawal for top up
     * @param payer Account that pays for the top up.
     * @param account Account owning the position for top up.
     * @param beneficiary Address of the keeper's wallet for fee accrual.
     * @param protocol Protocol of the top up position.
     * @param maxWeiForGas the maximum extra amount of wei that the keeper is willing to pay for the gas
     * @return `true` if successful.
     */
    function execute(
        address payer,
        bytes32 account,
        address beneficiary,
        bytes32 protocol,
        uint256 maxWeiForGas
    ) public override returns (bool) {
        require(controller.canKeeperExecuteAction(msg.sender), Error.NOT_ENOUGH_BKD_STAKED);

        ExecuteLocalVars memory vars;

        vars.initialGas = gasleft();

        Record storage position = _positions[payer][account][protocol];
        require(position.threshold != 0, Error.NO_POSITION_EXISTS);
        require(position.totalTopUpAmount > 0, Error.INSUFFICIENT_BALANCE);

        address topUpHandler = _getHandler(protocol, true);
        vars.userFactor = ITopUpHandler(topUpHandler).getUserFactor(account, position.extra);

        // ensure that the position is actually below its set user factor threshold
        require(vars.userFactor < position.threshold, Error.INSUFFICIENT_THRESHOLD);

        IGasBank gasBank = addressProvider.getGasBank();

        // fail early if the user does not have enough funds in the gas bank
        // to cover the cost of the transaction
        vars.estimatedRequiredGas = getEstimatedGasUsage();
        vars.estimatedRequiredWeiForGas = vars.estimatedRequiredGas * tx.gasprice;

        // compute the gas price that the user will be paying
        vars.userGasPrice = block.basefee + position.priorityFee;
        if (vars.userGasPrice > tx.gasprice) vars.userGasPrice = tx.gasprice;
        if (vars.userGasPrice > position.maxFee) vars.userGasPrice = position.maxFee;

        // ensure the current position allows for the gas to be paid
        require(
            vars.estimatedRequiredWeiForGas <=
                vars.estimatedRequiredGas * vars.userGasPrice + maxWeiForGas,
            Error.ESTIMATED_GAS_TOO_HIGH
        );

        vars.gasBankBalance = gasBank.balanceOf(payer);
        // ensure the user has enough funds in the gas bank to cover the gas
        require(
            vars.gasBankBalance + maxWeiForGas >= vars.estimatedRequiredWeiForGas,
            Error.GAS_BANK_BALANCE_TOO_LOW
        );

        vars.totalTopUpAmount = position.totalTopUpAmount;
        vars.actionFee = getActionFee();
        // add top-up fees to top-up amount
        vars.minActionAmountToTopUp = position.singleTopUpAmount;
        vars.actionAmountWithFees = vars.minActionAmountToTopUp.scaledMul(
            ScaledMath.ONE + vars.actionFee
        );

        // if the amount that we want to top-up (including fees) is higher than
        // the available topup amount, we lower this down to what is left of the position
        if (vars.actionAmountWithFees > vars.totalTopUpAmount) {
            vars.actionAmountWithFees = vars.totalTopUpAmount;
            vars.minActionAmountToTopUp = vars.actionAmountWithFees.scaledDiv(
                ScaledMath.ONE + vars.actionFee
            );
        }
        ILiquidityPool pool = addressProvider.getPoolForToken(position.depositToken);
        vars.underlying = pool.getUnderlying();
        vars.rate = pool.exchangeRate();

        ISwapper swapper;

        if (vars.underlying != position.actionToken) {
            swapper = _getSwapper(vars.underlying, position.actionToken);
            vars.rate = vars.rate.scaledMul(swapper.getRate(vars.underlying, position.actionToken));
        }

        // compute the deposit tokens amount with and without fees
        // we will need to unstake the amount with fees and to
        // swap the amount without fees into action tokens
        vars.depositAmountWithFees = vars.actionAmountWithFees.scaledDivRoundUp(vars.rate);
        if (position.depositTokenBalance < vars.depositAmountWithFees) {
            vars.depositAmountWithFees = position.depositTokenBalance;
            vars.minActionAmountToTopUp =
                (vars.depositAmountWithFees * vars.rate) /
                (ScaledMath.ONE + vars.actionFee);
        }

        // compute amount of LP tokens needed to pay for action
        // rate is expressed in actionToken per depositToken
        vars.depositAmountWithoutFees = vars.minActionAmountToTopUp.scaledDivRoundUp(vars.rate);
        vars.depositTotalFeesAmount = vars.depositAmountWithFees - vars.depositAmountWithoutFees;

        // will revert if vault does not exist
        address vault = addressProvider.getStakerVault(position.depositToken);

        // unstake deposit tokens including fees
        IStakerVault(vault).unstake(vars.depositAmountWithFees);
        IStakerVault(vault).decreaseActionLockedBalance(payer, vars.depositAmountWithFees);

        // swap the amount without the fees
        // as the fees are paid in deposit token, not in action token
        // Redeem first and use swapper only if the underlying tokens are not action tokens
        vars.actionTokenAmount = pool.redeem(vars.depositAmountWithoutFees);

        if (address(swapper) != address(0)) {
            vars.minActionAmountToTopUp = vars.minActionAmountToTopUp.scaledMul(
                getSwapperSlippage()
            );
            _approve(vars.underlying, address(swapper));
            vars.actionTokenAmount = swapper.swap(
                vars.underlying,
                position.actionToken,
                vars.actionTokenAmount,
                vars.minActionAmountToTopUp
            );
        }

        // compute how much of action token was actually redeemed and add fees to it
        // this is to ensure that no funds get locked inside the contract
        vars.totalActionTokenAmount =
            vars.actionTokenAmount +
            vars.depositTotalFeesAmount.scaledMul(vars.rate);

        // at this point, we have exactly `vars.actionTokenAmount`
        // (at least `position.singleTopUpAmount`) of action token
        // and exactly `vars.depositTotalFeesAmount` deposit tokens in the contract
        // solhint-disable-next-line avoid-low-level-calls
        (vars.success, vars.topupResult) = topUpHandler.delegatecall(
            abi.encodeWithSignature(
                "topUp(bytes32,address,uint256,bytes)",
                account,
                position.actionToken,
                vars.actionTokenAmount,
                position.extra
            )
        );

        require(vars.success && abi.decode(vars.topupResult, (bool)), Error.TOP_UP_FAILED);

        // totalTopUpAmount is updated to reflect the new "balance" of the position
        if (vars.totalTopUpAmount > vars.totalActionTokenAmount) {
            position.totalTopUpAmount -= uint128(vars.totalActionTokenAmount);
        } else {
            position.totalTopUpAmount = 0;
        }

        position.depositTokenBalance -= uint128(vars.depositAmountWithFees);

        vars.removePosition = position.totalTopUpAmount == 0 || position.depositTokenBalance == 0;
        _payFees(payer, beneficiary, vars.depositTotalFeesAmount, position.depositToken);
        if (vars.removePosition) {
            if (position.depositTokenBalance > 0) {
                // transfer any unused locked tokens to the payer
                IStakerVault(vault).transfer(payer, position.depositTokenBalance);
                IStakerVault(vault).decreaseActionLockedBalance(
                    payer,
                    position.depositTokenBalance
                );
            }
            _removePosition(payer, account, protocol);
        }

        emit TopUp(
            account,
            protocol,
            payer,
            position.depositToken,
            vars.depositAmountWithFees,
            position.actionToken,
            vars.actionTokenAmount
        );

        // compute gas used and reimburse the keeper by using the
        // funds of payer in the gas bank
        // TODO: add constant gas consumed for transfer and tx prologue
        vars.gasConsumed = vars.initialGas - gasleft();

        vars.reimbursedWeiForGas = vars.userGasPrice * vars.gasConsumed;
        if (vars.reimbursedWeiForGas > vars.gasBankBalance) {
            vars.reimbursedWeiForGas = vars.gasBankBalance;
        }

        // ensure that the keeper is not overpaying
        vars.requiredWeiForGas = tx.gasprice * vars.gasConsumed;
        require(
            vars.reimbursedWeiForGas + maxWeiForGas >= vars.requiredWeiForGas,
            Error.GAS_TOO_HIGH
        );
        gasBank.withdrawFrom(payer, payable(msg.sender), vars.reimbursedWeiForGas);
        if (vars.removePosition) {
            gasBank.withdrawUnused(payer);
        }

        return true;
    }

    /**
     * @notice Prepare new top up handler fee update.
     * @dev Setting the addres to 0 means that the protocol will no longer be supported.
     * @param protocol Protocol for which a new handler should be prepared.
     * @param newHandler Address of new handler.
     * @return `true` if success.
     */
    function prepareTopUpHandler(bytes32 protocol, address newHandler)
        public
        onlyGovernance
        returns (bool)
    {
        return _prepare(_getProtocolKey(protocol), newHandler);
    }

    /**
     * @notice Check if action can be executed.
     * @param protocol for which to get the health factor
     * @param account for which to get the health factor
     * @param extra data to be used by the topup handler
     * @return healthFactor of the position
     */
    function getHealthFactor(
        bytes32 protocol,
        bytes32 account,
        bytes memory extra
    ) public view override returns (uint256 healthFactor) {
        ITopUpHandler topUpHandler = ITopUpHandler(_getHandler(protocol, true));
        return topUpHandler.getUserFactor(account, extra);
    }

    function getHandler(bytes32 protocol) public view override returns (address) {
        return _getHandler(protocol, false);
    }

    /**
     * @notice returns the current estimated gas usage
     */
    function getEstimatedGasUsage() public view returns (uint256) {
        return currentUInts256[_ESTIMATED_GAS_USAGE_KEY];
    }

    /**
     * @notice Returns the current action fee
     */
    function getActionFee() public view override returns (uint256) {
        return currentUInts256[_ACTION_FEE_KEY];
    }

    /**
     * @notice Returns the current max swapper slippage
     */
    function getSwapperSlippage() public view override returns (uint256) {
        return currentUInts256[_MAX_SWAPPER_SLIPPAGE_KEY];
    }

    /**
     * @notice Returns the current fee handler
     */
    function getFeeHandler() public view override returns (address) {
        return currentAddresses[_FEE_HANDLER_KEY];
    }

    /**
     * @notice Get the record for a position.
     * @param payer Registered payer of the position.
     * @param account Address holding the position.
     * @param protocol Protocol where the position is held.
     */
    function getPosition(
        address payer,
        bytes32 account,
        bytes32 protocol
    ) public view override returns (Record memory) {
        return _positions[payer][account][protocol];
    }

    /**
     * @notice Check whether a token is usable as a deposit token.
     * @param token Address of token to check.
     * @return True if token is usable as a deposit token for this action.
     */
    function isUsable(address token) public view override returns (bool) {
        return _usableTokens.contains(token);
    }

    function _updateTopUpHandler(
        bytes32 protocol,
        address oldHandler,
        address newHandler
    ) internal {
        if (newHandler == address(0)) {
            _supportedProtocols.remove(protocol);
        } else if (oldHandler == address(0)) {
            _supportedProtocols.add(protocol);
        }
    }

    /**
     * @dev Pays fees to the feeHandler
     * @param payer The account who's position the fees are charged on
     * @param beneficiary The beneficiary of the fees paid (usually this will be the keeper)
     * @param feeAmount The amount in tokens to pay as fees
     * @param depositToken The LpToken used to pay the fees
     */
    function _payFees(
        address payer,
        address beneficiary,
        uint256 feeAmount,
        address depositToken
    ) internal {
        address feeHandler = getFeeHandler();
        IERC20(depositToken).safeApprove(feeHandler, feeAmount);
        IActionFeeHandler(feeHandler).payFees(payer, beneficiary, feeAmount, depositToken);
    }

    /**
     * @dev "Locks" an amount of tokens on behalf of the TopUpAction
     * Funds are taken from staker vault if allowance is sufficient, else direct transfer or a combination of both.
     * @param payer Owner of the funds to be locked
     * @param token Token to lock
     * @param lockAmount Minimum amount of `token` to lock
     * @param depositAmount Amount of `token` that was deposited.
     *                      If this is 0 then the staker vault allowance should be used.
     *                      If this is greater than `requiredAmount` more tokens will be locked.
     */
    function _lockFunds(
        address payer,
        address token,
        uint256 lockAmount,
        uint256 depositAmount
    ) internal {
        address stakerVaultAddress = addressProvider.getStakerVault(token);
        TopUpActionLibrary.lockFunds(stakerVaultAddress, payer, token, lockAmount, depositAmount);
    }

    function _removePosition(
        address payer,
        bytes32 account,
        bytes32 protocol
    ) internal {
        delete _positions[payer][account][protocol];
        _removeUserPosition(payer, account, protocol);
        if (_userPositions[payer].length == 0) {
            _usersWithPositions.remove(payer);
        }
        emit Deregister(payer, account, protocol);
    }

    function _removeUserPosition(
        address payer,
        bytes32 account,
        bytes32 protocol
    ) internal {
        RecordMeta[] storage positionsMeta = _userPositions[payer];
        uint256 length = positionsMeta.length;
        for (uint256 i = 0; i < length; i++) {
            RecordMeta storage positionMeta = positionsMeta[i];
            if (positionMeta.account == account && positionMeta.protocol == protocol) {
                positionsMeta[i] = positionsMeta[length - 1];
                positionsMeta.pop();
                return;
            }
        }
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

    /**
     * @dev Computes and returns the amount of LP tokens of type `token` that will be received in exchange for an `amount` of the underlying.
     */
    function _calcExchangeAmount(
        address token,
        address actionToken,
        uint256 amount
    ) internal view returns (uint256) {
        return TopUpActionLibrary.calcExchangeAmount(addressProvider, token, actionToken, amount);
    }

    function _getSwapper(address underlying, address actionToken) internal view returns (ISwapper) {
        return TopUpActionLibrary.getSwapper(addressProvider, underlying, actionToken);
    }

    function _getHandler(bytes32 protocol, bool ensureExists) internal view returns (address) {
        address handler = currentAddresses[_getProtocolKey(protocol)];
        require(!ensureExists || handler != address(0), Error.PROTOCOL_NOT_FOUND);
        return handler;
    }

    function _isSwappable(address depositToken, address toToken) internal view returns (bool) {
        ILiquidityPool pool = addressProvider.getPoolForToken(depositToken);
        address underlying = pool.getUnderlying();
        if (underlying == toToken) {
            return true;
        }
        address swapperRegistry = addressProvider.getSwapperRegistry();
        return ISwapperRegistry(swapperRegistry).swapperExists(underlying, toToken);
    }

    function _getProtocolKey(bytes32 protocol) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(_TOP_UP_HANDLER_KEY, protocol));
    }
}
