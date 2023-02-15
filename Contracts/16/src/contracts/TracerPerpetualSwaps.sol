// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.0;

import "./lib/SafetyWithdraw.sol";
import "./lib/LibMath.sol";
import {Balances} from "./lib/LibBalances.sol";
import {Types} from "./Interfaces/Types.sol";
import "./lib/LibPrices.sol";
import "./lib/LibPerpetuals.sol";
import "./Interfaces/IOracle.sol";
import "./Interfaces/IInsurance.sol";
import "./Interfaces/ITracerPerpetualSwaps.sol";
import "./Interfaces/IPricing.sol";
import "./Interfaces/ITrader.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "prb-math/contracts/PRBMathSD59x18.sol";
import "prb-math/contracts/PRBMathUD60x18.sol";

contract TracerPerpetualSwaps is ITracerPerpetualSwaps, Ownable, SafetyWithdraw {
    using LibMath for uint256;
    using LibMath for int256;
    using PRBMathSD59x18 for int256;
    using PRBMathUD60x18 for uint256;

    uint256 public constant override LIQUIDATION_GAS_COST = 63516;
    address public immutable override tracerQuoteToken;
    uint256 public immutable override quoteTokenDecimals;
    bytes32 public immutable override marketId;
    IPricing public pricingContract;
    IInsurance public insuranceContract;
    address public override liquidationContract;
    uint256 public override feeRate;
    uint256 public override fees;
    address public override feeReceiver;

    /* Config variables */
    // The price of gas in gwei
    address public override gasPriceOracle;
    // The maximum ratio of notionalValue to margin
    uint256 public override maxLeverage;
    // WAD value. sensitivity of 1 = 1*10^18
    uint256 public override fundingRateSensitivity;
    // WAD value. The percentage for insurance pool holdings/pool target where deleveraging begins
    uint256 public override deleveragingCliff;
    /* The percentage of insurance holdings to target at which the insurance pool
       funding rate changes, and lowestMaxLeverage is reached */
    uint256 public override insurancePoolSwitchStage;
    // The lowest value that maxLeverage can be, if insurance pool is empty.
    uint256 public override lowestMaxLeverage;

    // Account State Variables
    mapping(address => Balances.Account) public balances;
    uint256 public tvl;
    uint256 public override leveragedNotionalValue;

    // Trading interfaces whitelist
    mapping(address => bool) public override tradingWhitelist;

    event FeeReceiverUpdated(address indexed receiver);
    event FeeWithdrawn(address indexed receiver, uint256 feeAmount);
    event Deposit(address indexed user, uint256 indexed amount);
    event Withdraw(address indexed user, uint256 indexed amount);
    event Settled(address indexed account, int256 margin);
    event MatchedOrders(
        address indexed long,
        address indexed short,
        uint256 amount,
        uint256 price,
        bytes32 longOrderId,
        bytes32 shortOrderId
    );
    event FailedOrders(address indexed long, address indexed short, bytes32 longOrderId, bytes32 shortOrderId);

    /**
     * @notice Creates a new tracer market and sets the initial funding rate of the market. Anyone
     *         will be able to purchase and trade tracers after this deployment.
     * @param _marketId the id of the market, given as BASE/QUOTE
     * @param _tracerQuoteToken the address of the token used for margin accounts (i.e. The margin token)
     * @param _tokenDecimals the number of decimal places the quote token supports
     * @param _gasPriceOracle the address of the contract implementing gas price oracle
     * @param _maxLeverage the max leverage of the market represented as a WAD value.
     * @param _fundingRateSensitivity the affect funding rate changes have on funding paid; u60.18-decimal fixed-point number (WAD value)
     * @param _feeRate the fee taken on trades; WAD value. e.g. 2% fee = 0.02 * 10^18 = 2 * 10^16
     * @param _feeReceiver the address of the person who can withdraw the fees from trades in this market
     * @param _deleveragingCliff The percentage for insurance pool holdings/pool target where deleveraging begins.
     *                           WAD value. e.g. 20% = 20*10^18
     * @param _lowestMaxLeverage The lowest value that maxLeverage can be, if insurance pool is empty.
     * @param _insurancePoolSwitchStage The percentage of insurance holdings to target at which the insurance pool
     *                                  funding rate changes, and lowestMaxLeverage is reached
     */
    constructor(
        bytes32 _marketId,
        address _tracerQuoteToken,
        uint256 _tokenDecimals,
        address _gasPriceOracle,
        uint256 _maxLeverage,
        uint256 _fundingRateSensitivity,
        uint256 _feeRate,
        address _feeReceiver,
        uint256 _deleveragingCliff,
        uint256 _lowestMaxLeverage,
        uint256 _insurancePoolSwitchStage
    ) Ownable() {
        // don't convert to interface as we don't need to interact with the contract
        tracerQuoteToken = _tracerQuoteToken;
        quoteTokenDecimals = _tokenDecimals;
        gasPriceOracle = _gasPriceOracle;
        marketId = _marketId;
        feeRate = _feeRate;
        maxLeverage = _maxLeverage;
        fundingRateSensitivity = _fundingRateSensitivity;
        feeReceiver = _feeReceiver;
        deleveragingCliff = _deleveragingCliff;
        lowestMaxLeverage = _lowestMaxLeverage;
        insurancePoolSwitchStage = _insurancePoolSwitchStage;
    }

    /**
     * @notice Adjust the max leverage as insurance pool slides from 100% of target to 0% of target
     */
    function trueMaxLeverage() public view override returns (uint256) {
        IInsurance insurance = IInsurance(insuranceContract);

        return
            Perpetuals.calculateTrueMaxLeverage(
                insurance.getPoolHoldings(),
                insurance.getPoolTarget(),
                maxLeverage,
                lowestMaxLeverage,
                deleveragingCliff,
                insurancePoolSwitchStage
            );
    }

    /**
     * @notice Allows a user to deposit into their margin account
     * @dev this contract must be an approved spender of the markets quote token on behalf of the depositer.
     * @param amount The amount of quote tokens to be deposited into the Tracer Market account. This amount
     * should be given in WAD format.
     */
    function deposit(uint256 amount) external override {
        Balances.Account storage userBalance = balances[msg.sender];
        // settle outstanding payments
        settle(msg.sender);

        // convert the WAD amount to the correct token amount to transfer
        // cast is safe since amount is a uint, and wadToToken can only
        // scale down the value
        uint256 rawTokenAmount = uint256(Balances.wadToToken(quoteTokenDecimals, amount).toInt256());
        IERC20(tracerQuoteToken).transferFrom(msg.sender, address(this), rawTokenAmount);

        // this prevents dust from being added to the user account
        // eg 10^18 -> 10^8 -> 10^18 will remove lower order bits
        int256 convertedWadAmount = Balances.tokenToWad(quoteTokenDecimals, rawTokenAmount);

        // update user state
        userBalance.position.quote = userBalance.position.quote + convertedWadAmount;
        _updateAccountLeverage(msg.sender);

        // update market TVL
        tvl = tvl + uint256(convertedWadAmount);
        emit Deposit(msg.sender, amount);
    }

    /**
     * @notice Allows a user to withdraw from their margin account
     * @dev Ensures that the users margin percent is valid after withdraw
     * @param amount The amount of margin tokens to be withdrawn from the tracer market account. This amount
     * should be given in WAD format
     */
    function withdraw(uint256 amount) external override {
        // settle outstanding payments
        settle(msg.sender);

        uint256 rawTokenAmount = Balances.wadToToken(quoteTokenDecimals, amount);
        int256 convertedWadAmount = Balances.tokenToWad(quoteTokenDecimals, rawTokenAmount);

        Balances.Account storage userBalance = balances[msg.sender];
        int256 newQuote = userBalance.position.quote - convertedWadAmount;

        // this may be able to be optimised
        Balances.Position memory newPosition = Balances.Position(newQuote, userBalance.position.base);

        require(
            Balances.marginIsValid(
                newPosition,
                userBalance.lastUpdatedGasPrice * LIQUIDATION_GAS_COST,
                pricingContract.fairPrice(),
                trueMaxLeverage()
            ),
            "TCR: Withdraw below valid Margin"
        );

        // update user state
        userBalance.position.quote = newQuote;
        _updateAccountLeverage(msg.sender);

        // Safemath will throw if tvl < amount
        tvl = tvl - amount;

        // perform transfer
        IERC20(tracerQuoteToken).transfer(msg.sender, rawTokenAmount);
        emit Withdraw(msg.sender, uint256(convertedWadAmount));
    }

    /**
     * @notice Attempt to match two orders that exist on-chain against each other
     * @dev Emits a FailedOrders or MatchedOrders event based on whether the
     *      orders were successfully able to be matched
     * @param order1 The first order
     * @param order2 The second order
     * @param fillAmount Amount that the two orders are being filled for
     * @return Whether the two orders were able to be matched successfully
     */
    function matchOrders(
        Perpetuals.Order memory order1,
        Perpetuals.Order memory order2,
        uint256 fillAmount
    ) external override onlyWhitelisted returns (bool) {
        bytes32 order1Id = Perpetuals.orderId(order1);
        bytes32 order2Id = Perpetuals.orderId(order2);
        uint256 filled1 = ITrader(msg.sender).filled(order1Id);
        uint256 filled2 = ITrader(msg.sender).filled(order2Id);

        uint256 executionPrice = Perpetuals.getExecutionPrice(order1, order2);

        // settle accounts
        // note: this can revert and hence no order events will be emitted
        settle(order1.maker);
        settle(order2.maker);

        (Balances.Position memory newPos1, Balances.Position memory newPos2) = _executeTrade(
            order1,
            order2,
            fillAmount,
            executionPrice
        );
        // validate orders can match, and outcome state is valid
        if (
            !Perpetuals.canMatch(order1, filled1, order2, filled2) ||
            !Balances.marginIsValid(
                newPos1,
                balances[order1.maker].lastUpdatedGasPrice * LIQUIDATION_GAS_COST,
                pricingContract.fairPrice(),
                trueMaxLeverage()
            ) ||
            !Balances.marginIsValid(
                newPos2,
                balances[order2.maker].lastUpdatedGasPrice * LIQUIDATION_GAS_COST,
                pricingContract.fairPrice(),
                trueMaxLeverage()
            )
        ) {
            // emit failed to match event and return false
            if (order1.side == Perpetuals.Side.Long) {
                emit FailedOrders(order1.maker, order2.maker, order1Id, order2Id);
            } else {
                emit FailedOrders(order2.maker, order1.maker, order2Id, order1Id);
            }
            return false;
        }

        // update account states
        balances[order1.maker].position = newPos1;
        balances[order2.maker].position = newPos2;

        // update fees
        fees =
            fees +
            // add 2 * fees since getFeeRate returns the fee rate for a single
            // side of the order. Both users were charged fees
            uint256(Balances.getFee(fillAmount, executionPrice, feeRate) * 2);

        // update leverage
        _updateAccountLeverage(order1.maker);
        _updateAccountLeverage(order2.maker);

        // Update internal trade state
        pricingContract.recordTrade(executionPrice);

        if (order1.side == Perpetuals.Side.Long) {
            emit MatchedOrders(order1.maker, order2.maker, fillAmount, executionPrice, order1Id, order2Id);
        } else {
            emit MatchedOrders(order2.maker, order1.maker, fillAmount, executionPrice, order2Id, order1Id);
        }
        return true;
    }

    /**
     * @notice Updates account states of two accounts given two orders that are being executed
     * @param order1 The first order
     * @param order2 The second order
     * @param fillAmount The amount that the two ordered are being filled for
     * @param executionPrice The execution price of the trades
     * @return The new balances of the two accounts after the trade
     */
    function _executeTrade(
        Perpetuals.Order memory order1,
        Perpetuals.Order memory order2,
        uint256 fillAmount,
        uint256 executionPrice
    ) internal view returns (Balances.Position memory, Balances.Position memory) {
        // Retrieve account state
        Balances.Account memory account1 = balances[order1.maker];
        Balances.Account memory account2 = balances[order2.maker];

        // Construct `Trade` types suitable for use with LibBalances
        (Balances.Trade memory trade1, Balances.Trade memory trade2) = (
            Balances.Trade(executionPrice, fillAmount, order1.side),
            Balances.Trade(executionPrice, fillAmount, order2.side)
        );

        // Calculate new account state
        (Balances.Position memory newPos1, Balances.Position memory newPos2) = (
            Balances.applyTrade(account1.position, trade1, feeRate),
            Balances.applyTrade(account2.position, trade2, feeRate)
        );

        // return new account state
        return (newPos1, newPos2);
    }

    /**
     * @notice internal function for updating leverage. Called within the Account contract. Also
     *         updates the total leveraged notional value for the tracer market itself.
     */
    function _updateAccountLeverage(address account) internal {
        Balances.Account memory userBalance = balances[account];
        uint256 originalLeverage = userBalance.totalLeveragedValue;
        uint256 newLeverage = Balances.leveragedNotionalValue(userBalance.position, pricingContract.fairPrice());
        balances[account].totalLeveragedValue = newLeverage;

        // Update market leveraged notional value
        _updateTracerLeverage(newLeverage, originalLeverage);
    }

    /**
     * @notice Updates the global leverage value given an accounts new leveraged value and old leveraged value
     * @param accountNewLeveragedNotional The future notional value of the account
     * @param accountOldLeveragedNotional The stored notional value of the account
     */
    function _updateTracerLeverage(uint256 accountNewLeveragedNotional, uint256 accountOldLeveragedNotional) internal {
        leveragedNotionalValue = Prices.globalLeverage(
            leveragedNotionalValue,
            accountOldLeveragedNotional,
            accountNewLeveragedNotional
        );
    }

    /**
     * @notice When a liquidation occurs, Liquidation.sol needs to push this contract to update
     *         account states as necessary.
     * @param liquidator Address of the account that called liquidate(...)
     * @param liquidatee Address of the under-margined account getting liquidated
     * @param liquidatorQuoteChange Amount the liquidator's quote is changing
     * @param liquidatorBaseChange Amount the liquidator's base is changing
     * @param liquidateeQuoteChange Amount the liquidated account's quote is changing
     * @param liquidateeBaseChange Amount the liquidated account's base is changing
     * @param amountToEscrow The amount the liquidator has to put into escrow
     */
    function updateAccountsOnLiquidation(
        address liquidator,
        address liquidatee,
        int256 liquidatorQuoteChange,
        int256 liquidatorBaseChange,
        int256 liquidateeQuoteChange,
        int256 liquidateeBaseChange,
        uint256 amountToEscrow
    ) external override onlyLiquidation {
        // Limits the gas use when liquidating
        uint256 gasPrice = IOracle(gasPriceOracle).latestAnswer();
        // Update liquidators last updated gas price
        Balances.Account storage liquidatorBalance = balances[liquidator];
        Balances.Account storage liquidateeBalance = balances[liquidatee];

        // update liquidators balance
        liquidatorBalance.lastUpdatedGasPrice = gasPrice;
        liquidatorBalance.position.quote =
            liquidatorBalance.position.quote +
            liquidatorQuoteChange -
            amountToEscrow.toInt256();
        liquidatorBalance.position.base = liquidatorBalance.position.base + liquidatorBaseChange;

        // update liquidatee balance
        liquidateeBalance.position.quote = liquidateeBalance.position.quote + liquidateeQuoteChange;
        liquidateeBalance.position.base = liquidateeBalance.position.base + liquidateeBaseChange;

        // Checks if the liquidator is in a valid position to process the liquidation
        require(userMarginIsValid(liquidator), "TCR: Liquidator under min margin");
    }

    /**
     * @notice When a liquidation receipt is claimed by the liquidator (i.e. they experienced slippage),
               Liquidation.sol needs to tell the market to update its balance and the balance of the
               liquidated agent.
     * @dev Gives the leftover amount from the receipt to the liquidated agent
     * @param claimant The liquidator, who has experienced slippage selling the liquidated position
     * @param amountToGiveToClaimant The amount the liquidator is owe based off slippage
     * @param liquidatee The account that originally got liquidated
     * @param amountToGiveToLiquidatee Amount owed to the liquidated account
     * @param amountToTakeFromInsurance Amount that needs to be taken from the insurance pool
                                        in order to cover liquidation
     */
    function updateAccountsOnClaim(
        address claimant,
        int256 amountToGiveToClaimant,
        address liquidatee,
        int256 amountToGiveToLiquidatee,
        int256 amountToTakeFromInsurance
    ) external override onlyLiquidation {
        address insuranceAddr = address(insuranceContract);
        balances[insuranceAddr].position.quote = balances[insuranceAddr].position.quote - amountToTakeFromInsurance;
        balances[claimant].position.quote = balances[claimant].position.quote + amountToGiveToClaimant;
        balances[liquidatee].position.quote = balances[liquidatee].position.quote + amountToGiveToLiquidatee;
        require(balances[insuranceAddr].position.quote >= 0, "TCR: Insurance not funded enough");
    }

    /**
     * @notice settles an account. Compares current global rate with the users last updated rate
     *         Updates the accounts margin balance accordingly.
     * @dev Ensures the account remains in a valid margin position. Will throw if account is under margin
     *      and the account must then be liquidated.
     * @param account the address to settle.
     * @dev This function aggregates data to feed into account.sols settle function which sets
     */
    function settle(address account) public override {
        // Get account and global last updated indexes
        uint256 accountLastUpdatedIndex = balances[account].lastUpdatedIndex;
        uint256 currentGlobalFundingIndex = pricingContract.currentFundingIndex();
        Balances.Account storage accountBalance = balances[account];

        // if this user has no positions, bring them in sync
        if (accountBalance.position.base == 0) {
            // set to the last fully established index
            accountBalance.lastUpdatedIndex = currentGlobalFundingIndex;
            accountBalance.lastUpdatedGasPrice = IOracle(gasPriceOracle).latestAnswer();
        } else if (accountLastUpdatedIndex + 1 < currentGlobalFundingIndex) {
            // Only settle account if its last updated index was before the last established
            // global index this is since we reference the last global index
            // Get current and global funding statuses
            uint256 lastEstablishedIndex = currentGlobalFundingIndex - 1;
            // Note: global rates reference the last fully established rate (hence the -1), and not
            // the current global rate. User rates reference the last saved user rate
            Prices.FundingRateInstant memory currGlobalRate = pricingContract.getFundingRate(lastEstablishedIndex);
            Prices.FundingRateInstant memory currUserRate = pricingContract.getFundingRate(accountLastUpdatedIndex);

            Prices.FundingRateInstant memory currInsuranceGlobalRate = pricingContract.getInsuranceFundingRate(
                lastEstablishedIndex
            );

            Prices.FundingRateInstant memory currInsuranceUserRate = pricingContract.getInsuranceFundingRate(
                accountLastUpdatedIndex
            );

            // settle the account
            Balances.Account storage insuranceBalance = balances[address(insuranceContract)];

            accountBalance.position = Prices.applyFunding(accountBalance.position, currGlobalRate, currUserRate);

            // Update account gas price
            accountBalance.lastUpdatedGasPrice = IOracle(gasPriceOracle).latestAnswer();

            if (accountBalance.totalLeveragedValue > 0) {
                (Balances.Position memory newUserPos, Balances.Position memory newInsurancePos) = Prices.applyInsurance(
                    accountBalance.position,
                    insuranceBalance.position,
                    currInsuranceGlobalRate,
                    currInsuranceUserRate,
                    accountBalance.totalLeveragedValue
                );

                balances[account].position = newUserPos;
                balances[(address(insuranceContract))].position = newInsurancePos;
            }

            // Update account index
            accountBalance.lastUpdatedIndex = lastEstablishedIndex;
            require(userMarginIsValid(account), "TCR: Target under-margined");
            emit Settled(account, accountBalance.position.quote);
        }
    }

    /**
     * @notice Checks if a given accounts margin is valid
     * @param account The address of the account whose margin is to be checked
     * @return true if the margin is valid or false otherwise
     */
    function userMarginIsValid(address account) public view returns (bool) {
        Balances.Account memory accountBalance = balances[account];
        return
            Balances.marginIsValid(
                accountBalance.position,
                accountBalance.lastUpdatedGasPrice * LIQUIDATION_GAS_COST,
                pricingContract.fairPrice(),
                trueMaxLeverage()
            );
    }

    /**
     * @notice Withdraws the fees taken on trades, and sends them to the designated
     *         fee receiver (set by the owner of the market)
     * @dev Anyone can call this function, but fees are transferred to the fee receiver.
     *      Fees is also subtracted from the total value locked in the market because
     *      fees are taken out of trades that result in users' quotes being modified, and
     *      don't otherwise get subtracted from the tvl of the market
     */
    function withdrawFees() external override {
        uint256 tempFees = fees;
        fees = 0;
        tvl = tvl - tempFees;

        // Withdraw from the account
        IERC20(tracerQuoteToken).transfer(feeReceiver, tempFees);
        emit FeeWithdrawn(feeReceiver, tempFees);
    }

    function getBalance(address account) external view override returns (Balances.Account memory) {
        return balances[account];
    }

    function setLiquidationContract(address _liquidationContract) external override onlyOwner {
        require(_liquidationContract != address(0), "address(0) given");
        liquidationContract = _liquidationContract;
    }

    function setInsuranceContract(address insurance) external override onlyOwner {
        require(insurance != address(0), "address(0) given");
        insuranceContract = IInsurance(insurance);
    }

    function setPricingContract(address pricing) external override onlyOwner {
        require(pricing != address(0), "address(0) given");
        pricingContract = IPricing(pricing);
    }

    function setGasOracle(address _gasOracle) external override onlyOwner {
        require(_gasOracle != address(0), "address(0) given");
        gasPriceOracle = _gasOracle;
    }

    function setFeeReceiver(address _feeReceiver) external override onlyOwner {
        require(_feeReceiver != address(0), "address(0) given");
        feeReceiver = _feeReceiver;
        emit FeeReceiverUpdated(_feeReceiver);
    }

    function setFeeRate(uint256 _feeRate) external override onlyOwner {
        feeRate = _feeRate;
    }

    function setMaxLeverage(uint256 _maxLeverage) external override onlyOwner {
        maxLeverage = _maxLeverage;
    }

    function setFundingRateSensitivity(uint256 _fundingRateSensitivity) external override onlyOwner {
        fundingRateSensitivity = _fundingRateSensitivity;
    }

    function setDeleveragingCliff(uint256 _deleveragingCliff) external override onlyOwner {
        deleveragingCliff = _deleveragingCliff;
    }

    function setLowestMaxLeverage(uint256 _lowestMaxLeverage) external override onlyOwner {
        lowestMaxLeverage = _lowestMaxLeverage;
    }

    function setInsurancePoolSwitchStage(uint256 _insurancePoolSwitchStage) external override onlyOwner {
        insurancePoolSwitchStage = _insurancePoolSwitchStage;
    }

    function transferOwnership(address newOwner) public override(Ownable, ITracerPerpetualSwaps) onlyOwner {
        require(newOwner != address(0), "address(0) given");
        super.transferOwnership(newOwner);
    }

    /**
     * @notice allows the owner of a market to set the whitelisting of a trading interface address
     * @dev a permissioned interface may call the matchOrders function.
     * @param tradingContract the contract to have its whitelisting permissions set
     * @param whitelisted the permission of the contract. If true this contract make call makeOrder
     */
    function setWhitelist(address tradingContract, bool whitelisted) external onlyOwner {
        tradingWhitelist[tradingContract] = whitelisted;
    }

    // Modifier such that only the set liquidation contract can call a function
    modifier onlyLiquidation() {
        require(msg.sender == liquidationContract, "TCR: Sender not liquidation");
        _;
    }

    // Modifier such that only a whitelisted trader can call a function
    modifier onlyWhitelisted() {
        require(tradingWhitelist[msg.sender], "TCR: Contract not whitelisted");
        _;
    }
}
