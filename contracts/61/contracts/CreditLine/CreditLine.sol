// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import '@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol';
import '../interfaces/IPriceOracle.sol';
import '../interfaces/IYield.sol';
import '../interfaces/ISavingsAccount.sol';
import '../SavingsAccount/SavingsAccountUtil.sol';
import '../interfaces/IStrategyRegistry.sol';

/**
 * @title Credit Line contract with Methods related to credit Line
 * @notice Implements the functions related to Credit Line
 * @author Sublime
 **/

contract CreditLine is ReentrancyGuard, OwnableUpgradeable {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    enum CreditLineStatus {
        NOT_CREATED,
        REQUESTED,
        ACTIVE,
        CLOSED,
        CANCELLED,
        LIQUIDATED
    }

    /**
     * @notice counter that tracks the number of credit lines created
     * @dev used to create unique identifier for credit lines
     **/
    uint256 public creditLineCounter;

    uint256 constant YEAR_IN_SECONDS = 365 days;

    struct CreditLineVariables {
        CreditLineStatus status;
        uint256 principal;
        uint256 totalInterestRepaid;
        uint256 lastPrincipalUpdateTime;
        uint256 interestAccruedTillLastPrincipalUpdate;
    }

    struct CreditLineConstants {
        address lender;
        address borrower;
        uint256 borrowLimit;
        uint256 idealCollateralRatio;
        uint256 borrowRate;
        address borrowAsset;
        address collateralAsset;
        bool autoLiquidation;
        bool requestByLender;
    }
    /**
     * @notice stores the collateral shares in a credit line per strategy
     * @dev creditLineId => Strategy => collateralShares
     **/
    mapping(uint256 => mapping(address => uint256)) public collateralShareInStrategy;

    /**
     * @notice stores the variables to maintain a credit line
     **/
    mapping(uint256 => CreditLineVariables) public creditLineVariables;

    /**
     * @notice stores the constants related to a credit line
     **/
    mapping(uint256 => CreditLineConstants) public creditLineConstants;

    /**
     * @notice stores the address of savings account contract
     **/
    address public savingsAccount;

    /**
     * @notice stores the address of price oracle contract
     **/
    address public priceOracle;

    /**
     * @notice stores the address of strategy registry contract
     **/
    address public strategyRegistry;

    /**
     * @notice stores the address of default strategy
     **/
    address public defaultStrategy;

    /**
     * @notice stores the fraction of borrowed amount charged as fee by protocol
     * @dev it is multiplied by 10**30
     **/
    uint256 public protocolFeeFraction;

    /**
     * @notice address where protocol fee is collected
     **/
    address public protocolFeeCollector;

    /**
     * @notice stores the fraction of amount liquidated given as reward to liquidator
     * @dev it is multiplied by 10**30
     **/
    uint256 public liquidatorRewardFraction;
    /**
     * @dev checks if Credit Line exists
     * @param _id identifier for the credit line
     **/
    modifier ifCreditLineExists(uint256 _id) {
        require(creditLineVariables[_id].status != CreditLineStatus.NOT_CREATED, 'Credit line does not exist');
        _;
    }

    /**
     * @dev checks if called by credit Line Borrower
     * @param _id creditLine identifier
     **/
    modifier onlyCreditLineBorrower(uint256 _id) {
        require(creditLineConstants[_id].borrower == msg.sender, 'Only credit line Borrower can access');
        _;
    }

    /**
     * @dev checks if called by credit Line Lender
     * @param _id creditLine identifier
     **/
    modifier onlyCreditLineLender(uint256 _id) {
        require(creditLineConstants[_id].lender == msg.sender, 'Only credit line Lender can access');
        _;
    }

    /**
     * @notice emitted when a collateral is deposited into credit line
     * @param id id of the credit line
     * @param amount amount of collateral deposited
     * @param strategy address of the strategy into which collateral is deposited
     */
    event CollateralDeposited(uint256 indexed id, uint256 amount, address indexed strategy);

    /**
     * @notice emitted when collateral is withdrawn from credit line
     * @param id id of the credit line
     * @param amount amount of collateral withdrawn
     */
    event CollateralWithdrawn(uint256 indexed id, uint256 amount);

    /**
     * @notice emitted when a request for new credit line is placed
     * @param id id of the credit line for which request was made
     * @param lender address of the lender for credit line
     * @param borrower address of the borrower for credit line
     */
    event CreditLineRequested(uint256 indexed id, address indexed lender, address indexed borrower);

    /**
     * @notice emitted when a credit line is liquidated
     * @param id id of the credit line which is liquidated
     * @param liquidator address of the liquidator
     */
    event CreditLineLiquidated(uint256 indexed id, address indexed liquidator);

    /**
     * @notice emitted when tokens are borrowed from credit line
     * @param id id of the credit line from which tokens are borrowed
     * @param borrowAmount amount of tokens borrowed
     */
    event BorrowedFromCreditLine(uint256 indexed id, uint256 borrowAmount);

    /**
     * @notice emitted when credit line is accepted
     * @param id id of the credit line that was accepted
     */
    event CreditLineAccepted(uint256 indexed id);

    /**
     * @notice emitted when credit line is completely repaid and reset
     * @param id id of the credit line that is reset
     */
    event CreditLineReset(uint256 indexed id);

    /**
     * @notice emitted when the credit line is partially repaid
     * @param id id of the credit line
     * @param repayAmount amount repaid
     */
    event PartialCreditLineRepaid(uint256 indexed id, uint256 repayAmount);

    /**
     * @notice emitted when the credit line is completely repaid
     * @param id id of the credit line
     * @param repayAmount amount repaid
     */
    event CompleteCreditLineRepaid(uint256 indexed id, uint256 repayAmount);

    /**
     * @notice emitted when the credit line is closed by one of the parties of credit line
     * @param id id of the credit line
     */
    event CreditLineClosed(uint256 indexed id);

    /**
     * @notice emitted when default strategy for the credit line is updated
     * @param defaultStrategy address of the strategy contract that is used as default by credit lines
     */
    event DefaultStrategyUpdated(address indexed defaultStrategy);

    /**
     * @notice emitted when the price oracle is updated
     * @param priceOracle address of the updated price oracle
     */
    event PriceOracleUpdated(address indexed priceOracle);

    /**
     * @notice emitted when the savings account address is updated
     * @param savingsAccount address of the updated savingsAccount
     */
    event SavingsAccountUpdated(address indexed savingsAccount);

    /**
     * @notice emitted when strategy registry address is updated
     * @param strategyRegistry address of the updated strategy registry
     */
    event StrategyRegistryUpdated(address indexed strategyRegistry);

    /**
     * @notice emitted when fee that protocol charges for credit line is updated
     * @param updatedProtocolFee updated value of protocolFeeFraction
     */
    event ProtocolFeeFractionUpdated(uint256 updatedProtocolFee);

    /**
     * @notice emitted when address which receives fee that protocol changes for pools is updated
     * @param updatedProtocolFeeCollector updated value of protocolFeeCollector
     */
    event ProtocolFeeCollectorUpdated(address indexed updatedProtocolFeeCollector);

    /**
     * @notice emitted when liquidatorRewardFraction is updated
     * @param liquidatorRewardFraction fraction of the liquidated amount given as reward to the liquidator
     */
    event LiquidationRewardFractionUpdated(uint256 liquidatorRewardFraction);

    /**
     * @notice used to initialize the contract
     * @dev can only be called once during the life cycle of the contract
     * @param _defaultStrategy default strategy used in credit lines
     * @param _priceOracle address of the priceOracle
     * @param _savingsAccount address of  the savings account contract
     * @param _strategyRegistry address of the strategy registry contract
     * @param _owner address of owner who can change global variables
     * @param _protocolFeeFraction fraction of the fee charged by protocol
     * @param _protocolFeeCollector address to which protocol fee is charged to
     * @param _liquidatorRewardFraction fraction of the liquidated amount given as reward to the liquidator
     */
    function initialize(
        address _defaultStrategy,
        address _priceOracle,
        address _savingsAccount,
        address _strategyRegistry,
        address _owner,
        uint256 _protocolFeeFraction,
        address _protocolFeeCollector,
        uint256 _liquidatorRewardFraction
    ) external initializer {
        OwnableUpgradeable.__Ownable_init();
        OwnableUpgradeable.transferOwnership(_owner);

        _updateDefaultStrategy(_defaultStrategy);
        _updatePriceOracle(_priceOracle);
        _updateSavingsAccount(_savingsAccount);
        _updateStrategyRegistry(_strategyRegistry);
        _updateProtocolFeeFraction(_protocolFeeFraction);
        _updateProtocolFeeCollector(_protocolFeeCollector);
        _updateLiquidatorRewardFraction(_liquidatorRewardFraction);
    }

    /**
     * @notice used to update the default strategy
     * @dev can only be updated by owner
     * @param _defaultStrategy address of the updated default strategy
     */
    function updateDefaultStrategy(address _defaultStrategy) external onlyOwner {
        _updateDefaultStrategy(_defaultStrategy);
    }

    function _updateDefaultStrategy(address _defaultStrategy) internal {
        defaultStrategy = _defaultStrategy;
        emit DefaultStrategyUpdated(_defaultStrategy);
    }

    /**
     * @notice used to update the price oracle
     * @dev can only be updated by owner
     * @param _priceOracle address of the updated price oracle
     */
    function updatePriceOracle(address _priceOracle) external onlyOwner {
        _updatePriceOracle(_priceOracle);
    }

    function _updatePriceOracle(address _priceOracle) internal {
        priceOracle = _priceOracle;
        emit PriceOracleUpdated(_priceOracle);
    }

    /**
     * @notice used to update the savings account address
     * @dev can only be updated by owner
     * @param _savingsAccount address of the updated savings account
     */
    function updateSavingsAccount(address _savingsAccount) external onlyOwner {
        _updateSavingsAccount(_savingsAccount);
    }

    function _updateSavingsAccount(address _savingsAccount) internal {
        savingsAccount = _savingsAccount;
        emit SavingsAccountUpdated(_savingsAccount);
    }

    /**
     * @notice used to update the protocol fee fraction
     * @dev can only be updated by owner
     * @param _protocolFee fraction of the borrower amount collected as protocol fee
     */
    function updateProtocolFeeFraction(uint256 _protocolFee) external onlyOwner {
        _updateProtocolFeeFraction(_protocolFee);
    }

    function _updateProtocolFeeFraction(uint256 _protocolFee) internal {
        protocolFeeFraction = _protocolFee;
        emit ProtocolFeeFractionUpdated(_protocolFee);
    }

    /**
     * @notice used to update the protocol fee collector
     * @dev can only be updated by owner
     * @param _protocolFeeCollector address in which protocol fee is collected
     */
    function updateProtocolFeeCollector(address _protocolFeeCollector) external onlyOwner {
        _updateProtocolFeeCollector(_protocolFeeCollector);
    }

    function _updateProtocolFeeCollector(address _protocolFeeCollector) internal {
        require(_protocolFeeCollector != address(0), 'cant be 0 address');
        protocolFeeCollector = _protocolFeeCollector;
        emit ProtocolFeeCollectorUpdated(_protocolFeeCollector);
    }

    /**
     * @notice used to update the strategy registry address
     * @dev can only be updated by owner
     * @param _strategyRegistry address of the updated strategy registry
     */
    function updateStrategyRegistry(address _strategyRegistry) external onlyOwner {
        _updateStrategyRegistry(_strategyRegistry);
    }

    function _updateStrategyRegistry(address _strategyRegistry) internal {
        require(_strategyRegistry != address(0), 'CL::I zero address');
        strategyRegistry = _strategyRegistry;
        emit StrategyRegistryUpdated(_strategyRegistry);
    }

    /**
     * @notice used to update the liquidatorRewardFraction
     * @dev can only be updated by owner
     * @param _rewardFraction fraction of liquidated amount given to liquidator as reward
     */
    function updateLiquidatorRewardFraction(uint256 _rewardFraction) external onlyOwner {
        _updateLiquidatorRewardFraction(_rewardFraction);
    }

    function _updateLiquidatorRewardFraction(uint256 _rewardFraction) internal {
        require(_rewardFraction <= 10**30, 'Fraction has to be less than 1');
        liquidatorRewardFraction = _rewardFraction;
        emit LiquidationRewardFractionUpdated(_rewardFraction);
    }

    /**
     * @dev Used to Calculate Interest Per second on given principal and Interest rate
     * @param _principal principal Amount for which interest has to be calculated.
     * @param _borrowRate It is the Interest Rate at which Credit Line is approved
     * @return interest per second for the given parameters
     */
    function calculateInterest(
        uint256 _principal,
        uint256 _borrowRate,
        uint256 _timeElapsed
    ) public pure returns (uint256) {
        uint256 _interest = _principal.mul(_borrowRate).mul(_timeElapsed).div(10**30).div(YEAR_IN_SECONDS);

        return _interest;
    }

    /**
     * @dev Used to calculate interest accrued since last repayment
     * @param _id identifier for the credit line
     * @return interest accrued over current borrowed amount since last repayment
     */

    function calculateInterestAccrued(uint256 _id) public view returns (uint256) {
        uint256 _lastPrincipalUpdateTime = creditLineVariables[_id].lastPrincipalUpdateTime;
        if (_lastPrincipalUpdateTime == 0) return 0;
        uint256 _timeElapsed = (block.timestamp).sub(_lastPrincipalUpdateTime);
        uint256 _interestAccrued = calculateInterest(creditLineVariables[_id].principal, creditLineConstants[_id].borrowRate, _timeElapsed);
        return _interestAccrued;
    }

    /**
     * @dev Used to calculate current debt of borrower against a credit line.
     * @param _id identifier for the credit line
     * @return current debt of borrower
     */
    function calculateCurrentDebt(uint256 _id) public view returns (uint256) {
        uint256 _interestAccrued = calculateInterestAccrued(_id);
        uint256 _currentDebt = (creditLineVariables[_id].principal)
            .add(creditLineVariables[_id].interestAccruedTillLastPrincipalUpdate)
            .add(_interestAccrued)
            .sub(creditLineVariables[_id].totalInterestRepaid);
        return _currentDebt;
    }

    /**
     * @notice used to calculate amount that can be borrowed by the borrower
     * @dev is a view function for the protocol itself, but isn't view because of getTokensForShares which is not view.
            borrowableAmount changes per block as interest changes per block.
     * @param _id identifier for the credit line
     * @return amount that can be borrowed from the credit line
     */
    function calculateBorrowableAmount(uint256 _id) public returns (uint256) {
        CreditLineStatus _status = creditLineVariables[_id].status;
        require(
            _status == CreditLineStatus.ACTIVE || _status == CreditLineStatus.REQUESTED,
            'CreditLine: Cannot only if credit line ACTIVE or REQUESTED'
        );
        (uint256 _ratioOfPrices, uint256 _decimals) = IPriceOracle(priceOracle).getLatestPrice(
            creditLineConstants[_id].collateralAsset,
            creditLineConstants[_id].borrowAsset
        );

        uint256 _totalCollateralToken = calculateTotalCollateralTokens(_id);

        uint256 _currentDebt = calculateCurrentDebt(_id);

        uint256 _maxPossible = _totalCollateralToken.mul(_ratioOfPrices).div(creditLineConstants[_id].idealCollateralRatio).mul(10**30).div(
            10**_decimals
        );

        uint256 _borrowLimit = creditLineConstants[_id].borrowLimit;

        if (_maxPossible > _borrowLimit) {
            _maxPossible = _borrowLimit;
        }
        if (_maxPossible > _currentDebt) {
            return _maxPossible.sub(_currentDebt);
        }
        return 0;
    }

    function updateinterestAccruedTillLastPrincipalUpdate(uint256 _id) internal {
        require(creditLineVariables[_id].status == CreditLineStatus.ACTIVE, 'CreditLine: The credit line is not yet active.');

        uint256 _interestAccrued = calculateInterestAccrued(_id);
        uint256 _newInterestAccrued = (creditLineVariables[_id].interestAccruedTillLastPrincipalUpdate).add(_interestAccrued);
        creditLineVariables[_id].interestAccruedTillLastPrincipalUpdate = _newInterestAccrued;
    }

    function _depositCollateralFromSavingsAccount(
        uint256 _id,
        uint256 _amount,
        address _sender
    ) internal {
        address _collateralAsset = creditLineConstants[_id].collateralAsset;
        address[] memory _strategyList = IStrategyRegistry(strategyRegistry).getStrategies();
        ISavingsAccount _savingsAccount = ISavingsAccount(savingsAccount);
        uint256 _activeAmount;

        for (uint256 _index = 0; _index < _strategyList.length; _index++) {
            address _strategy = _strategyList[_index];
            uint256 _liquidityShares = _savingsAccount.balanceInShares(_sender, _collateralAsset, _strategy);
            if (_liquidityShares == 0 || _strategyList[_index] == address(0)) {
                continue;
            }
            uint256 _tokenInStrategy = _liquidityShares;
            _tokenInStrategy = IYield(_strategy).getTokensForShares(_liquidityShares, _collateralAsset);

            uint256 _tokensToTransfer = _tokenInStrategy;
            if (_activeAmount.add(_tokenInStrategy) >= _amount) {
                _tokensToTransfer = (_amount.sub(_activeAmount));
            }
            _activeAmount = _activeAmount.add(_tokensToTransfer);
            _savingsAccount.transferFrom(_tokensToTransfer, _collateralAsset, _strategy, _sender, address(this));

            collateralShareInStrategy[_id][_strategy] = collateralShareInStrategy[_id][_strategy].add(
                _liquidityShares.mul(_tokensToTransfer).div(_tokenInStrategy)
            );

            if (_amount == _activeAmount) {
                return;
            }
        }
        revert('CreditLine::_depositCollateralFromSavingsAccount - Insufficient balance');
    }

    /**
     * @notice used to request a credit line either by borrower or lender
     * @param _requestTo Address to which creditLine is requested, 
                        if borrower creates request then lender address and 
                        if lender creates then borrower address
     * @param _borrowLimit maximum borrow amount in a credit line
     * @param _borrowRate Interest Rate at which credit Line is requested
     * @param _autoLiquidation if true, anyone can liquidate loan, otherwise only lender
     * @param _collateralRatio ratio of the collateral to the debt below which credit line can be liquidated
     * @param _borrowAsset address of the token to be borrowed
     * @param _collateralAsset address of the token provided as collateral
     * @param _requestAsLender if true, lender is placing request, otherwise borrower
     * @return identifier for the credit line
     */

    function request(
        address _requestTo,
        uint256 _borrowLimit,
        uint256 _borrowRate,
        bool _autoLiquidation,
        uint256 _collateralRatio,
        address _borrowAsset,
        address _collateralAsset,
        bool _requestAsLender
    ) external returns (uint256) {
        require(_borrowAsset != _collateralAsset, 'R: cant borrow lent token');
        require(IPriceOracle(priceOracle).doesFeedExist(_borrowAsset, _collateralAsset), 'R: No price feed');

        address _lender = _requestTo;
        address _borrower = msg.sender;
        if (_requestAsLender) {
            _lender = msg.sender;
            _borrower = _requestTo;
        }

        uint256 _id = _createRequest(
            _lender,
            _borrower,
            _borrowLimit,
            _borrowRate,
            _autoLiquidation,
            _collateralRatio,
            _borrowAsset,
            _collateralAsset,
            _requestAsLender
        );

        emit CreditLineRequested(_id, _lender, _borrower);
        return _id;
    }

    function _createRequest(
        address _lender,
        address _borrower,
        uint256 _borrowLimit,
        uint256 _borrowRate,
        bool _autoLiquidation,
        uint256 _collateralRatio,
        address _borrowAsset,
        address _collateralAsset,
        bool _requestByLender
    ) internal returns (uint256) {
        require(_lender != _borrower, 'Lender and Borrower cannot be same addresses');
        uint256 _id = creditLineCounter + 1;
        creditLineCounter = _id;
        creditLineVariables[_id].status = CreditLineStatus.REQUESTED;
        creditLineConstants[_id].borrower = _borrower;
        creditLineConstants[_id].lender = _lender;
        creditLineConstants[_id].borrowLimit = _borrowLimit;
        creditLineConstants[_id].autoLiquidation = _autoLiquidation;
        creditLineConstants[_id].idealCollateralRatio = _collateralRatio;
        creditLineConstants[_id].borrowRate = _borrowRate;
        creditLineConstants[_id].borrowAsset = _borrowAsset;
        creditLineConstants[_id].collateralAsset = _collateralAsset;
        creditLineConstants[_id].requestByLender = _requestByLender;
        return _id;
    }

    /**
     * @notice used to accept a credit line
     * @dev if borrower places request, lender can accept and vice versa
     * @param _id identifier for the credit line
     */
    function accept(uint256 _id) external {
        require(
            creditLineVariables[_id].status == CreditLineStatus.REQUESTED,
            'CreditLine::acceptCreditLineLender - CreditLine is already accepted'
        );
        bool _requestByLender = creditLineConstants[_id].requestByLender;
        require(
            (msg.sender == creditLineConstants[_id].borrower && _requestByLender) ||
                (msg.sender == creditLineConstants[_id].lender && !_requestByLender),
            "Only Borrower or Lender who hasn't requested can accept"
        );
        creditLineVariables[_id].status = CreditLineStatus.ACTIVE;
        emit CreditLineAccepted(_id);
    }

    /**
     * @notice used to deposit collateral into the credit line
     * @dev collateral tokens have to be approved in savingsAccount or token contract(unless ether).
            If transferred from savings account, the tokens are transferred from strategies in the 
            order prespecified in strategy registry
     * @param _id identifier for the credit line
     * @param _amount amount of collateral being deposited
     * @param _strategy strategy to which collateral is to be deposited in case transfer is not from savings account
     * @param _fromSavingsAccount if true, tokens are transferred from savingsAccount 
                                otherwise direct from collateral token contract
     */
    function depositCollateral(
        uint256 _id,
        uint256 _amount,
        address _strategy,
        bool _fromSavingsAccount
    ) external payable nonReentrant ifCreditLineExists(_id) {
        require(creditLineVariables[_id].status == CreditLineStatus.ACTIVE, 'CreditLine not active');
        _depositCollateral(_id, _amount, _strategy, _fromSavingsAccount);
        emit CollateralDeposited(_id, _amount, _strategy);
    }

    function _depositCollateral(
        uint256 _id,
        uint256 _amount,
        address _strategy,
        bool _fromSavingsAccount
    ) internal {
        require(creditLineConstants[_id].lender != msg.sender, 'lender cant deposit collateral');
        if (_fromSavingsAccount) {
            _depositCollateralFromSavingsAccount(_id, _amount, msg.sender);
        } else {
            address _collateralAsset = creditLineConstants[_id].collateralAsset;
            ISavingsAccount _savingsAccount = ISavingsAccount(savingsAccount);
            if (_collateralAsset == address(0)) {
                require(msg.value == _amount, "CreditLine::_depositCollateral - value to transfer doesn't match argument");
            } else {
                IERC20(_collateralAsset).safeTransferFrom(msg.sender, address(this), _amount);
                IERC20(_collateralAsset).approve(_strategy, _amount);
            }
            uint256 _sharesReceived = _savingsAccount.deposit{value: msg.value}(_amount, _collateralAsset, _strategy, address(this));
            collateralShareInStrategy[_id][_strategy] = collateralShareInStrategy[_id][_strategy].add(_sharesReceived);
        }
    }

    function _withdrawBorrowAmount(
        address _asset,
        uint256 _amountInTokens,
        address _lender
    ) internal {
        address[] memory _strategyList = IStrategyRegistry(strategyRegistry).getStrategies();
        ISavingsAccount _savingsAccount = ISavingsAccount(savingsAccount);
        uint256 _activeAmount;
        for (uint256 _index = 0; _index < _strategyList.length; _index++) {
            if (_strategyList[_index] == address(0)) {
                continue;
            }
            uint256 _liquidityShares = _savingsAccount.balanceInShares(_lender, _asset, _strategyList[_index]);
            if (_liquidityShares != 0) {
                uint256 tokenInStrategy = _liquidityShares;
                tokenInStrategy = IYield(_strategyList[_index]).getTokensForShares(_liquidityShares, _asset);
                uint256 _tokensToTransfer = tokenInStrategy;
                if (_activeAmount.add(tokenInStrategy) >= _amountInTokens) {
                    _tokensToTransfer = (_amountInTokens.sub(_activeAmount));
                }
                _activeAmount = _activeAmount.add(_tokensToTransfer);
                _savingsAccount.withdrawFrom(_tokensToTransfer, _asset, _strategyList[_index], _lender, address(this), false);
                if (_activeAmount == _amountInTokens) {
                    return;
                }
            }
        }
        require(_activeAmount == _amountInTokens, 'insufficient balance');
    }

    /**
     * @notice used to borrow tokens from credit line by borrower
     * @dev only borrower can call this function. Amount that can actually be borrowed is 
            min(amount based on borrowLimit, allowance to creditLine contract, balance of lender)
     * @param _id identifier for the credit line
     * @param _amount amount of tokens to borrow
     */
    function borrow(uint256 _id, uint256 _amount) external payable nonReentrant onlyCreditLineBorrower(_id) {
        require(creditLineVariables[_id].status == CreditLineStatus.ACTIVE, 'CreditLine: The credit line is not yet active.');
        uint256 _borrowableAmount = calculateBorrowableAmount(_id);
        require(_amount <= _borrowableAmount, "CreditLine::borrow - The current collateral ratio doesn't allow to withdraw the amount");
        address _borrowAsset = creditLineConstants[_id].borrowAsset;
        address _lender = creditLineConstants[_id].lender;

        updateinterestAccruedTillLastPrincipalUpdate(_id);
        creditLineVariables[_id].principal = creditLineVariables[_id].principal.add(_amount);
        creditLineVariables[_id].lastPrincipalUpdateTime = block.timestamp;

        uint256 _tokenDiffBalance;
        if (_borrowAsset != address(0)) {
            uint256 _balanceBefore = IERC20(_borrowAsset).balanceOf(address(this));
            _withdrawBorrowAmount(_borrowAsset, _amount, _lender);
            uint256 _balanceAfter = IERC20(_borrowAsset).balanceOf(address(this));
            _tokenDiffBalance = _balanceAfter.sub(_balanceBefore);
        } else {
            uint256 _balanceBefore = address(this).balance;
            _withdrawBorrowAmount(_borrowAsset, _amount, _lender);
            uint256 _balanceAfter = address(this).balance;
            _tokenDiffBalance = _balanceAfter.sub(_balanceBefore);
        }
        uint256 _protocolFee = _tokenDiffBalance.mul(protocolFeeFraction).div(10**30);
        _tokenDiffBalance = _tokenDiffBalance.sub(_protocolFee);

        if (_borrowAsset == address(0)) {
            (bool feeSuccess, ) = protocolFeeCollector.call{value: _protocolFee}('');
            require(feeSuccess, 'Transfer fail');
            (bool success, ) = msg.sender.call{value: _tokenDiffBalance}('');
            require(success, 'Transfer fail');
        } else {
            IERC20(_borrowAsset).safeTransfer(protocolFeeCollector, _protocolFee);
            IERC20(_borrowAsset).safeTransfer(msg.sender, _tokenDiffBalance);
        }
        emit BorrowedFromCreditLine(_id, _tokenDiffBalance);
    }

    function _repayFromSavingsAccount(
        uint256 _amount,
        address _asset,
        address _lender
    ) internal {
        address[] memory _strategyList = IStrategyRegistry(strategyRegistry).getStrategies();
        ISavingsAccount _savingsAccount = ISavingsAccount(savingsAccount);
        uint256 _activeAmount;

        for (uint256 _index = 0; _index < _strategyList.length; _index++) {
            if (_strategyList[_index] == address(0)) {
                continue;
            }
            uint256 _liquidityShares = _savingsAccount.balanceInShares(msg.sender, _asset, _strategyList[_index]);
            if (_liquidityShares == 0) {
                continue;
            }
            uint256 _tokenInStrategy = _liquidityShares;
            _tokenInStrategy = IYield(_strategyList[_index]).getTokensForShares(_liquidityShares, _asset);

            uint256 _tokensToTransfer = _tokenInStrategy;
            if (_activeAmount.add(_tokenInStrategy) >= _amount) {
                _tokensToTransfer = (_amount.sub(_activeAmount));
            }
            _activeAmount = _activeAmount.add(_tokensToTransfer);
            _savingsAccount.transferFrom(_tokensToTransfer, _asset, _strategyList[_index], msg.sender, _lender);

            if (_amount == _activeAmount) {
                return;
            }
        }
        revert('CreditLine::_repayFromSavingsAccount - Insufficient balance');
    }

    function _repay(
        uint256 _id,
        uint256 _amount,
        bool _fromSavingsAccount,
        uint256 _principalPaid
    ) internal {
        ISavingsAccount _savingsAccount = ISavingsAccount(savingsAccount);
        address _defaultStrategy = defaultStrategy;
        address _borrowAsset = creditLineConstants[_id].borrowAsset;
        address _lender = creditLineConstants[_id].lender;
        if (!_fromSavingsAccount) {
            if (_borrowAsset == address(0)) {
                require(msg.value == _amount, 'creditLine::repay - Ether sent not equal to repay amount');
                _savingsAccount.deposit{value: _amount}(_amount, _borrowAsset, _defaultStrategy, _lender);
            } else {
                IERC20(_borrowAsset).safeTransferFrom(msg.sender, address(this), _amount);
                IERC20(_borrowAsset).approve(_defaultStrategy, _amount);
                _savingsAccount.deposit(_amount, _borrowAsset, _defaultStrategy, _lender);
            }
        } else {
            _repayFromSavingsAccount(_amount, _borrowAsset, _lender);
        }
        if (_principalPaid != 0) {
            _savingsAccount.increaseAllowanceToCreditLine(_principalPaid, _borrowAsset, _lender);
        }
    }

    /**
     * @notice used to repay interest and principal to credit line. Interest has to be repaid before repaying principal
     * @dev partial repayments possible
     * @param _id identifier for the credit line
     * @param _amount amount being repaid
     * @param _fromSavingsAccount if true, tokens are transferred from savingsAccount 
                                otherwise direct from collateral token contract
     */
    function repay(
        uint256 _id,
        uint256 _amount,
        bool _fromSavingsAccount
    ) external payable nonReentrant {
        require(creditLineVariables[_id].status == CreditLineStatus.ACTIVE, 'CreditLine: The credit line is not yet active.');
        require(creditLineConstants[_id].lender != msg.sender, 'Lender cant repay');

        uint256 _interestSincePrincipalUpdate = calculateInterestAccrued(_id);
        uint256 _totalInterestAccrued = (creditLineVariables[_id].interestAccruedTillLastPrincipalUpdate).add(
            _interestSincePrincipalUpdate
        );
        uint256 _interestToPay = _totalInterestAccrued.sub(creditLineVariables[_id].totalInterestRepaid);
        uint256 _totalCurrentDebt = _interestToPay.add(creditLineVariables[_id].principal);
        uint256 _principalPaid = 0;

        if (_amount >= _totalCurrentDebt) {
            _amount = _totalCurrentDebt;
            emit CompleteCreditLineRepaid(_id, _amount);
        } else {
            emit PartialCreditLineRepaid(_id, _amount);
        }

        if (_amount > _interestToPay) {
            creditLineVariables[_id].principal = _totalCurrentDebt.sub(_amount);
            creditLineVariables[_id].interestAccruedTillLastPrincipalUpdate = _totalInterestAccrued;
            creditLineVariables[_id].lastPrincipalUpdateTime = block.timestamp;
            creditLineVariables[_id].totalInterestRepaid = _totalInterestAccrued;
            _principalPaid = _amount.sub(_interestToPay);
        } else {
            creditLineVariables[_id].totalInterestRepaid = creditLineVariables[_id].totalInterestRepaid.add(_amount);
        }

        _repay(_id, _amount, _fromSavingsAccount, _principalPaid);

        if (creditLineVariables[_id].principal == 0) {
            _resetCreditLine(_id);
        }
    }

    function _resetCreditLine(uint256 _id) internal {
        creditLineVariables[_id].lastPrincipalUpdateTime = 0;
        creditLineVariables[_id].totalInterestRepaid = 0;
        creditLineVariables[_id].interestAccruedTillLastPrincipalUpdate = 0;
        emit CreditLineReset(_id);
    }

    /**
     * @dev used to close credit line by borrower or lender
     * @param _id identifier for the credit line
     */
    function close(uint256 _id) external ifCreditLineExists(_id) {
        require(
            msg.sender == creditLineConstants[_id].borrower || msg.sender == creditLineConstants[_id].lender,
            'CreditLine: Permission denied while closing Line of credit'
        );
        require(creditLineVariables[_id].status == CreditLineStatus.ACTIVE, 'CreditLine: Credit line should be active.');
        require(creditLineVariables[_id].principal == 0, 'CreditLine: Cannot be closed since not repaid.');
        require(creditLineVariables[_id].interestAccruedTillLastPrincipalUpdate == 0, 'CreditLine: Cannot be closed since not repaid.');
        creditLineVariables[_id].status = CreditLineStatus.CLOSED;
        emit CreditLineClosed(_id);
    }

    /**
     * @notice used to calculate the current collateral ratio
     * @dev is a view function for the protocol itself, but isn't view because of getTokensForShares which is not view.
            Interest is also considered while calculating debt
     * @param _id identifier for the credit line
     * @return collateral ratio multiplied by 10**30 to retain precision
     */
    function calculateCurrentCollateralRatio(uint256 _id) public ifCreditLineExists(_id) returns (uint256) {
        (uint256 _ratioOfPrices, uint256 _decimals) = IPriceOracle(priceOracle).getLatestPrice(
            creditLineConstants[_id].collateralAsset,
            creditLineConstants[_id].borrowAsset
        );

        uint256 currentDebt = calculateCurrentDebt(_id);
        uint256 currentCollateralRatio = calculateTotalCollateralTokens(_id).mul(_ratioOfPrices).div(currentDebt).mul(10**30).div(
            10**_decimals
        );

        return currentCollateralRatio;
    }

    /**
     * @notice used to calculate the total collateral tokens
     * @dev is a view function for the protocol itself, but isn't view because of getTokensForShares which is not view
     * @param _id identifier for the credit line
     * @return _amount total collateral tokens deposited into the credit line
     */
    function calculateTotalCollateralTokens(uint256 _id) public returns (uint256 _amount) {
        address _collateralAsset = creditLineConstants[_id].collateralAsset;
        address[] memory _strategyList = IStrategyRegistry(strategyRegistry).getStrategies();
        uint256 _liquidityShares;
        for (uint256 index = 0; index < _strategyList.length; index++) {
            if (_strategyList[index] == address(0)) {
                continue;
            }
            _liquidityShares = collateralShareInStrategy[_id][_strategyList[index]];
            uint256 _tokenInStrategy = _liquidityShares;
            _tokenInStrategy = IYield(_strategyList[index]).getTokensForShares(_liquidityShares, _collateralAsset);

            _amount = _amount.add(_tokenInStrategy);
        }
    }

    /**
     * @notice used to withdraw any excess collateral
     * @dev collateral can't be withdraw if collateralRatio goes below the ideal value. Only borrower can withdraw
     * @param _id identifier for the credit line
     * @param _amount amount of collateral to withdraw
     * @param _toSavingsAccount if true, tokens are transferred from savingsAccount 
                                otherwise direct from collateral token contract
     */
    function withdrawCollateral(
        uint256 _id,
        uint256 _amount,
        bool _toSavingsAccount
    ) external nonReentrant onlyCreditLineBorrower(_id) {
        uint256 _withdrawableCollateral = withdrawableCollateral(_id);
        require(_amount <= _withdrawableCollateral, 'Collateral ratio cant go below ideal');
        address _collateralAsset = creditLineConstants[_id].collateralAsset;
        _transferCollateral(_id, _collateralAsset, _amount, _toSavingsAccount);
        emit CollateralWithdrawn(_id, _amount);
    }

    /**
     * @notice used to calculate the collateral that can be withdrawn
     * @dev is a view function for the protocol itself, but isn't view because of getTokensForShares which is not view
     * @param _id identifier for the credit line
     * @return total collateral withdrawable by borrower
     */
    function withdrawableCollateral(uint256 _id) public returns (uint256) {
        (uint256 _ratioOfPrices, uint256 _decimals) = IPriceOracle(priceOracle).getLatestPrice(
            creditLineConstants[_id].collateralAsset,
            creditLineConstants[_id].borrowAsset
        );

        uint256 _totalCollateralTokens = calculateTotalCollateralTokens(_id);
        uint256 _currentDebt = calculateCurrentDebt(_id);

        uint256 _collateralNeeded = _currentDebt
            .mul(creditLineConstants[_id].idealCollateralRatio)
            .div(_ratioOfPrices)
            .mul(10**_decimals)
            .div(10**30);

        if (_collateralNeeded >= _totalCollateralTokens) {
            return 0;
        }
        return _totalCollateralTokens.sub(_collateralNeeded);
    }

    function _transferCollateral(
        uint256 _id,
        address _asset,
        uint256 _amountInTokens,
        bool _toSavingsAccount
    ) internal {
        address[] memory _strategyList = IStrategyRegistry(strategyRegistry).getStrategies();
        uint256 _activeAmount;
        for (uint256 index = 0; index < _strategyList.length; index++) {
            uint256 liquidityShares = collateralShareInStrategy[_id][_strategyList[index]];
            if (liquidityShares == 0 || _strategyList[index] == address(0)) {
                continue;
            }
            uint256 _tokenInStrategy = liquidityShares;
            _tokenInStrategy = IYield(_strategyList[index]).getTokensForShares(liquidityShares, _asset);
            uint256 _tokensToTransfer = _tokenInStrategy;
            if (_activeAmount.add(_tokenInStrategy) > _amountInTokens) {
                _tokensToTransfer = _amountInTokens.sub(_activeAmount);
                liquidityShares = liquidityShares.mul(_tokensToTransfer).div(_tokenInStrategy);
            }
            _activeAmount = _activeAmount.add(_tokensToTransfer);
            collateralShareInStrategy[_id][_strategyList[index]] = collateralShareInStrategy[_id][_strategyList[index]].sub(
                liquidityShares
            );
            if (_toSavingsAccount) {
                ISavingsAccount(savingsAccount).transfer(_tokensToTransfer, _asset, _strategyList[index], msg.sender);
            } else {
                ISavingsAccount(savingsAccount).withdraw(_tokensToTransfer, _asset, _strategyList[index], msg.sender, false);
            }

            if (_activeAmount == _amountInTokens) {
                return;
            }
        }
        revert('insufficient collateral');
    }

    /**
     * @notice used to liquidate credit line in case collateral ratio goes below the threshold
     * @dev if lender liquidates, then collateral is directly transferred. 
            If autoLiquidation is true, anyone can liquidate by providing enough borrow tokens
     * @param _id identifier for the credit line
     * @param _toSavingsAccount if true, tokens are transferred from savingsAccount 
                                otherwise direct from collateral token contract
     */
    function liquidate(uint256 _id, bool _toSavingsAccount) external payable nonReentrant {
        require(creditLineVariables[_id].status == CreditLineStatus.ACTIVE, 'CreditLine: Credit line should be active.');
        require(creditLineVariables[_id].principal != 0, 'CreditLine: cannot liquidate if principal is 0');

        uint256 currentCollateralRatio = calculateCurrentCollateralRatio(_id);
        require(
            currentCollateralRatio < creditLineConstants[_id].idealCollateralRatio,
            'CreditLine: Collateral ratio is higher than ideal value'
        );

        address _collateralAsset = creditLineConstants[_id].collateralAsset;
        address _lender = creditLineConstants[_id].lender;
        uint256 _totalCollateralTokens = calculateTotalCollateralTokens(_id);
        address _borrowAsset = creditLineConstants[_id].borrowAsset;

        creditLineVariables[_id].status = CreditLineStatus.LIQUIDATED;

        if (creditLineConstants[_id].autoLiquidation && _lender != msg.sender) {
            uint256 _borrowTokens = _borrowTokensToLiquidate(_borrowAsset, _collateralAsset, _totalCollateralTokens);
            if (_borrowAsset == address(0)) {
                uint256 _returnETH = msg.value.sub(_borrowTokens, 'Insufficient ETH to liquidate');
                if (_returnETH != 0) {
                    (bool success, ) = msg.sender.call{value: _returnETH}('');
                    require(success, 'Transfer fail');
                }
            } else {
                IERC20(_borrowAsset).safeTransferFrom(msg.sender, _lender, _borrowTokens);
            }
        }

        _transferCollateral(_id, _collateralAsset, _totalCollateralTokens, _toSavingsAccount);

        emit CreditLineLiquidated(_id, msg.sender);
    }

    /**
     * @notice used to calculate the borrow tokens necessary for liquidator to liquidate
     * @dev is a view function for the protocol itself, but isn't view because of getTokensForShares which is not view
     * @param _id identifier for the credit line
     * @return borrow tokens necessary for liquidator to liquidate
     */
    function borrowTokensToLiquidate(uint256 _id) external returns (uint256) {
        address _collateralAsset = creditLineConstants[_id].collateralAsset;
        uint256 _totalCollateralTokens = calculateTotalCollateralTokens(_id);
        address _borrowAsset = creditLineConstants[_id].borrowAsset;

        return _borrowTokensToLiquidate(_borrowAsset, _collateralAsset, _totalCollateralTokens);
    }

    function _borrowTokensToLiquidate(
        address _borrowAsset,
        address _collateralAsset,
        uint256 _totalCollateralTokens
    ) internal view returns (uint256) {
        (uint256 _ratioOfPrices, uint256 _decimals) = IPriceOracle(priceOracle).getLatestPrice(_borrowAsset, _collateralAsset);
        uint256 _borrowTokens = (
            _totalCollateralTokens.mul(uint256(10**30).sub(liquidatorRewardFraction)).div(10**30).mul(_ratioOfPrices).div(10**_decimals)
        );

        return _borrowTokens;
    }

    receive() external payable {
        require(msg.sender == savingsAccount, 'CreditLine::receive invalid transaction');
    }
}
