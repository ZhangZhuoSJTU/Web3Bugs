// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '@openzeppelin/contracts-upgradeable/proxy/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol';
import '../interfaces/IPool.sol';
import '../interfaces/IPoolFactory.sol';
import '../interfaces/IRepayment.sol';

/**
 * @title Repayments contract
 * @dev For accuracy considering base itself as (SCALING_FACTOR)
 * @notice Implements the functions related to repayments (payments that
 * have to made by the borrower back to the pool)
 * @author Sublime
 */
contract Repayments is Initializable, IRepayment, ReentrancyGuardUpgradeable {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    //-------------------------------- Constants start --------------------------------/

    // Max value of uint256
    uint256 constant HIGH_AMOUNT = 2**128;

    // Number of seconds in a year. Year is of exactly 365 days for simplicity
    uint256 constant YEAR_IN_SECONDS = 365 days;

    // Factor to multiply variables to maintain precision
    uint256 constant SCALING_FACTOR = 1e18;

    //-------------------------------- Constants end --------------------------------/

    //-------------------------------- Global vars start --------------------------------/

    // Address of the pool factory contract
    IPoolFactory poolFactory;

    /**
     * @notice Penalty interest rate applied during grace period
     * @dev multiplied by SCALING_FACTOR to maintain precision
     */
    uint128 public gracePenaltyRate;

    /**
     * @notice Fraction of repayment interval for which grace period is allowed
     * @dev multiplied by SCALING_FACTOR to maintain precision
     */
    uint128 public gracePeriodFraction;

    //-------------------------------- Global vars end --------------------------------/

    //-------------------------------- State vars start --------------------------------/

    /**
     * @notice Struct that is used to store variables related to repayment for a pool
     * @param repaidAmount amount of tokens repaid as interest by borrower
     * @param loanDurationCovered duration for which repayments are made based on total repayments by borrower. 
                                Scaled by SCALING_FACTOR to maintain precision
     */
    struct RepaymentVariables {
        uint256 repaidAmount;
        uint256 loanDurationCovered;
    }

    /**
     * @notice Struct that is used to store constants related to repayment for a pool
     * @param numberOfTotalRepayments number of intervals before which repayments for pool should be completed
     * @param repayAsset address of token in which interest is repaid
     * @param gracePenaltyRate Penalty interest rate applied during grace period. Scaled by SCALING_FACTOR
     * @param gracePeriodFraction Fraction of repayment interval for which grace period is allowed. Scaled by SCALING_FACTOR
     * @param borrowRate The rate at which lending took place. Scaled by SCALING_FACTOR
     * @param repaymentInterval Intervals after which repayment will be due. Scaled by SCALING_FACTOR
     * @param loanDuration Duration of the total loan. Scaled by SCALING_FACTOR
     * @param loanStartTime The starting time of the loan. Scaled by SCALING_FACTOR
     */
    struct RepaymentConstants {
        uint64 numberOfTotalRepayments; // using it to check if RepaymentDetails Exists as repayment Interval!=0 in any case
        address repayAsset;
        uint128 gracePenaltyRate;
        uint128 gracePeriodFraction;
        uint256 borrowRate;
        uint256 repaymentInterval;
        uint256 loanDuration;
        uint256 loanStartTime;
    }

    /**
     * @notice used to maintain the variables related to repayment against a pool
     */
    mapping(address => RepaymentVariables) public repayVariables;

    /**
     * @notice used to maintain the constants related to repayment against a pool
     */
    mapping(address => RepaymentConstants) public repayConstants;

    //-------------------------------- State vars end --------------------------------/

    //-------------------------------- Modifiers start --------------------------------/

    /// @notice determines if the pool is active or not based on whether repayments have been started by the
    ///borrower for this particular pool or not
    /// @param _poolID address of the pool for which we want to test statu
    modifier isPoolInitialized(address _poolID) {
        require(repayConstants[_poolID].numberOfTotalRepayments != 0, 'R:IPI1');
        _;
    }

    /// @notice modifier used to determine whether the current pool is valid or not
    /// @dev poolRegistry from IPoolFactory interface returns a bool
    modifier onlyValidPool() {
        require(poolFactory.poolRegistry(msg.sender) != 0, 'R:OVP1');
        _;
    }

    /**
     * @notice modifier used to check if msg.sender is the owner
     */
    modifier onlyOwner() {
        require(msg.sender == poolFactory.owner(), 'R:OO1');
        _;
    }

    //-------------------------------- Modifiers end --------------------------------/

    //-------------------------------- Global var setters start --------------------------------/

    /**
     * @notice used to update pool factory address
     * @param _poolFactory address of pool factory contract
     */
    function updatePoolFactory(address _poolFactory) external onlyOwner {
        require(address(poolFactory) != _poolFactory, 'R:UPF1');
        _updatePoolFactory(_poolFactory);
    }

    function _updatePoolFactory(address _poolFactory) private {
        require(_poolFactory != address(0), 'R:IUPF1');
        poolFactory = IPoolFactory(_poolFactory);
        emit PoolFactoryUpdated(_poolFactory);
    }

    /**
     * @notice used to update grace period as a fraction of repayment interval
     * @param _gracePeriodFraction updated value of gracePeriodFraction multiplied by SCALING_FACTOR
     */
    function updateGracePeriodFraction(uint128 _gracePeriodFraction) external onlyOwner {
        require(gracePeriodFraction != _gracePeriodFraction, 'R:UGPF1');
        _updateGracePeriodFraction(_gracePeriodFraction);
    }

    function _updateGracePeriodFraction(uint128 _gracePeriodFraction) private {
        gracePeriodFraction = _gracePeriodFraction;
        emit GracePeriodFractionUpdated(_gracePeriodFraction);
    }

    /**
     * @notice used to update grace penality rate
     * @param _gracePenaltyRate value of grace penality rate multiplied by SCALING_FACTOR
     */
    function updateGracePenaltyRate(uint128 _gracePenaltyRate) external onlyOwner {
        require(gracePenaltyRate != _gracePenaltyRate, 'R:UGPR1');
        _updateGracePenaltyRate(_gracePenaltyRate);
    }

    function _updateGracePenaltyRate(uint128 _gracePenaltyRate) private {
        gracePenaltyRate = _gracePenaltyRate;
        emit GracePenaltyRateUpdated(_gracePenaltyRate);
    }

    //-------------------------------- Global var setters end --------------------------------/

    //-------------------------------- Init start --------------------------------/

    /// @notice Initializes the contract (similar to a constructor)
    /// @dev Since we cannot use constructors when using OpenZeppelin Upgrades, we use the initialize function
    ///and the initializer modifier makes sure that this function is called only once
    /// @param _poolFactory The address of the pool factory
    /// @param _gracePenaltyRate The penalty rate levied in the grace period
    /// @param _gracePeriodFraction The fraction of repayment interval that will be allowed as grace period
    function initialize(
        address _poolFactory,
        uint128 _gracePenaltyRate,
        uint128 _gracePeriodFraction
    ) external initializer {
        ReentrancyGuardUpgradeable.__ReentrancyGuard_init();

        _updatePoolFactory(_poolFactory);
        _updateGracePenaltyRate(_gracePenaltyRate);
        _updateGracePeriodFraction(_gracePeriodFraction);
    }

    /// @notice For a valid pool, the repayment schedule is being initialized here
    /// @dev Imported from RepaymentStorage.sol repayConstants is a mapping(address => repayConstants)
    /// @param numberOfTotalRepayments The total number of repayments that will be required from the borrower
    /// @param repaymentInterval Intervals after which repayment will be due
    /// @param borrowRate The rate at which lending took place
    /// @param loanStartTime The starting time of the loan
    /// @param lentAsset The address of the asset that was lent (basically a ERC20 token address)
    function initializeRepayment(
        uint64 numberOfTotalRepayments,
        uint256 repaymentInterval,
        uint256 borrowRate,
        uint256 loanStartTime,
        address lentAsset
    ) external override onlyValidPool {
        RepaymentConstants storage _repaymentConstants = repayConstants[msg.sender];
        _repaymentConstants.gracePenaltyRate = gracePenaltyRate;
        _repaymentConstants.gracePeriodFraction = gracePeriodFraction;
        _repaymentConstants.numberOfTotalRepayments = numberOfTotalRepayments;
        _repaymentConstants.loanDuration = repaymentInterval.mul(numberOfTotalRepayments).mul(SCALING_FACTOR);
        _repaymentConstants.repaymentInterval = repaymentInterval.mul(SCALING_FACTOR);
        _repaymentConstants.borrowRate = borrowRate;
        _repaymentConstants.loanStartTime = loanStartTime.mul(SCALING_FACTOR);
        _repaymentConstants.repayAsset = lentAsset;
    }

    //-------------------------------- Init end --------------------------------/

    //-------------------------------- Repay start --------------------------------/

    /// @notice Used to for your overdues, grace penalty and interest
    /// @dev (SCALING_FACTOR) is included to maintain the accuracy of the arithmetic operations
    /// @param _poolID address of the pool
    /// @param _amount amount repaid by the borrower
    function repay(address _poolID, uint256 _amount) external nonReentrant isPoolInitialized(_poolID) {
        address _asset = repayConstants[_poolID].repayAsset;
        uint256 _amountRepaid = _repay(_poolID, _amount, false);

        IERC20(_asset).safeTransferFrom(msg.sender, _poolID, _amountRepaid);
    }

    function _repayGracePenalty(address _poolID) private returns (uint256) {
        uint256 _nextInstalmentDeadline = getNextInstalmentDeadline(_poolID);
        bool _isBorrowerLate = _isGracePenaltyApplicable(_poolID, _nextInstalmentDeadline);

        if (_isBorrowerLate) {
            uint256 _interestDue = _getInterestDueTillInstalmentDeadline(_poolID, _nextInstalmentDeadline);
            uint256 _penalty = uint256(repayConstants[_poolID].gracePenaltyRate).mul(_interestDue).div(SCALING_FACTOR);
            emit GracePenaltyRepaid(_poolID, _penalty);
            return _penalty;
        } else {
            return 0;
        }
    }

    function _repayInterest(
        address _poolID,
        uint256 _amount,
        bool _isLastRepayment
    ) private returns (uint256) {
        uint256 _interestLeft = getInterestLeft(_poolID);
        require((_amount < _interestLeft) != _isLastRepayment, 'R:IRI1');

        if (_amount < _interestLeft) {
            uint256 _newDurationRepaid = getRepaidDuration(_poolID, _amount);
            repayVariables[_poolID].loanDurationCovered = repayVariables[_poolID].loanDurationCovered.add(_newDurationRepaid);
            emit InterestRepaid(_poolID, _amount);
            return _amount;
        } else {
            repayVariables[_poolID].loanDurationCovered = repayConstants[_poolID].loanDuration; // full interest repaid
            emit InterestRepaymentComplete(_poolID, _interestLeft);
            return _interestLeft;
        }
    }

    function _updateRepaidAmount(address _poolID, uint256 _repaidAmount) private returns (uint256) {
        repayVariables[_poolID].repaidAmount = repayVariables[_poolID].repaidAmount.add(_repaidAmount);
        return _repaidAmount;
    }

    function _repay(
        address _poolID,
        uint256 _amount,
        bool _isLastRepayment
    ) private returns (uint256) {
        IPool _pool = IPool(_poolID);
        uint256 _loanStatus = _pool.getLoanStatus();
        require(_loanStatus == uint256(IPool.LoanStatus.ACTIVE), 'R:IR1');

        // pay off grace penality
        uint256 _gracePenaltyDue = _repayGracePenalty(_poolID);

        // pay interest
        uint256 _interestRepaid = _repayInterest(_poolID, _amount, _isLastRepayment);

        return _updateRepaidAmount(_poolID, _gracePenaltyDue.add(_interestRepaid));
    }

    /// @notice Used to pay off the principal of the loan, once the overdues and interests are repaid
    /// @dev (SCALING_FACTOR) is included to maintain the accuracy of the arithmetic operations
    /// @param _poolID address of the pool
    function repayPrincipal(address _poolID) external nonReentrant isPoolInitialized(_poolID) {
        address _asset = repayConstants[_poolID].repayAsset;
        uint256 _interestToRepay = _repay(_poolID, HIGH_AMOUNT, true);
        IPool _pool = IPool(_poolID);

        require(repayConstants[_poolID].loanDuration == repayVariables[_poolID].loanDurationCovered, 'R:RP1');

        uint256 _amount = _pool.totalSupply();
        uint256 _amountToPay = _amount.add(_interestToRepay);
        IERC20(_asset).safeTransferFrom(msg.sender, _poolID, _amountToPay);
        emit PrincipalRepaid(_poolID, _amount);

        _pool.closeLoan();
    }

    //-------------------------------- Repay end --------------------------------/

    //-------------------------------- Utils start --------------------------------/

    /**
     * @notice returns SCALED UP interest per second for the specific pool
     * @param _poolID address of the pool
     * @return SCALED UP interest per second
     */

    function getInterestPerSecond(address _poolID) public view returns (uint256) {
        uint256 _activePrincipal = IPool(_poolID).totalSupply();
        // we are not multiplying by SCALING_FACTOR becuase borrowRate is already scaled up
        uint256 _interestPerSecond = _activePrincipal.mul(repayConstants[_poolID].borrowRate).div(YEAR_IN_SECONDS);
        return _interestPerSecond;
    }

    /**
     * @notice returns interest for specific scaled up time
     * @param _poolID address of the pool
     * @param _scaledUpTime scaled time for which interest is calculated
     * @return interest per second
     */
    function getInterest(address _poolID, uint256 _scaledUpTime) public view returns (uint256) {
        uint256 _activePrincipal = IPool(_poolID).totalSupply();
        uint256 _borrowRate = repayConstants[_poolID].borrowRate;
        return _activePrincipal.mul(_borrowRate).div(SCALING_FACTOR).mul(_scaledUpTime).div(YEAR_IN_SECONDS).div(SCALING_FACTOR);
    }

    /**
     * @notice returns scaled up duration for which specified amount can repay interest for a specific pool
     * @param _poolID address of the pool
     * @param _amount scaled up amount
     * @return Scaled up (by SCALING_FACTOR) duration for which _amount can repay interest for the Pool
     */
    function getRepaidDuration(address _poolID, uint256 _amount) public view returns (uint256) {
        uint256 _activePrincipal = IPool(_poolID).totalSupply();
        return
            _amount.mul(YEAR_IN_SECONDS).mul(SCALING_FACTOR).div(_activePrincipal).mul(SCALING_FACTOR).div(
                repayConstants[_poolID].borrowRate
            );
    }

    /// @notice This function determines the number of completed instalments
    /// @param _poolID The address of the pool for which we want the completed instalments
    /// @return scaled instalments completed
    function getInstalmentsCompleted(address _poolID) public view returns (uint256) {
        uint256 _repaymentInterval = repayConstants[_poolID].repaymentInterval;
        uint256 _loanDurationCovered = repayVariables[_poolID].loanDurationCovered;
        uint256 _instalmentsCompleted = _loanDurationCovered.div(_repaymentInterval).mul(SCALING_FACTOR); // dividing exponents, returns whole number rounded down

        return _instalmentsCompleted;
    }

    /// @notice This function determines the interest that is due for the borrower till the current instalment deadline
    /// @param _poolID The address of the pool for which we want the interest
    /// @return scaled interest due till instalment deadline
    function getInterestDueTillInstalmentDeadline(address _poolID) external view returns (uint256) {
        uint256 _nextInstalmentDeadline = getNextInstalmentDeadline(_poolID);
        return _getInterestDueTillInstalmentDeadline(_poolID, _nextInstalmentDeadline);
    }

    function _getInterestDueTillInstalmentDeadline(address _poolID, uint256 _nextInstalmentDeadline) private view returns (uint256) {
        uint256 _loanDurationCovered = repayVariables[_poolID].loanDurationCovered;
        uint256 _interestDueTillInstalmentDeadline = getInterest(
            _poolID,
            _nextInstalmentDeadline.sub(repayConstants[_poolID].loanStartTime).sub(_loanDurationCovered)
        );
        return _interestDueTillInstalmentDeadline;
    }

    /// @notice This function determines the timestamp of the next instalment deadline
    /// @param _poolID The address of the pool for which we want the next instalment deadline
    /// @return timestamp before which next instalment ends
    function getNextInstalmentDeadline(address _poolID) public view override returns (uint256) {
        uint256 _instalmentsCompleted = getInstalmentsCompleted(_poolID);
        if (_instalmentsCompleted == uint256(repayConstants[_poolID].numberOfTotalRepayments).mul(SCALING_FACTOR)) {
            revert('R:GNID1');
        }

        uint256 _repaymentInterval = repayConstants[_poolID].repaymentInterval;
        uint256 _loanStartTime = repayConstants[_poolID].loanStartTime;
        uint256 _nextInstalmentDeadline = ((_instalmentsCompleted.add(SCALING_FACTOR)).mul(_repaymentInterval).div(SCALING_FACTOR)).add(
            _loanStartTime
        );
        return _nextInstalmentDeadline;
    }

    /// @notice This function determine the current instalment interval
    /// @param _poolID The address of the pool for which we want the current instalment interval
    /// @return scaled instalment interval
    function getCurrentInstalmentInterval(address _poolID) external view returns (uint256) {
        uint256 _instalmentsCompleted = getInstalmentsCompleted(_poolID);
        return _instalmentsCompleted.add(SCALING_FACTOR);
    }

    /// @notice This function determines the current (loan) interval
    /// @dev adding SCALING_FACTOR to add 1. Considering base itself as (SCALING_FACTOR)
    /// @param _poolID The address of the pool for which we want the current loan interval
    /// @return scaled current loan interval
    function getCurrentLoanInterval(address _poolID) external view override returns (uint256) {
        uint256 _loanStartTime = repayConstants[_poolID].loanStartTime;
        uint256 _currentTime = block.timestamp.mul(SCALING_FACTOR);
        uint256 _repaymentInterval = repayConstants[_poolID].repaymentInterval;
        uint256 _currentInterval = ((_currentTime.sub(_loanStartTime)).mul(SCALING_FACTOR).div(_repaymentInterval)).add(SCALING_FACTOR);

        return _currentInterval;
    }

    /// @notice Check if grace penalty is applicable or not
    /// @dev (SCALING_FACTOR) is included to maintain the accuracy of the arithmetic operations
    /// @param _poolID address of the pool for which we want to inquire if grace penalty is applicable or not
    /// @return boolean value indicating if applicable or not
    function isGracePenaltyApplicable(address _poolID) external view returns (bool) {
        uint256 _nextInstalmentDeadline = getNextInstalmentDeadline(_poolID);

        return _isGracePenaltyApplicable(_poolID, _nextInstalmentDeadline);
    }

    function _isGracePenaltyApplicable(address _poolID, uint256 _nextInstalmentDeadline) private view returns (bool) {
        uint256 _repaymentInterval = repayConstants[_poolID].repaymentInterval;
        uint256 _currentTime = block.timestamp.mul(SCALING_FACTOR);
        uint256 _gracePeriodFraction = repayConstants[_poolID].gracePeriodFraction;
        uint256 _gracePeriodDeadline = _nextInstalmentDeadline.add(_gracePeriodFraction.mul(_repaymentInterval).div(SCALING_FACTOR));

        require(_currentTime <= _gracePeriodDeadline, 'R:IGPA1');

        if (_currentTime <= _nextInstalmentDeadline) return false;
        else return true;
    }

    /// @notice Checks if the borrower has defaulted
    /// @dev (SCALING_FACTOR) is included to maintain the accuracy of the arithmetic operations
    /// @param _poolID address of the pool from which borrower borrowed
    /// @return bool indicating whether the borrower has defaulted
    function didBorrowerDefault(address _poolID) external view override returns (bool) {
        uint256 _repaymentInterval = repayConstants[_poolID].repaymentInterval;
        uint256 _currentTime = block.timestamp.mul(SCALING_FACTOR);
        uint256 _gracePeriodFraction = repayConstants[_poolID].gracePeriodFraction;
        uint256 _nextInstalmentDeadline = getNextInstalmentDeadline(_poolID);
        uint256 _gracePeriodDeadline = _nextInstalmentDeadline.add(_gracePeriodFraction.mul(_repaymentInterval).div(SCALING_FACTOR));
        if (_currentTime > _gracePeriodDeadline) return true;
        else return false;
    }

    /// @notice Determines entire interest remaining to be paid for the loan issued to the borrower
    /// @dev (SCALING_FACTOR) is included to maintain the accuracy of the arithmetic operations
    /// @param _poolID address of the pool for which we want to calculate remaining interest
    /// @return interest remaining
    function getInterestLeft(address _poolID) public view returns (uint256) {
        uint256 _loanDurationLeft = repayConstants[_poolID].loanDuration.sub(repayVariables[_poolID].loanDurationCovered);
        uint256 _interestLeft = getInterest(_poolID, _loanDurationLeft);
        return _interestLeft;
    }

    /// @notice Returns the total amount that has been repaid by the borrower till now
    /// @param _poolID address of the pool
    /// @return total amount repaid
    function getTotalRepaidAmount(address _poolID) external view override returns (uint256) {
        return repayVariables[_poolID].repaidAmount;
    }

    /// @notice Returns the loanDurationCovered till now and the interest per second which will help in interest calculation
    /// @param _poolID address of the pool for which we want to calculate interest
    /// @return Loan Duration Covered and the interest per second
    function getInterestCalculationVars(address _poolID) external view override returns (uint256, uint256) {
        uint256 _interestPerSecond = getInterestPerSecond(_poolID);
        return (repayVariables[_poolID].loanDurationCovered, _interestPerSecond);
    }

    /// @notice Returns the fraction of repayment interval decided as the grace period fraction
    /// @return grace period fraction
    function getGracePeriodFraction() external view override returns (uint256) {
        return gracePeriodFraction;
    }
    //-------------------------------- Utils end --------------------------------/
}
